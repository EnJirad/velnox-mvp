# VELNOX — Production Architecture

Version: 1.0 · Phase 9 · status: PLAN (ยังไม่ได้ deploy จริง — ต้อง config บน hosting platform)

---

## 1. Components & URLs

| ส่วน | ตัวตน | Production URL (เป้าหมาย) |
|---|---|---|
| Velnox Main (landing) | `src/main.tsx` → `index.html` | `https://velnox.com` |
| VelShop (ลูกค้า) | `src/sites/velshop/main.tsx` → `velshop.html` | `https://shop.velnox.com` |
| VelSeller (ร้านค้า) | `src/sites/velseller/main.tsx` → `velseller.html` | `https://seller.velnox.com` |
| VelCenter (บริษัท) | `src/sites/velcenter/main.tsx` → `velcenter.html` | `https://center.velnox.com` |
| Blackend (API + business logic) | Convex (actions/mutations/queries/http actions) | deployment URL จาก `convex deploy` → `VITE_CONVEX_URL` |
| Database (Commerce Core) | Neon PostgreSQL | connection string → `DATABASE_URL` |
| Storage (images) | Cloudinary | `CLOUDINARY_CLOUD_NAME/_API_KEY/_API_SECRET` |
| Error monitoring | Sentry | `VITE_SENTRY_DSN` (ดู `monitoring.md`) |
| Payment | (ยังไม่มี — abstraction พร้อม) | Phase 9.5 / Gravity Index |
| Shipping | (ยังไม่มี — abstraction พร้อม) | Phase 9.5 / Gravity Index |

## 2. Deployment topology

```
Browser
  ├─ shop.velnox.com   ──┐
  ├─ seller.velnox.com ──┼── Convex (auth + actions + http /health) ── Neon (source of truth)
  └─ center.velnox.com ──┘        │
                                  └── Cloudinary (browser uploads direct, signed)
                                  └── Sentry (browser errors + boundary capture)
```

- **3 เว็บ deploy แยก** บน Vercel (root dir ต่างกันใน repo เดียวกัน) — ดู `deployment.md`
- **Auth ระบบเดียว**: Convex Auth (httpOnly cookie) — ผู้ใช้ login ที่ shop.velnox.com ใช้ session เดียวกับ seller/center ตาม role
- **Neon = source of truth ของ commerce**; Convex = intelligence + auth + events
- ฐานข้อมูล **เดียว** 3 เว็บ (ห้ามสร้าง DB แยก)

## 3. Vercel projects (เมื่อตั้งจริง)

| Project | Root directory | Build | Output | Env หลัก |
|---|---|---|---|---|
| velnox-main | `.` | `bun run build` | `dist` | `VITE_CONVEX_URL`, `VITE_VEL*_URL` |
| velnox-shop | `.` | `bun run build` | `dist` (velshop.html) | เหมือนบน + `VITE_SITE_BASENAME=/shop` |
| velnox-seller | `.` | `bun run build` | `dist` (velseller.html) | เหมือนบน + `VITE_SITE_BASENAME=/seller` |
| velnox-center | `.` | `bun run build` | `dist` (velcenter.html) | เหมือนบน + `VITE_SITE_BASENAME=/center` |

> Build ไม่ต้อง login Convex CLI — `_generated` commit ไว้แล้ว (§8)

## 4. Environment แยกตาม stage

| Stage | DB | Convex deployment | ใช้เมื่อ |
|---|---|---|---|
| development | Neon dev | dev deployment | ทำงานท้องถิ่น |
| preview (PR) | Neon preview | Vercel preview env | CI |
| production | Neon prod | prod deployment | go-live |

ห้ามใช้ dev database ใน production (ตรวจใน checklist ล่าง)

## 5. GO-LIVE CHECKLIST (spec §87) — สถานะปัจจุบัน

| # | รายการ | สถานะ |
|---|---|---|
| 1 | Production domains + SSL | ⏳ ต้องตั้ง (Vercel/domain registrar) |
| 2 | Database พร้อม (Neon prod + migration รันแล้ว) | ⏳ ต้องรัน `db:migrate` + `db:smoke` |
| 3 | Backup + **restore test** | ⏳ ดู `backup.md` |
| 4 | Convex production deploy + env (`SITE_URL`/`JWT_PRIVATE_KEY`/`JWKS`/`DATABASE_URL`/Cloudinary) | ⏳ ผ่าน `npx convex deploy` + Keys UI |
| 5 | Authentication พร้อม (OTP relay key) | ✅ code พร้อม — ตรวจ prod env |
| 6 | Payment | ⏳ provider ยังไม่เลือก (Gravity) |
| 7 | Storage (Cloudinary) | ⏳ ตั้ง keys ใน prod env |
| 8 | Shipping | ⏳ carrier ยังไม่เลือก |
| 9 | Monitoring + alerting (Sentry) | 🟡 code พร้อม — ต้องใส่ `VITE_SENTRY_DSN` |
| 10 | Error tracking | 🟡 เหมือนข้อ 9 |
| 11 | Admin account จริง (ห้าม admin@example.com) | ⏳ สร้างบัญชี owner จริง |
| 12 | Legal pages (Terms/Privacy/Return/Shipping) | ⏳ ยังไม่มีหน้า — ต้องเขียนก่อนเปิด |
| 13 | Env vars ครบทุก project | ⏳ ตาม `environment.md` |
| 14 | CI/CD (typecheck + test + deploy) | ⏳ GitHub Actions ยังไม่ตั้ง |
| 15 | Rollback procedure | ✅ เขียนไว้แล้วใน `rollback.md` |

## 6. SOFT LAUNCH PLAN (spec §88–89)

```
Internal test (ทีมเรา, staging) → Closed beta (ลูกค้า/ร้านค้า/พนักงานกลุ่มเล็ก จำกัดวงเงิน)
→ Public beta → Full launch
```

- **Closed beta ต้อง**: real order, real product, real shipping, real return — แต่จำกัดจำนวน transaction/วงเงิน
- ก่อนแต่ละ step: วิ่ง `db:consistency` (ดู `testing.md`) + smoke test ตาม `../E2E-TESTING.md`
- Feedback loop: บันทึก bug/suggestion ใน issue tracker (ดู `incident-response.md` severity)

## 7. หลักสำคัญ

- เงิน/ราคา/stock/commission **คำนวณที่ backend เท่านั้น** (กฎ Phase 2–3)
- ข้อมูลสำคัญทุกอย่าง audit-log; ledger append-only
- ห้ามประกาศ Production Ready จนกว่าจะผ่าน checklist ข้อ 1–15 ที่ยัง ⏳
