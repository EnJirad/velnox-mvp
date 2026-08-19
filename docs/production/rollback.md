# VELNOX — Deployment Rollback & Zero-Downtime (spec §61, §63)

Version: 1.0 · Phase 9

## 1. หลักการ

- Frontend (Vercel) rollback = เลือก deployment ก่อนหน้าใน dashboard — ทันที, ไม่กระทบ data
- Convex rollback = `npx convex deploy` กลับ version ก่อนหน้า; **การเปลี่ยนแปลง schema ต้องดู migration compatibility**
- Neon: ไม่มี "rollback อัตโนมัติ" สำหรับ data — ใช้ backup/restore หรือ migration ถอยหลังที่เขียนไว้ล่วงหน้า (ห้าม DROP ใน migration)

## 2. เมื่อไหร่ต้อง rollback

| Trigger | ระดับ | ทำอะไร |
|---|---|---|
| หน้าเว็บพัง (blank/JS error) หลัง deploy | P1 | Vercel rollback ทันที |
| Auth/login พัง | P0 | Vercel rollback + ตรวจ Convex env |
| Order/checkout ผิดพลาดเป็นวงกว้าง | P0 | Vercel rollback + เปิด maintenance mode (ถ้ามี) + หยุดรับ order |
| ตัวเลขเงิน/ledger ผิด | P0 | หยุดทุกอย่าง → ตรวจ ledger → rollback code → reconcile |
| DB migration มีปัญหา | P0 | rollback code ก่อน, อย่า DROP data, กู้จาก backup ถ้าจำเป็น |

## 3. Rollback procedure (ทีละขั้น)

```
1. DETECT     — monitoring/alert (Sentry + health /health + error rate)
2. CONFIRM    — ยืนยัน root cause ว่าเป็น release ใหม่ (ไม่ใช่ data/third-party)
3. CONTAIN    — Vercel: redeploy deployment ก่อนหน้า (rollback, ~1 นาที)
                Convex: npx convex deploy <prev-commit> (ถ้า schema ไม่เปลี่ยน)
                ถ้า schema เปลี่ยน: ห้าม deploy เก่า — ใช้ hotfix forward
4. VERIFY     — smoke test ตาม ../E2E-TESTING.md + db:consistency
5. INVESTIGATE — postmortem (ดู incident-response.md)
6. REDEPLOY    — หลังแก้แล้ว deploy ใหม่
```

## 4. Zero-downtime (spec §63)

- Deploy ใหม่ = Vercel atomic (ไม่มี downtime หน้าเว็บ)
- **Migration ต้อง backward-compatible**: เพิ่ม column ด้วย DEFAULT, ห้าม rename/DROP ที่ยังมี code ใช้อยู่
- ลำดับ deploy ปลอดภัย: `Neon migration → Convex deploy → Vercel` (code เก่าทำงานกับ schema ใหม่ได้เสมอ)
- ถ้าจำเป็นต้อง downtime จริง: เปิด maintenance mode (VelCenter setting) + แจ้ง user — ดู production-architecture.md §5

## 5. รายการต้องมีก่อนเปิด (ทำบน platform)

- [ ] Vercel: รู้ว่า deployment ไหนคือ "last known good"
- [ ] Convex: prod deployment ผ่าน `convex deploy` (ไม่ใช่ dev)
- [ ] Neon: backup อัตโนมัติ + restore test ผ่าน (`backup.md`)
- [ ] Maintenance mode flag ใช้งานได้ (ถ้าเปิดใช้)
