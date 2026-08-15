# VELNOX — Authorization (RBAC + Ownership)

Version: 1.0 · Phase 10 — ตรงกับโค้ดจริง

## 1. หลักการ

> Authentication ≠ Authorization. Server (Convex actions) ตรวจทุก request สำคัญ — ไม่เชื่อ role/price/sellerId จาก client

## 2. Roles (Neon `users.role`)

| Role | VelShop | VelSeller | VelCenter |
|---|---|---|---|
| `customer` | ✅ | ❌ | ❌ |
| `seller` | ✅ | ✅ (ร้านตัวเอง) | ❌ |
| `staff` | ✅ | ❌ | ✅ ตาม permission |
| `admin` | ✅ | ✅ | ✅ ธุรกิจ (ยกเว้นจัดการพนักงาน) |
| `owner` | ✅ | ✅ | ✅ ทุกอย่าง + platform settings |

## 3. Guards กลาง (`src/backend/identity.ts`)

| Guard | ใช้เมื่อ | ตรวจ |
|---|---|---|
| `requireIdentity` | customer writes | login + user row (Neon) |
| `requireRoles(roles)` | role gate | role ∈ list |
| `requireSeller` | seller writes | มี seller ที่เป็นของ user |
| `requireSellerForShop(shopId)` | seller shop ops | shop.seller_id === seller.id |
| `requirePermission(p)` | center writes | role + permission catalog |
| `requireCenter` | center reads | role ∈ staff/admin/owner |

## 4. Granular permissions (`src/backend/permissions.ts`)

- owner/admin = ทุก permission; staff = เฉพาะ `staff_profiles.permissions` (department scoping)
- ตัวอย่าง: `APPROVE_SELLERS`, `SUSPEND_SELLERS`, `APPROVE_PRODUCTS`, `VIEW_FINANCE`, `MANAGE_PLATFORM_SETTINGS`, `MANAGE_STAFF`
- ตรวจ: `hasPermission(role, staffProfile, permission)` — tests ใน `tests/security.test.ts`

## 5. Ownership / IDOR (ตรวจทุก resource)

| Resource | เงื่อนไข |
|---|---|
| Order (customer) | `order.customer_user_id === user.id` — customer.ts orderDetail/reorder/cancel |
| Order (seller) | `sellerOwnsOrder` — order_items.seller_id === seller.id |
| Product | `requireSellerProduct` — Product → Shop → Seller chain |
| Shop | `requireSellerForShop` / `listShopsBySeller` check |
| Address / Cart / Wishlist / Notification / Subscription | ผูก `user.id` จาก session ทุก action |
| Payment/Refund (seller) | ผ่าน sellerOwnsOrder |
| Center finance/settings | `requirePermission` |

## 6. Test matrix

`tests/security.test.ts` + `tests/errors.test.ts` — ครอบ: owner/admin ทุกสิทธิ์, seller ปฏิเสธ platform settings, customer ปฏิเสธทุกอย่าง, staff ตาม permission, ownership error มี stable code
