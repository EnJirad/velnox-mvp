# VELNOX — Shipping & Tracking

Version: 1.0 · Phase 10 — ตรงกับโค้ดจริง

## 1. Abstraction (`src/backend/shipping.ts`)

```ts
interface ShippingProvider {
  calculateShipping(input): Promise<Money>
  createShipment(input): Promise<ShipmentResult>
  cancelShipment(ref): Promise<void>
  trackShipment(ref): Promise<TrackingEvent[]>
  getTrackingStatus(ref): Promise<ShippingStatus>
}
```

- **ManualShippingProvider** (ใช้งานได้วันนี้): seller กรอก carrier + tracking_number + append events — tracking timeline จริง
- Registry + TODO: Kerry/Flash/J&T/Thailand Post/DHL (Phase 9.5)
- Tests: `tests/providers.test.ts`

## 2. ตาราง

- `shipments`: order_id · seller_id · carrier · tracking_number · status · shipping_fee · estimated_delivery_date · shipped_at · delivered_at
- `tracking_events`: shipment_id · status · description · location · timestamp

## 3. Flow

seller `setOrderStatus(shippingStatus/trackingNumber)` → shipment + event; customer เห็น timeline (ORDER_CONFIRMED → PACKED → SHIPPED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED) ผ่าน `/shop/orders/:id/tracking` — **customer แก้ tracking ไม่ได้** (backend เท่านั้น)

## 4. GPS ใน shipping

- customer address (shipping) + shop location (pickup/return/delivery area) — lat/lng บังคับ + validate (§18)
- ห้ามเปิดเผยพิกัดละเอียดต่อบุคคลอื่นโดยไม่จำเป็น (privacy — ดู `docs/security.md` §9)

## 5. ค่าขนส่ง

- `shipping_fee` คำนวณ backend (checkout) — client ไม่กำหนด
- shipping company share: `platform_settings.shipping_company_percent` (default 10%) — snapshot ตอน transaction (ดู `docs/financial.md`)

## 6. Carrier จริง (TODO)

ต้องเลือก provider + keys → registry + webhook auto-tracking (Phase 9.5 — พร้อมใช้ Gravity Index)
