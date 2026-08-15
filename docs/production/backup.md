# VELNOX — Backup & Restore (spec §44–45)

Version: 1.0 · Phase 9 — รายละเอียดเต็ม: [`../DATABASE-RECOVERY.md`](../DATABASE-RECOVERY.md)

## 1. สิ่งที่ต้อง backup

| ข้อมูล | ที่อยู่ | วิธี |
|---|---|---|
| Commerce Core (users, orders, payments, ledger …) | Neon | Neon automated backup + scheduled dump |
| Convex (auth sessions, intelligence, notifications) | Convex Cloud | Convex managed (deployment snapshot/export) |
| Images | Cloudinary | Cloudinary managed + export ตาม policy |
| Code + `_generated` | Git | GitHub |

## 2. Neon backup policy (ตัวอย่าง)

- **Frequency**: automated (Neon PITR ตาม tier) + `pg_dump` รายวัน (cron)
- **Retention**: ≥ 14 วัน (PITR) + รายสัปดาห์เก็บ 4 สัปดาห์ + รายเดือนเก็บ 12 เดือน
- **Recovery point objective (RPO)**: ≤ 5 นาที (PITR) / รายวัน (dump)
- **Recovery time objective (RTO)**: ≤ 30 นาที (restore ไป branch ใหม่)

## 3. กฎสำคัญ (spec §44)

> **Backup ที่ไม่เคยทดสอบ restore = ยังไม่พร้อม**

- ก่อนเปิดระบบ: **ทดสอบ restore อย่างน้อย 1 ครั้ง** — restore ไป branch ใหม่ → วิ่ง `db:smoke` + `db:consistency` → ตรวจ order/payment ตัวอย่าง
- ทุกครั้งที่เปลี่ยน schema (migration): backup ก่อนเสมอ (spec §62)
- ห้าม destructive migration โดยไม่มี backup

## 4. Disaster recovery (spec §45)

| Failure | กู้ยังไง | ใครรับผิดชอบ |
|---|---|---|
| Database fail | Neon PITR → restore branch → swap URL | owner + platform |
| Storage fail | Cloudinary re-upload (public_id ใน product_images ยังอยู่) / vendor restore | owner |
| Backend fail (Convex) | redeploy deployment ก่อนหน้า | owner |
| Frontend fail | Vercel rollback | owner |

- ข้อมูลสำคัญอยู่ที่ไหน → ดู `production-architecture.md` §1
- หลังกู้: `db:consistency` + smoke test ทุกครั้ง

## 5. TODO ก่อน go-live

- [ ] เปิด Neon automated backup + PITR
- [ ] ตั้ง cron `pg_dump` + เก็บไป object storage
- [ ] **ทดสอบ restore 1 ครั้ง** + บันทึกผล
- [ ] เขียน runbook กู้ (owner + ใครติดต่อ)
