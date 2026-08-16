# Velnox — Disaster Recovery

> Canonical recovery document. Detailed legacy docs: [`DATABASE-RECOVERY.md`](./DATABASE-RECOVERY.md)
> · `docs/production/backup.md` · `docs/production/incident-response.md` ·
> `docs/production/rollback.md`.

## 1. Backup strategy

| Asset | Primary | Secondary | Retention |
|---|---|---|---|
| Neon (Commerce Core + durable events) | Neon built-in PITR (default ~7 days) + branches | scheduled `pg_dump` (daily × 30, weekly × 12, monthly × 12) to independent storage | ≥ 7 d PITR; dumps long-term |
| Convex (auth sessions, intelligence, notifications) | Convex managed deployment | periodic export of derived tables (rebuildable anyway) | rebuildable from Neon + events |
| Product images (Cloudinary) | Cloudinary managed | Cloudinary export per policy | per policy |
| Code + `_generated` | Git (GitHub) | — | forever |
| Secrets / env | Keys/API keys UI + Convex deployment env | documented list (never committed) | — |

**Rule: a backup that has never been restore-tested is not a backup.** Before launch, restore a
Neon dump to a branch and run `bun run db:smoke` + `bun run db:consistency`.

## 2. Internal RPO / RTO targets (MVP)

| Metric | Target | Basis |
|---|---|---|
| RPO (Neon) | ≤ 5 min | Neon PITR |
| RPO (dumps) | ≤ 24 h | daily pg_dump |
| RPO (events) | ≤ 15 min | cron flush window |
| RTO (database) | ≤ 30 min | restore to branch → promote → swap `DATABASE_URL` |
| RTO (Convex) | ≤ 1 h | redeploy + rebuild derived layer |

These are internal targets, not customer guarantees.

## 3. Recovery scenarios

| Scenario | Detection | Response | Recovery | Rollback | Verify |
|---|---|---|---|---|---|
| **1. Vercel unavailable** | monitoring alerts | incident response | rollback to last good deploy / redeploy | `vercel rollback` | smoke test |
| **2. Neon unavailable** | `/health` ok but commerce queries fail; Neon console alerts | freeze deploys | PITR/branch restore → promote → swap `DATABASE_URL` (Convex env) | keep old branch 24 h | `db:smoke`, `db:consistency` |
| **3. Convex unavailable** | UI errors, `/health` on Convex URL fails | keep serving static UI; writes queue/fail visibly | redeploy Convex (same env) → **rebuild derived layer from `behavioral_events` + Neon** | previous Convex deployment | memory/recommendation check |
| **4. Domain/DNS** | DNS checks fail, cert errors | verify registrar + Vercel DNS | re-add records, wait propagation, re-issue SSL | old provider records until TTL | open all 4 URLs |
| **5. Database corruption** | consistency check fails | stop writes | restore newest clean backup to branch, promote after integrity check | keep corrupt DB for forensics | `db:consistency` = 0 issues |
| **6. Accidental deletion** | user report / audit | — | PITR to just-before-deletion; reconcile ledger (append-only adjustments) | — | row counts + ledger vs orders |
| **7. Credential leak** | rotation policy | revoke + rotate immediately | rotate `DATABASE_URL`, `CLOUDINARY_*`, JWT keys; remove from history | — | auth + storage smoke |
| **8. Backend failure** | elevated errors, Sentry | freeze feature deploys | rollback Convex to last known-good; verify `/health` | keep broken version tagged | smoke test |

## 4. Rebuilding Convex intelligence (scenario 3)

Because behavioral events are durably stored in Neon (`behavioral_events`), the derived layer is
recoverable:

1. Deploy a new Convex deployment with the production env (`DATABASE_URL`, `CLOUDINARY_*`).
2. Run a one-off replay: read `behavioral_events` + Neon orders → re-insert Convex
   `customerEvents`/`interests` → recompute memory, interests, recommendations.
3. Confirm the flush cron resumes from the Neon cursor (idempotent — duplicates are dropped).
4. Verify: `bun run db:smoke`, `bun run db:consistency`, and a customer-memory spot check.

## 5. Post-recovery checklist

- [ ] `bun run db:smoke` passes
- [ ] `bun run db:consistency` reports 0 issues
- [ ] Ledger total == sum of non-cancelled orders (minus refunds)
- [ ] `/health` ok on the Convex deployment
- [ ] Customer login works; seller/center roles enforced
- [ ] Deploys frozen until verification completes
