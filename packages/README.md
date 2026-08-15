# Velnox Shared Packages

โค้ดที่ใช้ร่วมกันระหว่าง 4 apps อยู่ที่ตำแหน่งจริงต่อไปนี้ (single source — ไม่มีการคัดลอก):

| Package เป้าหมาย | ตำแหน่งจริงใน repo | เนื้อหา |
|---|---|---|
| `ui` | `src/components/ui/` (+ `components.json`) | 60+ shadcn/ui primitives (button, dialog, table, form...) — ไม่มี business logic |
| `auth` | `src/convex/auth.ts` · `src/convex/auth.config.ts` · `src/convex/auth/emailOtp.ts` · `src/components/RequireAuth.tsx` · `src/components/RequireRole.tsx` · `src/hooks/use-auth.ts` | Convex Auth + route guards (client UX) |
| `types` | `src/backend/types.ts` · `src/convex/schema.ts` (role/validators) | Domain types ร่วม |
| `validation` | `src/backend/validation.ts` (zod — 15 schemas) · `src/backend/errors.ts` | schema validation กลาง (backend เป็น authoritative) |
| `constants` | `src/convex/schema.ts` (ROLES/departments) · `src/lib/shop.ts` (status meta) · `src/lib/sites.ts` (URLs) | ค่าคงที่/สถานะ/ลิงก์ข้ามแอป |
| `utils` | `src/lib/utils.ts` (cn...) · `src/lib/customer-memory-core.ts` | helper ทั่วไป + Customer Memory core (มี unit test) |
| `config` | `src/lib/sites.ts` (`SITE_URLS`, `siteBasename`) · `vercel.json` · `.env.example` | URL/env/deploy config กลาง |
| `api` | `src/convex/*` (Blackend API) + `src/backend/*` (Neon access) | typed API + business rules — **backend เดียวสำหรับทั้ง 4 apps** |

## กติกา

- **ห้าม duplicate:** ถ้าต้องใช้ของร่วม ต้อง import จากตำแหน่งจริงข้างบน (alias `@/*` ชี้ `src/`)
- **ห้ามเอา business logic ลง `ui`:** องค์ประกอบ UI ต้องไร้ logic ของแอป
- อนาคตถ้าจะแยกเป็น packages จริง (npm workspace) ให้ย้ายทีละตัวตาม
  `docs/RESTRUCTURE_INVENTORY.md` §16 — ไม่จำเป็นสำหรับ MVP
