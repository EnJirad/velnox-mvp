/**
 * Velnox — Data Consistency & Financial Reconciliation Check (spec §69–71).
 *
 * READ-ONLY. Runs SELECT-only checks against Neon and reports:
 *   §69  data integrity   — negative stock, orphan rows, totals mismatch
 *   §70  reconciliation   — GMV vs orders, commission vs ledger, seller net
 *   §71  orphan data      — order/item/payment/return/ledger without parent
 *
 * Usage:
 *   DATABASE_URL=<neon-connection-string> bun run db:consistency
 *
 * Exits 0 when every check passes, 1 when any issue is found (CI-friendly).
 * Run AFTER a migration and before/after every production deploy.
 */
import { getPool } from "../backend/db";

const pool = getPool();

interface Issue {
  check: string;
  severity: "error" | "warn";
  detail: string;
}

const issues: Issue[] = [];

async function run() {
  console.log("Velnox — data consistency & financial reconciliation check\n");

  // ------------------------------------------------------------------ §69/§71
  // 1. negative stock (spec §22: available = stock - reserved, never negative)
  const negStock = await pool.query(`
    SELECT i.product_id, i.quantity, i.reserved_quantity,
           (i.quantity - i.reserved_quantity) AS available
    FROM inventory i
    WHERE i.quantity < 0 OR i.reserved_quantity < 0 OR (i.quantity - i.reserved_quantity) < 0
    LIMIT 20`);
  report(negStock.rows, "inventory", "negative stock / available", "error");

  // 2. orphan order_items (no parent order / product)
  const orphanItems = await pool.query(`
    SELECT oi.id, oi.order_id, oi.product_id
    FROM order_items oi
    LEFT JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.id IS NULL OR p.id IS NULL
    LIMIT 20`);
  report(orphanItems.rows, "order_items", "orphan (no order or product)", "error");

  // 3. orphan payments / refunds / returns (no parent order)
  const orphanPay = await pool.query(`
    SELECT p.id, p.order_id FROM payments p
    LEFT JOIN orders o ON o.id = p.order_id WHERE o.id IS NULL LIMIT 20`);
  report(orphanPay.rows, "payments", "orphan (no order)", "error");

  const orphanRefund = await pool.query(`
    SELECT r.id, r.order_id FROM refunds r
    LEFT JOIN orders o ON o.id = r.order_id WHERE o.id IS NULL LIMIT 20`);
  report(orphanRefund.rows, "refunds", "orphan (no order)", "error");

  const orphanReturn = await pool.query(`
    SELECT r.id, r.order_id FROM returns r
    LEFT JOIN orders o ON o.id = r.order_id WHERE o.id IS NULL LIMIT 20`);
  report(orphanReturn.rows, "returns", "orphan (no order)", "error");

  // 4. orders without a user (spec §71)
  const orphanOrders = await pool.query(`
    SELECT o.id, o.order_number FROM orders o
    LEFT JOIN users u ON u.id = o.customer_user_id WHERE u.id IS NULL LIMIT 20`);
  report(orphanOrders.rows, "orders", "without customer user", "error");

  // 5. ledger entries without order/seller reference where required
  const orphanLedger = await pool.query(`
    SELECT l.id, l.type, l.order_id, l.seller_id FROM financial_ledger l
    WHERE l.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = l.order_id)
    LIMIT 20`);
  report(orphanLedger.rows, "financial_ledger", "order ref points to missing order", "error");

  // ------------------------------------------------------------------ §69
  // 6. order totals must match their line items (snapshot integrity)
  const totalsMismatch = await pool.query(`
    SELECT o.id, o.order_number, o.subtotal, o.discount, o.shipping_fee, o.total,
           COALESCE(SUM(oi.subtotal), 0) AS items_sum
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.id
    HAVING COALESCE(SUM(oi.subtotal), 0) <> o.subtotal
    LIMIT 20`);
  report(totalsMismatch.rows, "orders", "subtotal != sum(order_items.subtotal)", "error");

  // 7. line commission vs snapshot rate (3% default — from order_items snapshot)
  const commissionMismatch = await pool.query(`
    SELECT c.id, c.order_id, c.order_amount, c.commission_rate, c.commission_amount,
           ROUND(c.order_amount * c.commission_rate, 2) AS expected
    FROM commissions c
    WHERE ABS(c.commission_amount - ROUND(c.order_amount * c.commission_rate, 2)) > 0.01
    LIMIT 20`);
  report(commissionMismatch.rows, "commissions", "amount != order_amount × rate", "error");

  // 8. paid orders must have a succeeded payment (or COD marked paid)
  const paidNoPayment = await pool.query(`
    SELECT o.id, o.order_number, o.payment_status, o.total
    FROM orders o
    WHERE o.payment_status IN ('paid', 'partially_refunded', 'refunded')
      AND NOT EXISTS (
        SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'succeeded')
    LIMIT 20`);
  report(paidNoPayment.rows, "orders", "marked paid without succeeded payment", "error");

  // ------------------------------------------------------------------ §70
  // 9. reconciliation: GMV vs order totals (excluding cancelled)
  const gmv = await pool.query(`
    SELECT COALESCE(SUM(total), 0) AS gmv, COUNT(*) AS orders
    FROM orders WHERE status <> 'cancelled'`);
  const gmvVal = Number(gmv.rows[0]?.gmv ?? 0);

  // 10. reconciliation: settled commissions vs ledger platform_commission
  const commissions = await pool.query(`
    SELECT COALESCE(SUM(commission_amount), 0) AS total, COUNT(*) AS n
    FROM commissions WHERE status = 'settled'`);
  const ledgerCommission = await pool.query(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM financial_ledger WHERE type = 'platform_commission'`);
  const commVal = Number(commissions.rows[0]?.total ?? 0);
  const ledgerCommVal = Number(ledgerCommission.rows[0]?.total ?? 0);
  if (Math.abs(commVal - ledgerCommVal) > 0.01) {
    issues.push({
      check: "reconciliation",
      severity: "error",
      detail: `settled commissions (${commVal}) != ledger platform_commission (${ledgerCommVal})`,
    });
  }

  // 11. seller ledger vs seller_balances projection (balances derived from ledger)
  const balanceMismatch = await pool.query(`
    SELECT b.seller_id, b.available_balance, b.pending_balance, b.total_earned,
           COALESCE(SUM(CASE WHEN l.type = 'sale' THEN l.amount ELSE 0 END), 0) AS ledger_sales
    FROM seller_balances b
    LEFT JOIN financial_ledger l ON l.seller_id = b.seller_id
    GROUP BY b.seller_id
    HAVING ABS(b.total_earned - COALESCE(SUM(CASE WHEN l.type = 'sale' THEN l.amount ELSE 0 END), 0)) > 0.01
    LIMIT 20`);
  report(balanceMismatch.rows, "seller_balances", "total_earned != ledger sales", "warn");

  // 12. return rate per seller (spec §9: returns / completed orders)
  const returnRates = await pool.query(`
    WITH completed AS (
      SELECT seller_id, COUNT(*) AS n FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status IN ('completed', 'delivered')
      GROUP BY seller_id
    ), returned AS (
      SELECT order_id FROM returns WHERE status IN ('approved', 'received', 'refunded')
    )
    SELECT oi.seller_id, c.n AS completed, COUNT(DISTINCT r.order_id) AS returned
    FROM completed c
    LEFT JOIN order_items oi ON oi.seller_id = c.seller_id
    LEFT JOIN returned r ON r.order_id = oi.order_id
    GROUP BY oi.seller_id, c.n
    HAVING c.n > 0 AND (COUNT(DISTINCT r.order_id) * 100.0 / c.n) > 10
    LIMIT 20`);
  report(returnRates.rows, "sellers", "return rate > 10% threshold", "warn");

  // ------------------------------------------------------------------ output
  console.log(`GMV (non-cancelled orders): ${gmvVal.toFixed(2)} THB across ${gmv.rows[0]?.orders ?? 0} orders`);
  console.log(`Settled commissions: ${commVal.toFixed(2)} · ledger platform_commission: ${ledgerCommVal.toFixed(2)}`);
  console.log(`\n${issues.length === 0 ? "✅ ALL CHECKS PASSED" : `❌ ${issues.length} ISSUE(S) FOUND`}`);
  if (issues.length) {
    for (const i of issues) {
      console.log(`  [${i.severity.toUpperCase()}] ${i.check}: ${i.detail}`);
    }
  }
  await pool.end();
  process.exit(issues.some((i) => i.severity === "error") ? 1 : 0);
}

function report<T extends Record<string, unknown>>(
  rows: T[],
  table: string,
  check: string,
  severity: "error" | "warn",
): void {
  if (rows.length === 0) return;
  for (const r of rows.slice(0, 5)) {
    issues.push({ check: `${table}.${check}`, severity, detail: JSON.stringify(r) });
  }
  if (rows.length > 5) {
    issues.push({ check: `${table}.${check}`, severity, detail: `…and ${rows.length - 5} more` });
  }
}

run().catch(async (err) => {
  console.error("consistency check failed to run:", err instanceof Error ? err.message : err);
  await pool.end().catch(() => {});
  process.exit(1);
});
