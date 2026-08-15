/**
 * Velnox Backend — Checkout (spec §39–42).
 *
 * ONE database transaction:
 *   1. validate user + shipping address (GPS required)
 *   2. lock every product row (FOR UPDATE) + read CURRENT prices from the DB
 *      (never trust prices from the cart/frontend — spec §40)
 *   3. reserve inventory atomically (fails on overselling — spec §41)
 *   4. group cart lines by shop (spec §42) → parent order + per-shop orders
 *      (each with its own items snapshot + commissions + payment record)
 *   5. release the cart
 *
 * Any failure rolls back everything — no partial orders.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
import { withTransaction } from "./db";
import { AppError } from "./errors";
import { round2 } from "./rules";
import { quoteShipping } from "./shipping";
import { checkoutInputSchema } from "./validation";
import type { PaymentMethod } from "./types";

export interface CheckoutResult {
  parentOrderId: string;
  parentOrderNumber: string;
  orders: Array<{ orderId: string; orderNumber: string; shopId: string; sellerId: string; shopName: string; subtotal: number; shippingFee: number; total: number }>;
  total: number;
  itemCount: number;
}

interface LockedLine {
  cartItemId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  shopId: string;
  sellerId: string;
  shopName: string;
  productName: string;
  unit: string;
  unitPrice: number;
  commissionRate: number;
  subtotal: number;
}

export async function checkout(input: { userId: string; addressId: string; paymentMethod?: PaymentMethod; shippingMethod?: string; note?: string | null }): Promise<CheckoutResult> {
  const parsed = checkoutInputSchema.parse({
    addressId: input.addressId,
    paymentMethod: input.paymentMethod ?? "cod",
    shippingMethod: input.shippingMethod ?? "standard",
    note: input.note ?? null,
  });

  // The shipping fee is quoted server-side — the client only chooses a method
  // (standard / express). No money number is ever trusted from the frontend.
  const shippingFee = round2(quoteShipping({ methodId: parsed.shippingMethod }).fee);

  return withTransaction(async (tx) => {
    // 1. address must exist, belong to the user, and carry GPS (spec §8, §62)
    const addrRows = await tx.query(
      "SELECT * FROM addresses WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL LIMIT 1",
      [parsed.addressId, input.userId],
    );
    if (!addrRows.rows[0]) throw new AppError("NOT_FOUND", "ไม่พบที่อยู่จัดส่ง");
    const address = addrRows.rows[0];
    if (address.latitude == null || address.longitude == null) {
      throw new AppError("ADDRESS_GPS_REQUIRED", "ที่อยู่จัดส่งต้องมีพิกัด GPS — กรุณาเลือกตำแหน่งบนแผนที่");
    }
    const addressSnapshot = {
      recipientName: address.recipientName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? undefined,
      subdistrict: address.subdistrict ?? undefined,
      district: address.district ?? undefined,
      province: address.province ?? undefined,
      postalCode: address.postalCode ?? undefined,
      country: address.country,
      latitude: address.latitude,
      longitude: address.longitude,
    };

    // 2. cart
    const cartRows = await tx.query(
      "SELECT * FROM carts WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [input.userId],
    );
    const cartId = cartRows.rows[0]?.id ?? null;
    if (!cartId) throw new AppError("INVALID_INPUT", "ตะกร้าว่างเปล่า");
    const items = await tx.query("SELECT * FROM cart_items WHERE cart_id = $1 ORDER BY created_at ASC", [cartId]);
    if (items.rows.length === 0) throw new AppError("INVALID_INPUT", "ตะกร้าว่างเปล่า");
    if (cartRows.rows.length === 0) throw new AppError("INVALID_INPUT", "ตะกร้าว่างเปล่า");

    // 3. lock products + read current price/stock + reserve
    const lines: LockedLine[] = [];
    for (const item of items.rows) {
      const product = await tx.query(
        `SELECT p.id, p.shop_id, p.name, p.unit, p.price, p.status,
                s.seller_id, s.commission_rate, s.name AS shop_name
         FROM products p
         JOIN shops s ON s.id = p.shop_id
         WHERE p.id = $1
         FOR UPDATE`,
        [item.product_id],
      );
      if (!product.rows[0]) throw new AppError("PRODUCT_NOT_FOUND");
      const p = product.rows[0];
      if (p.status !== "published") throw new AppError("OUT_OF_STOCK", `สินค้า ${p.name} ไม่ได้วางขาย`);

      const reserved = await tx.query(
        `UPDATE inventory
         SET reserved_quantity = reserved_quantity + $2
         WHERE product_id = $1 AND variant_id IS NOT DISTINCT FROM $3
           AND quantity - reserved_quantity >= $2
         RETURNING quantity, reserved_quantity`,
        [item.product_id, Number(item.quantity), item.variant_id ?? null],
      );
      if (!reserved.rows[0]) {
        const current = await tx.query(
          `SELECT quantity - reserved_quantity AS available FROM inventory WHERE product_id = $1 AND variant_id IS NOT DISTINCT FROM $2`,
          [item.product_id, item.variant_id ?? null],
        );
        const available = current.rows[0] ? Number(current.rows[0].available) : 0;
        throw new AppError("INSUFFICIENT_STOCK", `สินค้า ${p.name} มีสต็อกไม่พอ (เหลือ ${available})`);
      }

      const unitPrice = Number(p.price); // current DB price — never from frontend
      lines.push({
        cartItemId: item.id,
        productId: item.product_id,
        variantId: item.variant_id ?? null,
        quantity: Number(item.quantity),
        shopId: p.shop_id,
        sellerId: p.seller_id,
        shopName: p.shop_name,
        productName: p.name,
        unit: p.unit,
        unitPrice,
        commissionRate: Number(p.commission_rate),
        subtotal: round2(unitPrice * Number(item.quantity)),
      });
    }

    // 4. split by shop
    const byShop = new Map<string, LockedLine[]>();
    for (const l of lines) {
      const list = byShop.get(l.shopId) ?? [];
      list.push(l);
      byShop.set(l.shopId, list);
    }

    // 5. parent order (header linking the per-shop orders)
    const parent = await tx.query(
      `INSERT INTO orders
         (customer_user_id, status, payment_status, subtotal, discount, shipping_fee, total,
          address_snapshot, note, idempotency_key)
       VALUES ($1, 'pending', 'pending', $2, 0, $3, $4, $5::jsonb, $6, $7)
       RETURNING *`,
      [
        input.userId,
        round2(lines.reduce((s, l) => s + l.subtotal, 0)),
        shippingFee,
        round2(lines.reduce((s, l) => s + l.subtotal, 0) + shippingFee),
        JSON.stringify(addressSnapshot),
        parsed.note ?? null,
        `checkout-${cartId}`,
      ],
    );

    // 6. per-shop orders + items + commissions + payment
    const orders: CheckoutResult["orders"] = [];
    for (const [shopId, shopLines] of byShop) {
      const shopSubtotal = round2(shopLines.reduce((s, l) => s + l.subtotal, 0));
      const shopTotal = round2(shopSubtotal + shippingFee);
      const shopOrder = await tx.query(
        `INSERT INTO orders
           (customer_user_id, parent_order_id, seller_id, shop_id, status, payment_status,
            subtotal, discount, shipping_fee, total, address_snapshot, note, shipping_method, idempotency_key)
         VALUES ($1, $2, $3, $4, 'pending', 'unpaid', $5, 0, $6, $7, $8::jsonb, $9, $10, $11)
         RETURNING *`,
        [
          input.userId,
          parent.rows[0].id,
          shopLines[0].sellerId,
          shopId,
          shopSubtotal,
          shippingFee,
          shopTotal,
          JSON.stringify(addressSnapshot),
          parsed.note ?? null,
          parsed.shippingMethod,
          `checkout-${cartId}-${shopId}`,
        ],
      );

      for (const l of shopLines) {
        const item = await tx.query(
          `INSERT INTO order_items
             (order_id, product_id, shop_id, seller_id, product_name, unit,
              unit_price, quantity, subtotal, commission_rate, variant_id, variant_name, sku)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING id`,
          [
            shopOrder.rows[0].id,
            l.productId,
            l.shopId,
            l.sellerId,
            l.productName,
            l.unit,
            l.unitPrice,
            l.quantity,
            l.subtotal,
            l.commissionRate,
            l.variantId,
            null,
            null,
          ],
        );
        await tx.query(
          `INSERT INTO commissions
             (order_item_id, order_id, seller_id, shop_id, order_amount, commission_rate, commission_amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            item.rows[0].id,
            shopOrder.rows[0].id,
            l.sellerId,
            l.shopId,
            l.subtotal,
            l.commissionRate,
            round2(l.subtotal * l.commissionRate),
          ],
        );
      }

      await tx.query(
        `INSERT INTO payments (order_id, amount, method, status, user_id)
         VALUES ($1, $2, $3, 'pending', $4)`,
        [shopOrder.rows[0].id, shopTotal, parsed.paymentMethod, input.userId],
      );

      orders.push({
        orderId: shopOrder.rows[0].id,
        orderNumber: shopOrder.rows[0].order_number,
        shopId,
        sellerId: shopLines[0].sellerId,
        shopName: shopLines[0].shopName,
        subtotal: shopSubtotal,
        shippingFee,
        total: shopTotal,
      });
    }

    // 7. release cart (delete lines + mark checked out)
    await tx.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);
    await tx.query("UPDATE carts SET status = 'checked_out', updated_at = now() WHERE id = $1", [cartId]);

    return {
      parentOrderId: parent.rows[0].id,
      parentOrderNumber: parent.rows[0].order_number,
      orders,
      total: round2(orders.reduce((s, o) => s + o.total, 0)),
      itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    };
  });
}

