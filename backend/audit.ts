/**
 * Velnox Backend — Audit Log (spec §48).
 *
 * Append-only: rows are INSERTed, never updated or deleted. Every important
 * action (approve seller, edit product, change settings, refund, ...) calls
 * audit() so VelCenter can answer "ใคร ทำอะไร กับอะไร เมื่อไหร่".
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- JSONB payloads */
import type { Db } from "./db";

export interface AuditInput {
  actorId: string | null;
  actorRole: string | null;
  action: string; // e.g. ADMIN_APPROVED_SELLER, SELLER_UPDATED_PRODUCT
  entityType?: string;
  entityId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function audit(db: Db, input: AuditInput): Promise<void> {
  await db(
    `INSERT INTO audit_logs
       (actor_id, actor_role, action, entity_type, entity_id, before, after, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
    [
      input.actorId,
      input.actorRole,
      input.action,
      input.entityType ?? null,
      input.entityId ?? null,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
      input.ipAddress ?? null,
      input.userAgent ?? null,
    ],
  );
}

export interface ListAuditOptions {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
}

export async function listAuditLogs(db: Db, opts: ListAuditOptions = {}): Promise<any[]> {
  const where: string[] = [];
  const values: unknown[] = [];
  if (opts.actorId) {
    values.push(opts.actorId);
    where.push(`actor_id = $${values.length}`);
  }
  if (opts.entityType) {
    values.push(opts.entityType);
    where.push(`entity_type = $${values.length}`);
  }
  if (opts.entityId) {
    values.push(opts.entityId);
    where.push(`entity_id = $${values.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  values.push(limit, offset);
  return db(
    `SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
}
