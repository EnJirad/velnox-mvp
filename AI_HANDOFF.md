# AI_HANDOFF.md
> Handoff note for the next AI agent working on Velnox. **อ่านก่อนแก้โค้ดทุกครั้ง**
> และ **อัปเดตไฟล์นี้ทุกครั้งหลังทำงานเสร็จ** (ตามคู่มือ CONTINUE DEVELOPMENT)

## CURRENT SNAPSHOT
- date: 2026-08-18
- commit: network-diagnostics round
- branch: main

## ARCHITECTURE (LOCKED — ห้ามเปลี่ยน)
- Bun-workspace monorepo: `apps/{shop,seller,center,corporate}` + `packages/shared` (@velnox/shared)
- Backend: `backend/` = Neon commerce core, `convex/` = shared Convex layer
- Stack: Bun · Vite · React 19 · TypeScript · Tailwind · shadcn/ui · Convex + Convex Auth · Neon PostgreSQL · Cloudinary

## COMPLETED
- VelShop storefront: catalog/detail, cart, checkout, orders, wishlist, categories, VelRepeat, notifications, search
- Profile: avatar + cover upload via Cloudinary signed upload, edit profile, logout
- Auth: Convex Auth, RequireAuth, login flash guard
- **cf223c47**: Fixed Cloudinary signature algorithm (SHA-1 not HMAC)
- **a547e6c3**: Toast shows real Cloudinary error on HTTP fail
- **Network diagnostics round**: Full STEP logging, error ID, preflight test, fetch timing

## FAILED TO FETCH — ROOT CAUSE ANALYSIS

### Browser Data (REAL production test)
- Origin: https://velshop.vercel.app
- Online: true
- Target: api.cloudinary.com
- Error: Failed to fetch (TypeError at STEP 5)
- Error ID: PROFILE_UPLOAD_20260818_B1QD

### Code Inspection Results
- ✅ Cloudinary URL correct: `https://api.cloudinary.com/v1_1/{cloudName}/image/upload`
- ✅ FormData has all required params: file, api_key, timestamp, folder, public_id, signature, allowed_formats
- ✅ No manual Content-Type header (browser auto-sets multipart boundary)
- ✅ No credentials/cookies sent to Cloudinary
- ✅ No AbortController / timeout / Promise.race
- ✅ No CSP in app code (no `<meta>` tag, no `vercel.json`)
- ✅ No Service Worker registered
- ✅ Signature params match between backend and frontend

### Conclusion
**The problem is NOT in the code.** The fetch() is being blocked at the browser/network level.

Most likely causes (in order):
1. **Browser extension / Ad-blocker** blocking api.cloudinary.com
2. **CSP header** set at Vercel edge/CDN level (not in app code)
3. **Network/firewall** (corporate network, VPN, ISP)
4. **Cloudinary account restriction** (IP/domain whitelist)

### Browser Tests Required
1. **Incognito mode** — rules out extensions
2. **Network tab** — shows if OPTIONS/POST appears and their status
3. **Console tab** — shows preflight result and detailed error

## FILES CHANGED
- apps/shop/src/components/shop/ProfileImageUpload.tsx — Cloudinary URL log, FormData log, preflight test, fetch timing, detailed catch
- AI_HANDOFF.md — updated

## VERIFICATION
- TypeScript: **PASS**
- Browser upload: **NOT VERIFIED** — awaiting user's browser test results

## STILL PENDING
- User must run browser tests (Incognito + Network tab + Console)
- Based on results:
  - Incognito works → disable extension
  - No request in Network → CSP/ServiceWorker/extension
  - OPTIONS fails → CORS preflight blocked
  - POST fails → network-level block

## NEXT AI INSTRUCTIONS
- Wait for user's browser test results
- Based on results, identify root cause and apply smallest possible fix
- Do NOT change signing, Convex, Neon, architecture
- Do NOT remove network diagnostics
