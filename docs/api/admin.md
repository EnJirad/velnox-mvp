# Admin API

> VelCenter Web — platform management, users, sellers, orders

**File:** `convex/centerAdmin.ts` + `convex/users.ts`  
**Client:** VelCenter (Web)  
**Auth:** Required (owner/admin/staff with permissions)

## Platform Settings

| Action | Permission | Purpose |
|--------|-----------|---------|
| `getPlatformSettings()` | VIEW_FINANCE | Get all settings |
| `updatePlatformSettingAction(data)` | MANAGE_PLATFORM_SETTINGS | Update setting |

## User Management

| Action | Permission | Purpose |
|--------|-----------|---------|
| `sellerList()` | VIEW_USERS | List all sellers |
| `setSellerStatusAction(data)` | MANAGE_SELLERS | Approve/reject/suspend seller |
| `productModerationList()` | VIEW_USERS | Products pending review |
| `setProductModerationAction(data)` | MANAGE_SELLERS | Approve/reject product |

## Orders

| Action | Permission | Purpose |
|--------|-----------|---------|
| `ordersListAction(data)` | VIEW_USERS | List all orders |
| `marketOverviewAction()` | VIEW_FINANCE | Market overview |
| `updateOrderStatusAction(data)` | MANAGE_SELLERS | Update order status |

## Finance

| Action | Permission | Purpose |
|--------|-----------|---------|
| `platformRevenueReport(data)` | VIEW_FINANCE | Revenue report |
| `processPayout(data)` | MANAGE_PAYOUTS | Process seller payout |

## Audit

| Action | Permission | Purpose |
|--------|-----------|---------|
| `auditLogs(data)` | VIEW_USERS (owner: full) | Audit log |

## Employee Management

| Action | File | Purpose |
|--------|------|---------|
| `employeeListAction()` | employeeAuth.ts | List employees |
| `createEmployeeAction(data)` | employeeAuth.ts | Create employee |
| `resetEmployeePasswordAction(data)` | employeeAuth.ts | Reset password |
| `setEmployeeActiveAction(data)` | employeeAuth.ts | Enable/disable |

## Authorization

- Owner: full access
- Admin: most permissions
- Staff: granular permissions via `requirePermission(ctx, permission)`
- Every sensitive change is audit-logged
