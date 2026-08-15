# Velnox — Customer Memory & Personal Intelligence

> สาระสำคัญ: **“ทุก Interaction คือข้อมูล — ทุกข้อมูลคือความเข้าใจ — ทุกความเข้าใจต้องนำกลับมาช่วยลูกค้า”**
> เอกสารนี้คือคำอธิบายระบบ Customer Memory ฉบับสมบูรณ์ (spec §59) — ใช้คู่กับ `docs/Velnox-CPNS.md` (วิสัยทัศน์) และ `src/lib/customer-memory-core.ts` (โค้ดกลาง)

---

## 1. ภาพรวมสถาปัตยกรรม (Pipeline)

```
RAW EVENTS (customerEvents)
   ↓
EVENT NORMALIZATION (ผูก Customer Identity)
   ↓
CUSTOMER MEMORY (myMemory — derived intelligence ต่อคน)
   ↓
INTEREST SCORING (eventWeight × time decay)
   ↓
PURCHASE INTENT (estimateIntent — แยกจาก interest)
   ↓
PERSONALIZATION (ShopHome: แนะนำสำหรับคุณ / หมวดที่สนใจ / ซื้ออีกครั้ง)
   ↓
RECOMMENDATION (deterministic rule-based — ไม่มี ML ใน MVP)
   ↓
SMART ASSISTANCE (dueReorderReminders — “ถึงเวลาสั่งซื้อซ้ำแล้ว”)
```

**หลักการสำคัญ:** ไม่กระโดดจาก raw event ไป recommendation ตรง ๆ — ต้องผ่าน memory → understanding → intent ก่อน (CPNS §6, spec §6)

---

## 2. ข้อมูลเก็บที่ไหน (Data Ownership — spec §18)

| ชั้น | จัดเก็บที่ | ตาราง/ไฟล์ |
|---|---|---|
| Raw events | Convex (App DB) | `customerEvents` (`src/convex/schema.ts`) |
| Derived memory | คำนวณสดจาก events (action) | `src/convex/memory.ts` — `myMemory`, `recommendForCustomer`, `dueReorderReminders`, `marketInsights` |
| Scoring rules | Pure TS (testable) | `src/lib/customer-memory-core.ts` |
| Commerce core (product/shop/order) | Neon (source of truth) | `src/backend/*` — อ่านได้จาก node action เท่านั้น |
| Auth / identity | Convex Auth | `users` table |

- **Neon = source of truth ของ commerce** (สินค้า/ร้าน/ออเดอร์/เงิน)
- **Convex = เจ้าของ behavior/intelligence** — เก็บแต่ events + ความจำที่ derived ออกมา
- เหตุการณ์ที่เขียนจากฝั่ง server (PURCHASE/REORDER/VELREPEAT_*) ผูก userId จาก session ไม่ใช่จาก client — ปลอมไม่ได้ (spec §4)

---

## 3. Event Vocabulary (CPNS §17, spec §3)

`src/convex/memoryEvents.ts` — `EVENT_TYPES` (ต้อง sync กับ `src/lib/track.ts`):

```
PRODUCT_VIEW / PRODUCT_CLICK / SEARCH / CATEGORY_VIEW / SHOP_VIEW
INTEREST / WISHLIST_ADD / WISHLIST_REMOVE
CART_ADD / CART_REMOVE / CHECKOUT_START
PURCHASE / REORDER / VELREPEAT_START / VELREPEAT_CANCEL
RECOMMENDATION_CLICK
```

**หลักการคัดเลือก (spec §3):** เก็บเฉพาะ event ที่มีความหมาย + เชื่อถือได้ทางเทคนิค — ไม่เก็บ noise เพื่อให้มีข้อมูลเยอะ
- `RECOMMENDATION_CLICK` เป็น **measurement signal** (วัดว่าระบบแนะนำได้ผล) — ไม่มี weight ใน interest scoring (น้ำหนัก 0)
- `VELREPEAT_CANCEL` เป็น transaction signal — ไม่เพิ่ม interest แต่ทำให้รอบการซื้อเข้าใจได้แม่นขึ้น

แต่ละ event เก็บ: `userId` **หรือ** `anonymousId` (อย่างใดอย่างหนึ่ง), `type`, `entityId` (Neon id ของ product/shop/category), `value` (คำค้น/หมวด), `context` (hints เช่น price/quantity/page), `createdAt`

**Indexes (`customerEvents`):**
- `by_user_type` (userId, type, createdAt) — อ่าน memory ต่อคน
- `by_anonymous` (anonymousId, createdAt) — merge + popularity ของ guest
- `by_type` (type, createdAt) — market insights

---

## 4. Customer Identity: ของใคร ของมัน (CPNS §16, spec §4)

- ผู้ใช้ล็อกอิน → ทุก event ผูก `userId` (Convex users id)
- แขก (signed-out) → `anonymousId` (uuid ใน localStorage `velnox_anon_id`) — **ไม่มี PII** ใช้ป้อน “สินค้ายอดนิยม” เท่านั้น
- ระบบ **ห้าม** อ่าน memory ของคนอื่น: `myMemory` / `recommendForCustomer` / `dueReorderReminders` เริ่มจาก `getUserIdentity()` แล้ว query เฉพาะ `userId` ของตัวเอง (มี index ครอบ)
- Admin UI (velcenter Intelligence) เห็น **aggregate เท่านั้น** (`marketInsights`) — ไม่เปิด raw พฤติกรรมส่วนบุคคล

### 5. Guest → Account Merge (spec §5)

เมื่อแขกสมัคร/ล็อกอิน ระบบต้อง **ไม่ทิ้งประวัติ** ที่แวะเวียนก่อนสมัคร:

1. Client: component `<IdentityMerge />` (mount ในทั้ง 3 site entries) ตรวจจับ auth state เป็น signed-in แล้วเรียก `mergeAnonymousToUser({ anonymousId })`
2. Server: `src/convex/memoryEvents.ts` — query events ตาม `by_anonymous`
3. Dedup ด้วย `planAnonymousMerge` (`src/lib/customer-memory-core.ts`):
   - event ที่ account มีอยู่แล้ว (type+entityId+value ซ้ำ) → **ลบทิ้ง** (ไม่นับซ้ำสอง)
   - event ที่เหลือ → patch `userId` + ล้าง `anonymousId` (อ้างสิทธิ์แล้ว)
4. สำเร็จ → client ลบ `velnox_anon_id` ออกจาก localStorage — merge เกิด **ครั้งเดียวต่อเครื่อง**

**ปลอดภัย + idempotent:** รอบสองเจอ anon events ว่าง → no-op; มี unit test ครอบ (`planAnonymousMerge`)

---

## 6. Interest vs Purchase Intent (CPNS §10, spec §9)

**สองแนวคิดแยกกันชัดเจน — ห้ามยุบเป็นเลขเดียว:**

| สัญญาณ | ระดับ |
|---|---|
| PRODUCT_VIEW 1 ครั้ง | ความสนใจเล็กน้อย |
| ดูซ้ำ / ค้นหา / กด wishlist | ความสนใจเพิ่มขึ้น |
| CART_ADD / CHECKOUT_START | **Purchase intent** แรง |
| PURCHASE / REORDER / VELREPEAT | ยืนยันแล้ว |

- `interestScore` = ผลรวม `eventWeight(type) × decay(...)` ต่อ product/category/shop
- `purchaseIntent` = `estimateIntent({purchaseCount, cartAddCount, viewCount, wishlistCount, checkoutCount})` → `low | medium | high`
- ดูสินค้าเยอะ ๆ อย่างเดียว **ไม่** กลายเป็น intent สูง (มี test ครอบ)

---

## 7. Scoring + Time Decay (spec §10–11)

ตารางน้ำหนัก (`src/lib/customer-memory-core.ts` — แก้ได้จุดเดียว):

| Event | Weight | Half-life (วัน) |
|---|---|---|
| PURCHASE | 12 | 120 |
| VELREPEAT_START | 8 | 120 |
| CART_ADD | 6 | 90 |
| WISHLIST_ADD | 5 | 90 |
| INTEREST | 4 | 60 |
| PRODUCT_VIEW | 2 | 30 |
| PRODUCT_CLICK | 1.5 | 30 |
| SEARCH | 0.4 | 45 |
| SHOP_VIEW | 0.3 | 60 |
| CATEGORY_VIEW | 0.25 | 45 |

**Decay:** `decay = 0.5^(ageDays / halfLifeDays)` — ผ่านไป 1 half-life คงเหลือ 50%, 2 half-life เหลือ 25%
→ **RECENT INTEREST > OLD INTEREST** (CPNS §12) — ของเก่าไม่ติดทนตลอดไป

---

## 8. Derived Intelligence (CPNS §7, spec §12)

`myMemory` สรุปสิ่งที่ Velnox “เข้าใจ” ต่อคน:

- **หมวดที่สนใจ** — คะแนนถ่วงน้ำหนัก + decay จากทุก event (รวม product ที่ดู/ซื้อ ผ่านการ resolve category จาก Neon)
- **คำที่ค้นหาบ่อย** — top 5
- **ร้านที่แวะบ่อย** — top 3 (พร้อมชื่อร้าน)
- **ระดับความตั้งใจซื้อ** — low/medium/high

ไม่ใช่แค่ “เก็บ events แล้วเรียกว่า AI” — เป็นชั้นความเข้าใจที่คำนวณขึ้นจริง

---

## 9. Personalization (spec §13–14, §39–43)

`recommendForCustomer` จัดอันดับสินค้าจาก:

1. **Buy again** — เคยสั่งซื้อ
2. **เคยเพิ่มตะกร้า / แสดงความสนใจ / เปิดดูบ่อย**
3. **คำค้นที่ตรง** — “คุณค้นหา…”
4. **Category affinity** — หมวดที่สนใจ
5. **Shop affinity** — ร้านที่แวะบ่อย
6. **Popular fallback** — cold start / แขก

พร้อม **เหตุผล** (“ทำไมถึงแนะนำ”) — ผู้ใช้เห็นว่า Velnox จำอะไรได้
Priority: personalized → contextual → generic fallback

**Cold start (spec §14):** แขก/ผู้ใช้ใหม่ไม่มีประวัติ → เห็น “สินค้ายอดนิยม” (popularity จากทั้งตลาด) ไม่เห็นหน้าเปล่า — ค่อย ๆ เปลี่ยนเป็นของเฉพาะคนเมื่อมีข้อมูล

**Proactive Commerce (CPNS §14, spec §16):** `dueReorderReminders` เรียนรอบการสั่งจากออเดอร์จริง (≥2 ครั้ง, interval 2–180 วัน) แล้วเตือน “ถึงเวลาสั่งซื้อซ้ำแล้ว” พร้อมปุ่มซื้ออีกครั้ง

---

## 10. Event Quality (spec §8)

- **Dedup client-side:** `PRODUCT_VIEW` ถูกส่งครั้งเดียวต่อสินค้าต่อหน้า (session ref ใน `ShopProductDetail`/`ProductDetailModal`)
- **Rate limit server-side:** `customer_events` 300 ครั้ง/นาที/คน — abuse ไม่ทำระบบพัง
- **Fire-and-forget:** ทุกการ track `.catch()` เงียบ — tracking พัง **ไม่เคย** พังการช้อปปิ้ง (spec §50)
- **Bot/noise:** ใช้ rate limit + เก็บเฉพาะ event ที่มีความหมาย

---

## 11. Privacy (spec §46, CPNS §16)

- Anonymous events: **ไม่มี PII** — แค่ uuid + พฤติกรรม
- ทุก read ส่วนบุคคล scoped ด้วย userId จาก session
- Market insights (velcenter): aggregate เท่านั้น (top searches/categories/products) — ไม่เปิด raw ต่อคน
- เก็บเฉพาะข้อมูลที่จำเป็นต่อ commerce + personalization

**Retention (spec §45):** MVP อ่าน events ย้อนหลัง bounded (`take(400–500)`) — พฤติกรรมเก่าถูก decay ตามธรรมชาติ; แผนระยะยาว = aggregate events เก่าเป็น summary แล้วลบทิ้ง (ยังไม่ implement — บันทึกไว้)

---

## 12. Test Coverage (spec §51)

`src/lib/customer-memory-core.test.ts` (vitest):

- event weights ordering + zero-weight types
- decay: ครึ่งชีวิตพอดี / 2 half-life / ไม่ติดลบ / recent > old / PURCHASE ช้ากว่า VIEW
- intent: view อย่างเดียวไม่ใช่ intent / medium / high thresholds
- merge: dedup ไม่นับซ้ำ / idempotent / เก็บของที่ต่างกัน

รวมกับ `tests/*` (business rules, state machine, IDOR/security, providers, velrepeat) — ทั้งชุด **58 ผ่าน** (ตรวจจริง 2026-08-15: `bun test` 58 pass / 0 fail)

---

## 13. ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | บทบาท |
|---|---|
| `src/convex/schema.ts` | ตาราง `customerEvents` + indexes |
| `src/convex/memoryEvents.ts` | `track`, `trackForUser`, `mergeAnonymousToUser`, internal queries |
| `src/convex/memory.ts` | node actions: `myMemory`, `recommendForCustomer`, `dueReorderReminders`, `marketInsights` |
| `src/lib/customer-memory-core.ts` | **pure logic กลาง** (weights/decay/intent/merge plan) — testable |
| `src/lib/customer-memory-core.test.ts` | unit tests |
| `src/lib/track.ts` | `useTracking()` + `<IdentityMerge />` |
| `src/pages/ShopHome.tsx` | personalization UI (แนะนำ/หมวดที่สนใจ/ซื้ออีกครั้ง/ถึงเวลาสั่งซื้อซ้ำ) |
| `src/pages/Center.tsx` | Intelligence tab + market insights panel |
| `src/convex/subscriptions.ts` | `VELREPEAT_CANCEL` tracking |
| `src/convex/customer.ts`, `src/convex/commerce.ts` | server-side events (PURCHASE/REORDER/VELREPEAT_START/WISHLIST) |
| `docs/Velnox-CPNS.md` | วิสัยทัศน์ + หลักการ |

---

## 14. อนาคต (spec §44 — architecture พร้อมรับ AI โดยไม่ rewrite)

- น้ำหนัก/decay เป็น config ได้อยู่แล้ว (ย้าย `EVENT_WEIGHTS`/`EVENT_HALF_LIFE` ไป platform_settings ได้)
- ชั้น derived intelligence แยกจาก raw events — สลับ scoring ไป ML ได้โดยไม่แตะ event store
- แนะนำ: เริ่มจาก deterministic (ทำแล้ว) → ค่อยเพิ่ม ML เฉพาะจุดที่วัดผลได้ว่าเหนือกว่า
