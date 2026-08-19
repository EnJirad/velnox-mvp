/**
 * Velnox Backend — Notifications (spec §45–46).
 *
 * In-app notifications for order/payment/shipping/return/refund/promotion/
 * system/seller events. Created by the backend when business events happen;
 * customers/sellers read their own. (Email/push delivery is a Phase 10
 * integration — the data model is ready now.)
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
import type { Db } from "./db";
import { toMs } from "./dates";
import type { Notification } from "./types";

const VALID_TYPES = ["order", "payment", "shipping", "return", "refund", "promotion", "system", "seller"] as const;
export type NotificationType = (typeof VALID_TYPES)[number];

function mapNotification(r: Record<string, any>): Notification {
  const data = r.data && typeof r.data === "string" ? JSON.parse(r.data) : (r.data ?? {});
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type,
    title: r.title,
    message: r.message ?? null,
    data,
    isRead: Boolean(r.is_read),
    createdAt: toMs(r.created_at),
  };
}

export async function createNotification(
  db: Db,
  input: { userId: string; type: NotificationType; title: string; message?: string | null; data?: Record<string, unknown> },
): Promise<Notification> {
  if (!VALID_TYPES.includes(input.type)) throw new Error(`Invalid notification type: ${input.type}`);
  const rows = await db(
    `INSERT INTO notifications (user_id, type, title, message, data)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING *`,
    [input.userId, input.type, input.title, input.message ?? null, JSON.stringify(input.data ?? {})],
  );
  return mapNotification(rows[0]);
}

export async function listNotifications(db: Db, userId: string, limit = 30): Promise<Notification[]> {
  const rows = await db(
    "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [userId, limit],
  );
  return rows.map(mapNotification);
}

export async function unreadCount(db: Db, userId: string): Promise<number> {
  const rows = await db(
    "SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = false",
    [userId],
  );
  return Number(rows[0].n);
}

export async function markNotificationRead(db: Db, userId: string, notificationId: string): Promise<void> {
  await db("UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2", [notificationId, userId]);
}

export async function markAllRead(db: Db, userId: string): Promise<void> {
  await db("UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false", [userId]);
}
