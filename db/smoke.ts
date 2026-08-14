/**
 * Velnox Commerce Core — end-to-end smoke test against the real Neon DB.
 *
 *   DATABASE_URL='postgresql://...' bun run db:smoke
 *
 * Runs the full flow through the backend services and removes all test rows
 * afterwards (orders cascade payments/commissions/items, products cascade
 * inventory/images). Exits non-zero on any failed assertion.
 */
import WebSocket from "ws";
import { getDb, getPool } from "../src/backend/db";
import { findOrCreateUser, createSeller, createShop, listShopsBySeller } from "../src/backend/sellers";
import { createProduct, getProduct, addProductImage, setPrimaryProductImage, listProductImages } from "../src/backend/products";
import { createOrder, cancelOrder, updateOrderStatus, sellerIncome, listOrdersForSeller, listOrdersForCustomer } from "../src/backend/orders";
import { recordPayment, refundPayment } from "../src/backend/payments";
import { createSubscription, listSubscriptionsBySeller, getDueSubscriptions, advanceSubscription, computeNextOrderDate } from "../src/backend/subscriptions";

let passed = 0;
function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`❌ ASSERT FAILED: ${label}`);
  passed++;
  console.log(`  ✔ ${label}`);
}

async function main() {
  if (typeof (globalThis as any).WebSocket === "undefined") {
    const { neonConfig } = await import("@neondatabase/serverless");
    neonConfig.webSocketConstructor = WebSocket as any;
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required (inline it, e.g. DATABASE_URL='...' bun run db:smoke)");
    process.exit(1);
  }

  const db = getDb();
  const pool = getPool();
  const tag = `smoke-${Date.now()}`;
  console.log(`🧪 Velnox Commerce Core smoke test (${tag})\n`);

  try {
    // ---- 1. user -> seller -> shop ----------------------------------------
    console.log("1) User → Seller → Shop");
    const user = await findOrCreateUser(db, { convexId: tag, email: `${tag}@velnox.test`, name: "Smoke Seller", role: "seller" });
    const seller = await createSeller(db, { ownerUserId: user.id, name: "Smoke Shop Co.", taxId: "0000000000000" });
    const shop = await createShop(db, { sellerId: seller.id, name: "Smoke Shop", slug: tag, commissionRate: 0.03 });
    assert(seller.ownerUserId === user.id, "seller owns user");
    assert((await listShopsBySeller(db, seller.id)).length === 1, "seller has 1 shop");

    // ---- 2. product + image + inventory ------------------------------------
    console.log("2) Product + images + inventory");
    const product = await createProduct(db, {
      shopId: shop.id,
      name: "Smoke Shampoo",
      price: 100,
      category: "beauty",
      unit: "ขวด",
      status: "published",
      initialStock: 50,
    });
    assert(product.inventory?.quantity === 50, "inventory seeded at 50");
    const img1 = await addProductImage(db, product.id, { url: "https://res.cloudinary.com/cvgpeyvc/image/upload/smoke-1.jpg", storageKey: "smoke-1" });
    const img2 = await addProductImage(db, product.id, { url: "https://res.cloudinary.com/cvgpeyvc/image/upload/smoke-2.jpg", storageKey: "smoke-2" });
    assert(img1.isPrimary === true, "first image becomes primary");
    assert((await listProductImages(db, product.id)).length === 2, "2 images stored");
    await setPrimaryProductImage(db, product.id, img2.id);
    const detail = await getProduct(db, product.id);
    assert(detail?.primaryImage?.id === img2.id, "primary image switched");

    // ---- 3. order (reserve + snapshots + commission + payment) --------------
    console.log("3) Order: reserve / snapshots / commission / payment");
    const customer = await findOrCreateUser(db, { convexId: `${tag}-customer`, email: `${tag}-c@velnox.test`, name: "Smoke Customer" });
    const order = await createOrder({
      customerUserId: customer.id,
      items: [{ productId: product.id, quantity: 3 }],
      addressSnapshot: { recipientName: "Smoke Customer", phone: "0810000000", line1: "1 Test Rd", city: "Bangkok", country: "TH" },
      idempotencyKey: `${tag}-order-1`,
      paymentMethod: "cod",
    });
    assert(order.total === 300, `order total 300 (got ${order.total})`);
    assert(order.items?.[0]?.unitPrice === 100 && order.items[0].productName === "Smoke Shampoo", "price/name snapshot frozen");
    assert(order.items?.[0]?.sellerId === seller.id, "order item links seller");

    const invAfter = (await getProduct(db, product.id))?.inventory;
    assert(invAfter?.reservedQuantity === 3, "3 units reserved");

    const commissions = await pool.query("SELECT * FROM commissions WHERE order_id = $1", [order.id]);
    assert(commissions.rows.length === 1, "commission row created");
    assert(Number(commissions.rows[0].commission_amount) === 9, `commission = 3% (got ${commissions.rows[0].commission_amount})`);
    const payments = await pool.query("SELECT * FROM payments WHERE order_id = $1", [order.id]);
    assert(payments.rows.length === 1 && payments.rows[0].status === "pending", "pending COD payment row");

    const dup = await createOrder({
      customerUserId: customer.id,
      items: [{ productId: product.id, quantity: 3 }],
      addressSnapshot: { recipientName: "Smoke Customer", phone: "0810000000", line1: "1 Test Rd" },
      idempotencyKey: `${tag}-order-1`,
      paymentMethod: "cod",
    });
    assert(dup.id === order.id, "idempotency: retry returns the same order");

    // ---- 4. payment + shipment -> stock deduction ---------------------------
    console.log("4) Payment + shipment deducts stock");
    const payment = await recordPayment({ orderId: order.id, amount: 300, method: "cod", status: "succeeded" });
    const paidOrder = (await pool.query("SELECT payment_status FROM orders WHERE id = $1", [order.id])).rows[0];
    assert(paidOrder.payment_status === "paid", "order marked paid");
    await updateOrderStatus({ orderId: order.id, status: "confirmed", paymentStatus: "paid" });
    const shipped = await updateOrderStatus({ orderId: order.id, status: "shipped" });
    assert(shipped.shippingStatus === "shipped" || shipped.status === "shipped", "order shipped");
    const invShipped = (await getProduct(db, product.id))?.inventory;
    assert(invShipped?.quantity === 47 && invShipped.reservedQuantity === 0, "stock deducted on ship (47 left)");

    // illegal transition: shipped -> cancelled must be rejected
    let rejected = false;
    try {
      await updateOrderStatus({ orderId: order.id, status: "cancelled" });
    } catch {
      rejected = true;
    }
    assert(rejected, "state machine rejects shipped → cancelled");
    await updateOrderStatus({ orderId: order.id, status: "delivered" });
    await updateOrderStatus({ orderId: order.id, status: "completed" });

    // ---- 5. cancellation releases reservation --------------------------------
    console.log("5) Cancel releases reserved stock");
    const order2 = await createOrder({
      customerUserId: customer.id,
      items: [{ productId: product.id, quantity: 4 }],
      addressSnapshot: { recipientName: "Smoke Customer", phone: "0810000000", line1: "1 Test Rd" },
      idempotencyKey: `${tag}-order-2`,
      paymentMethod: "cod",
    });
    const cancelled = await cancelOrder(order2.id);
    assert(cancelled.status === "cancelled", "order2 cancelled");
    const invAfterCancel = (await getProduct(db, product.id))?.inventory;
    assert(invAfterCancel?.reservedQuantity === 0, "reservation released after cancel");

    // ---- 6. seller income report ---------------------------------------------
    console.log("6) Seller income report");
    const ordersCols = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position`,
    );
    console.log("  orders columns:", ordersCols.rows.map((r) => r.column_name).join(", "));
    const income = await sellerIncome(db, seller.id);
    assert(income.gross === 300, `gross 300 (got ${income.gross})`);
    assert(income.commission === 9, `commission 9 (got ${income.commission})`);
    assert(income.payout === 291, `payout 291 (got ${income.payout})`);
    assert(income.transactions.length === 1, `1 transaction (completed only; got ${income.transactions.length})`);
    assert((await listOrdersForSeller(db, seller.id)).length === 2, "seller sees both orders");
    assert((await listOrdersForCustomer(db, customer.id)).length === 2, "customer sees both orders");

    // refund flow: full refund voids the commission
    const refund = await refundPayment({ orderId: order.id, amount: 300, reason: "smoke" });
    assert(refund.status === "processed", "refund processed");
    const commAfter = await pool.query("SELECT status FROM commissions WHERE order_id = $1", [order.id]);
    assert(commAfter.rows[0].status === "voided", "commission voided on full refund");

    // ---- 7. VelRepeat subscription -------------------------------------------
    console.log("7) VelRepeat subscription");
    const nextDate = computeNextOrderDate("monthly", new Date());
    const sub = await createSubscription(db, {
      customerUserId: customer.id,
      productId: product.id,
      quantity: 2,
      frequency: "monthly",
      intervalDays: 30,
      nextOrderDate: nextDate,
    });
    assert(sub.sellerId === seller.id, "subscription links seller");
    assert((await listSubscriptionsBySeller(db, seller.id)).length === 1, "seller sees subscription");
    const due = await getDueSubscriptions(db, nextDate);
    assert(due.some((s) => s.id === sub.id), "subscription is due on its date");
    const advanced = await advanceSubscription(db, sub.id);
    assert(advanced!.nextOrderDate > sub.nextOrderDate, "next order date advanced");

    console.log(`\n🎉 All ${passed} assertions passed. Cleaning up test data…`);
  } finally {
    // ---- cleanup (reverse dependency order) ----------------------------------
    await pool.query(`DELETE FROM orders WHERE customer_user_id IN (SELECT id FROM users WHERE convex_id LIKE '${tag}%')`);
    await pool.query(`DELETE FROM subscriptions WHERE customer_user_id IN (SELECT id FROM users WHERE convex_id LIKE '${tag}%')`);
    await pool.query(`DELETE FROM products WHERE shop_id IN (SELECT id FROM shops WHERE slug = $1)`, [tag]);
    await pool.query(`DELETE FROM shops WHERE slug = $1`, [tag]);
    await pool.query(`DELETE FROM sellers WHERE name = 'Smoke Shop Co.' AND created_at > now() - interval '10 minutes'`);
    await pool.query(`DELETE FROM users WHERE convex_id LIKE '${tag}%'`);
    console.log("🧹 Test data removed.");
  }
  await getPool().end();
  console.log("✅ Smoke test complete.");
}

main().catch(async (err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  await getPool().end().catch(() => {});
  process.exit(1);
});
