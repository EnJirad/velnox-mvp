# Categories API

> Product categories

**File:** `convex/customer.ts` → `categoryStatsAction`, `backend/categories.ts`  
**Client:** VelShop  
**Auth:** None (public)

## Endpoints

| Action | Purpose | Brain Event |
|--------|---------|-------------|
| `categoryStatsAction()` | Categories with product counts | `CATEGORY_VIEW` |

## Categories

| Category | Label | Emoji |
|----------|-------|-------|
| general | ทั่วไป | 🛍️ |
| food | อาหาร | 🍽️ |
| daily | ของใช้ประจำวัน | 🧴 |
| beauty | ความงาม | 💄 |
| packaging | บรรจุภัณฑ์ | 📦 |
| other | อื่น ๆ | ✨ |

## Response

```typescript
{
  categories: [
    { category: "beauty", label: "ความงาม", productCount: 12 },
    { category: "food", label: "อาหาร", productCount: 8 },
    ...
  ]
}
```

## Brain Integration

When a customer views a category page, track `CATEGORY_VIEW` with the category value.
