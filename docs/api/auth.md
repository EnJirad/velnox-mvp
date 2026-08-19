# Auth API

> Authentication — Convex Auth with email OTP

**Files:** `convex/auth.ts`, `convex/auth/emailOtp.ts`, `convex/users.ts`  
**Clients:** All

## Authentication Flow

```
1. User enters email
2. Backend sends OTP code
3. User enters OTP
4. Backend verifies and creates session
5. Convex Auth issues token
6. Subsequent requests use token
```

## Auth Endpoints

| Action | Purpose |
|--------|---------|
| `currentUser()` | Get current signed-in user |
| `ownerExists()` | Check if owner account exists |
| `ownerBootstrapStatus()` | Check bootstrap availability |

## Role System

| Role | Can Buy | Can Sell | Can Admin | Can Center |
|------|:-------:|:--------:|:---------:|:----------:|
| customer | ✅ | ❌ | ❌ | ❌ |
| seller | ❌ | ✅ | ❌ | ❌ |
| staff | ❌ | ❌ | ❌ | ✅ |
| admin | ❌ | ✅ | ✅ | ✅ |
| owner | ❌ | ✅ | ✅ | ✅ |

## Identity Resolution

Every protected Convex action resolves identity server-side:

1. `ctx.auth.getUserIdentity()` → Convex session
2. `getUserByConvexId(db, subject)` → Neon user row
3. If not found → auto-create Neon user
4. Return `Identity` with full user data

**Never trust client-provided userId or role.**
