# DATABASE-RECOVERY — Neon Backup & Recovery Strategy

Version: 1.0 · Phase 7 · ใช้กับ Neon PostgreSQL (source of truth ของ Velnox commerce)

---

## 1. Backup Strategy (§34)

### ระดับ 1 — Neon Built-in (เปิดตลอด)
- **PITR (Point-in-Time Recovery)**: Neon เก็บ history อัตโนมัติ — restore ได้ถึงช่วงเวลาใดก็ได้ภายใน retention (default 7 วัน, ปรับได้ที่ Neon console)
- **Branches**: สร้าง branch สำหรับ staging/testing ได้ฟรี — แยกจาก production data
- **Snapshot**: Neon มี snapshot/restore ใน console

### ระดับ 2 — Scheduled dump (เพิ่มความปลอดภัย — offline backup)
- ใช้ `pg_dump` ผ่าน cron (หรือ Neon CLI/Snapshot):
  ```bash
  pg_dump "$DATABASE_URL" --no-owner --format=custom -f velnox-$(date +%F).dump
  ```
- **Retention**: เก็บ daily × 30 วัน, weekly × 12 สัปดาห์, monthly × 12 เดือน
- เก็บในที่ต่าง region/ผู้ให้บริการ (เช่น S3 bucket แยก หรือ Neon Snapshot)

### สิ่งที่ backup ต้องมี
- ข้อมูล: users/sellers/shops/products/inventory/orders/payments/shipments/reviews/ledger/audit (ทุกตาราง — schema.sql + migrations เป็น source of truth ของ structure)
- **ไม่รวม**: ไฟล์ภาพ (อยู่ใน Cloudinary — backup แยกผ่าน Cloudinary console/SDK), secrets/env

## 2. Recovery Procedure

### Scenario A — ลบ/แก้ข้อมูลผิด (ภายใน retention)
1. Neon console → Restore → เลือก branch/snapshot/เวลาก่อนเกิดเหตุ
2. Verify: นับยอด order/payment/ledger ตรง
3. แจ้งทีม — ห้าม deploy code ใหม่ระหว่าง restore

### Scenario B — Corruption / Disaster
1. Restore dump ล่าสุด (pg_restore ไป branch ใหม่ก่อน — ไม่เขียนทับ production ตรงๆ)
2. ตรวจ integrity: `SELECT COUNT(*)` ตารางหลัก + ยอด ledger กับ payments
3. Promote branch → สับ `DATABASE_URL` → verify → ทิ้ง branch เก่า

### Scenario C — ข้อมูลบางส่วนหาย (เช่น order)
1. ใช้ PITR หาเวลาที่ข้อมูลยังครบ
2. Restore เฉพาะข้อมูลนั้น (จาก branch) หรือ manual reconciliation ผ่าน ledger (append-only — ใช้ adjustment transaction แก้ตาม SECURITY.md §4)
3. บันทึก audit log การแก้

## 3. Integrity Checks (หลัง restore ทุกครั้ง)

```sql
-- ยอดเงิน: ledger ควรเท่ากับผลรวม orders (minus refunds)
SELECT COALESCE(SUM(total),0) FROM orders WHERE status NOT IN ('cancelled');
SELECT COALESCE(SUM(amount),0) FROM financial_ledger;

-- order items ครบทุก order
SELECT COUNT(*) FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE oi.id IS NULL;

-- stock ไม่ติดลบ
SELECT COUNT(*) FROM inventory WHERE quantity < 0 OR reserved_quantity < 0;
```

## 4. Migration Safety (§54)

- migrations เป็น idempotent (`IF NOT EXISTS`) — รันซ้ำได้
- **ลำดับ deploy**: migration ก่อน → code ใหม่ (ดู DEPLOYMENT.md §5)
- ห้าม drop column/table ที่ code เก่ายังใช้ — ใช้ soft delete / deprecate ทีหลัง
- Financial records ห้าม hard delete (Phase 2 §55)

## 5. RPO/RTO (เป้าหมาย)

- RPO ≤ 5 นาที (PITR) · RTO ≤ 30 นาที (restore + verify)
- ทดสอบ restore จริงอย่างน้อยไตรมาสละครั้ง (บันทึกผล)

## 6. Contacts / Owner

- Owner: platform admin (VelCenter owner) — ตั้งค่า Neon console + จัดการ branch
- ทุก restore/recovery ต้องบันทึกใน audit log (actor, time, เหตุผล)
