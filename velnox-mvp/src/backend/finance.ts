/**
 * Velnox Backend — Finance (spec §26–30, §35–37).
 *
 * financial_ledger is the source of truth for money. Every business money
 * event writes ledger entries (never hard-deleted — corrections are new
 * ADJUSTMENT entries). Reports are computed server-side from Neon + rules;
 * frontends only display. Platform commission %, shipping share and return
 * threshold come from platform_settings via rules.ts — never hard-coded.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
import type { Db } from "./db";
import { withTransaction } from "./db";
import { AppError } from "./errors";
import {
  calcPlatformFee,
  calcReturnRatePercent,
  calcSellerNet,
  calcSellerReturnCost,
  round2,
  resolveRules,
} from "./rules";
import type { LedgerEntry, LedgerType, SellerBalance, SellerPayout } from "./types";

// ---------------------------------------------------------------------------
// ledger
// ---------------------------------------------------------------------------
export async function writeLedger(
  db: Db,
  input: {
    transactionId?: string | null;
    orderId?: string | null;
    sellerId?: string | null;
    type: LedgerType;
    amount: number; // signed: + income / − expense
    description?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<LedgerEntry> {
  const rows = await db(
    `INSERT INTO financial_ledger (transaction_id, order_id, seller_id, type, amount, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [
      input.transactionId ?? null,
      input.orderId ?? null,
      input.sellerId ?? null,
      input.type,
      round2(input.amount),
      input.description ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  const r = rows[0];
  return {
    id: r.id,
    transactionId: r.transaction_id ?? null,
    orderId: r.order_id ?? null,
    sellerId: r.seller_id ?? null,
    type: r.type,
    amount: Number(r.amount),
    currency: r.currency,
    description: r.description ?? null,
    createdAt: r.created_at,
  };
}

// ---------------------------------------------------------------------------
// seller financial report (spec §26, §28)
// ---------------------------------------------------------------------------
export interface SellerFinancialReport {
  grossSales: number;
  grossOrders: number;
  discounts: number;
  platformFee: number;
  returnFee: number; // seller's excess return cost (beyond threshold)
  shippingRelatedFee: number;
  sellerNetIncome: number;
  pendingPayout: number;
  paidOut: number;
  returnRatePercent: number;
  completedOrders: number;
  returnedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  rules: { commissionPercent: number; returnThresholdPercent: number; shippingCompanyPercent: number };
  transactions: Array<{
    orderId: string;
    orderNumber: string;
    subtotal: number;
    status: string;
    createdAt: string;
  }>;
}

export async function sellerFinancialReport(db: Db, sellerId: string, limit = 100): Promise<SellerFinancialReport> {
  const rules = await resolveRules(db);
  const commissionPercent = rules.platformCommissionPercent;
  const threshold = rules.returnRateThreshold;

  const orders = await db(
    `SELECT DISTINCT o.id, o.order_number, o.status, o.created_at,
            COALESCE(SUM(oi.subtotal) FILTER (WHERE oi.seller_id = $1), 0) AS subtotal
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id AND oi.seller_id = $1
     GROUP BY o.id, o.order_number, o.status, o.created_at
     ORDER BY o.created_at DESC
     LIMIT $2`,
    [sellerId, limit],
  );

  let grossSales = 0;
  let grossOrders = 0;
  let completedOrders = 0;
  let returnedOrders = 0;
  let pendingOrders = 0;
  let cancelledOrders = 0;
  let returnsValue = 0;
  const transactions: SellerFinancialReport["transactions"] = [];

  for (const o of orders) {
    const subtotal = Number(o.subtotal);
    if (o.status === "completed") {
      grossSales = round2(grossSales + subtotal);
      grossOrders += 1;
      completedOrders += 1;
      transactions.push({ orderId: o.id, orderNumber: o.order_number, subtotal, status: o.status, createdAt: o.created_at });
    } else if (o.status === "return_requested" || o.status === "returned") {
      returnsValue = round2(returnsValue + subtotal);
      returnedOrders += 1;
    } else if (o.status === "cancelled") {
      cancelledOrders += 1;
    } else {
      pendingOrders += 1;
    }
  }

  const platformFee = calcPlatformFee(grossSales, commissionPercent);
  const returnFee = calcSellerReturnCost(grossSales, returnsValue, threshold);
  const shippingRelatedFee = 0; // set when shipping is configured (Phase 8)
  const sellerNetIncome = calcSellerNet(grossSales, platformFee, returnFee, shippingRelatedFee);
  const returnRatePercent = calcReturnRatePercent(returnedOrders, completedOrders);

  const payout = await db(
    `SELECT COALESCE(SUM(CASE WHEN status IN ('pending','processing') THEN amount ELSE 0 END), 0) AS pending,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) AS paid
     FROM seller_payouts WHERE seller_id = $1`,
    [sellerId],
  );

  return {
    grossSales,
    grossOrders,
    discounts: 0,
    platformFee,
    returnFee,
    shippingRelatedFee,
    sellerNetIncome,
    pendingPayout: Number(payout[0].pending),
    paidOut: Number(payout[0].paid),
    returnRatePercent,
    completedOrders,
    returnedOrders,
    pendingOrders,
    cancelledOrders,
    rules: { commissionPercent, returnThresholdPercent: threshold, shippingCompanyPercent: rules.shippingCompanyPercent },
    transactions,
  };
}

// ---------------------------------------------------------------------------
// platform revenue (spec §27, §29)
// ---------------------------------------------------------------------------
export interface PlatformRevenueReport {
  gmv: number;
  orderCount: number;
  platformFee: number;
  shippingRevenue: number;
  refunds: number;
  penalties: number;
  netRevenue: number;
  activeSellers: number;
  activeCustomers: number;
  returnRatePercent: number;
  byPeriod: Array<{ period: string; gmv: number; platformFee: number }>;
}

export async function platformRevenueReport(db: Db): Promise<PlatformRevenueReport> {
  const rules = await resolveRules(db);
  const commissionPercent = rules.platformCommissionPercent;

  const gross = await db(
    `SELECT COALESCE(SUM(total), 0) AS gmv, COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE status IN ('return_requested','returned'))::int AS returns,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
     FROM orders WHERE parent_order_id IS NULL AND status <> 'cancelled'`,
  );
  const gmv = Number(gross[0].gmv);
  const completed = Number(gross[0].completed);
  const returns = Number(gross[0].returns);

  const refunds = await db(`SELECT COALESCE(SUM(amount), 0) AS n FROM refunds WHERE status IN ('processed','approved')`);
  const sellers = await db(`SELECT COUNT(*)::int AS n FROM sellers WHERE status = 'approved'`);
  const customers = await db(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'customer'`);

  const byPeriod = await db(
    `SELECT to_char(created_at, 'YYYY-MM') AS period,
            COALESCE(SUM(total), 0) AS gmv
     FROM orders WHERE parent_order_id IS NULL AND status <> 'cancelled'
     GROUP BY period ORDER BY period DESC LIMIT 12`,
  );

  const platformFee = calcPlatformFee(gmv, commissionPercent);
  const shippingRevenue = round2((gmv * rules.shippingCompanyPercent) / 100);
  const netRevenue = round2(platformFee + shippingRevenue - Number(refunds[0].n));

  return {
    gmv,
    orderCount: Number(gross[0].n),
    platformFee,
    shippingRevenue,
    refunds: Number(refunds[0].n),
    penalties: 0,
    netRevenue,
    activeSellers: Number(sellers[0].n),
    activeCustomers: Number(customers[0].n),
    returnRatePercent: calcReturnRatePercent(returns, completed),
    byPeriod: byPeriod.map((r: any) => ({ period: r.period, gmv: Number(r.gmv), platformFee: calcPlatformFee(Number(r.gmv), commissionPercent) })),
  };
}

// ---------------------------------------------------------------------------
// seller balances + payouts (spec §35–36)
// ---------------------------------------------------------------------------
export async function getSellerBalance(db: Db, sellerId: string): Promise<SellerBalance | null> {
  const rows = await db(
    `SELECT * FROM seller_balances WHERE seller_id = $1 LIMIT 1`,
    [sellerId],
  );
  if (!rows[0]) return null;
  return {
    sellerId: rows[0].seller_id,
    availableBalance: Number(rows[0].available_balance),
    pendingBalance: Number(rows[0].pending_balance),
    totalEarned: Number(rows[0].total_earned),
    totalWithdrawn: Number(rows[0].total_withdrawn),
    currency: rows[0].currency,
    updatedAt: rows[0].updated_at,
  };
}

export interface RequestPayoutInput {
  sellerId: string;
  amount: number;
  method?: string | null;
  destination?: string | null;
}

/** Seller requests a payout from their available balance. */
export async function requestPayout(db: Db, input: RequestPayoutInput): Promise<SellerPayout> {
  if (input.amount <= 0) throw new AppError("INVALID_INPUT", "จำนวนเงินต้องมากกว่า 0");
  return withTransaction(async (tx) => {
    const bal = await tx.query("SELECT available_balance FROM seller_balances WHERE seller_id = $1 FOR UPDATE", [
      input.sellerId,
    ]);
    if (!bal.rows[0]) throw new AppError("NOT_FOUND", "ไม่พบยอดเงินร้านค้า");
    const available = Number(bal.rows[0].available_balance);
    if (input.amount > available) throw new AppError("FORBIDDEN", `ยอดขอถอนเกินยอดที่มี (${round2(available)} ${bal.rows[0].currency})`);

    await tx.query(
      `UPDATE seller_balances
       SET available_balance = available_balance - $2,
           pending_balance = pending_balance + $2,
           updated_at = now()
       WHERE seller_id = $1`,
      [input.sellerId, round2(input.amount)],
    );
    const rows = await tx.query(
      `INSERT INTO seller_payouts (seller_id, amount, method, destination, status, requested_at)
       VALUES ($1, $2, $3, $4, 'pending', now())
       RETURNING *`,
      [input.sellerId, round2(input.amount), input.method ?? null, input.destination ?? null],
    );
    await tx.query(
      `INSERT INTO financial_ledger (seller_id, type, amount, description, metadata)
       VALUES ($1, 'seller_payout', $2, 'Payout requested', $3::jsonb)`,
      [input.sellerId, -round2(input.amount), JSON.stringify({ payoutId: rows.rows[0].id })],
    );
    return mapPayout(rows.rows[0]);
  });
}

/** Admin/owner processes a payout (moves pending -> completed/failed). */
export async function processPayout(db: Db, payoutId: string, status: "completed" | "failed" | "cancelled"): Promise<SellerPayout> {
  return withTransaction(async (tx) => {
    const rows = await tx.query("SELECT * FROM seller_payouts WHERE id = $1 FOR UPDATE", [payoutId]);
    if (!rows.rows[0]) throw new AppError("NOT_FOUND", "ไม่พบ payout");
    const payout = mapPayout(rows.rows[0]);
    if (payout.status !== "pending" && payout.status !== "processing") {
      throw new AppError("INVALID_STATUS_TRANSITION", "payout นี้ถูกจัดการไปแล้ว");
    }

    if (status === "completed") {
      await tx.query(
        `UPDATE seller_balances
         SET pending_balance = GREATEST(pending_balance - $2, 0),
             total_withdrawn = total_withdrawn + $2,
             updated_at = now()
         WHERE seller_id = $1`,
        [payout.sellerId, payout.amount],
      );
      await tx.query(
        `INSERT INTO financial_ledger (seller_id, type, amount, description, metadata)
         VALUES ($1, 'seller_payout', $2, 'Payout completed', $3::jsonb)`,
        [payout.sellerId, -payout.amount, JSON.stringify({ payoutId })],
      );
    } else if (status === "failed" || status === "cancelled") {
      // return the money to available
      await tx.query(
        `UPDATE seller_balances
         SET available_balance = available_balance + $2,
             pending_balance = GREATEST(pending_balance - $2, 0),
             updated_at = now()
         WHERE seller_id = $1`,
        [payout.sellerId, payout.amount],
      );
    }

    const updated = await tx.query(
      `UPDATE seller_payouts SET status = $2, processed_at = now() WHERE id = $1 RETURNING *`,
      [payoutId, status],
    );
    return mapPayout(updated.rows[0]);
  });
}

export async function listPayouts(db: Db, sellerId?: string, limit = 50): Promise<SellerPayout[]> {
  const rows = sellerId
    ? await db("SELECT * FROM seller_payouts WHERE seller_id = $1 ORDER BY created_at DESC LIMIT $2", [sellerId, limit])
    : await db("SELECT * FROM seller_payouts ORDER BY created_at DESC LIMIT $1", [limit]);
  return rows.map(mapPayout);
}

function mapPayout(r: Record<string, any>): SellerPayout {
  return {
    id: r.id,
    sellerId: r.seller_id,
    amount: Number(r.amount),
    currency: r.currency,
    status: r.status,
    method: r.method ?? null,
    destination: r.destination ?? null,
    requestedAt: r.requested_at,
    processedAt: r.processed_at ?? null,
    createdAt: r.created_at,
  };
}

/** Rebuild a seller's balance from the ledger (idempotent recompute). */
export async function recomputeSellerBalance(db: Db, sellerId: string): Promise<void> {
  const rows = await db(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE type IN ('sale','adjustment')), 0) AS earned,
       COALESCE(SUM(amount) FILTER (WHERE type = 'seller_payout'), 0) AS withdrawn
     FROM financial_ledger WHERE seller_id = $1`,
    [sellerId],
  );
  const earned = Number(rows[0].earned);
  const withdrawn = Math.abs(Number(rows[0].withdrawn));
  await db(
    `INSERT INTO seller_balances (seller_id, available_balance, pending_balance, total_earned, total_withdrawn, updated_at)
     VALUES ($1, GREATEST($2 - $3, 0), 0, $2, $3, now())
     ON CONFLICT (seller_id) DO UPDATE SET
       available_balance = GREATEST(EXCLUDED.total_earned - EXCLUDED.total_withdrawn, 0),
       pending_balance = 0,
       total_earned = EXCLUDED.total_earned,
       total_withdrawn = EXCLUDED.total_withdrawn,
       updated_at = now()`,
    [sellerId, round2(earned), round2(withdrawn)],
  );
}
