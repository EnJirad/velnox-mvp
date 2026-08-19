# Search API

> Product search and discovery

**File:** `convex/commerce.ts` → `catalogProductsAction`  
**Client:** VelShop  
**Auth:** None (public)

## Endpoint

| Action | Purpose | Brain Event |
|--------|---------|-------------|
| `catalogProductsAction(data)` | Search/filter products | `SEARCH` |

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| query | string | "" | Search term |
| category | string | null | Filter by category |
| shopId | string | null | Filter by shop |
| minPrice | number | null | Minimum price |
| maxPrice | number | null | Maximum price |
| sortBy | string | "relevance" | Sort order |
| limit | number | 50 | Results per page |

## Sort Options

| Sort | Description |
|------|-------------|
| `relevance` | Best match first |
| `price_asc` | Lowest price first |
| `price_desc` | Highest price first |
| `newest` | Newest first |
| `rating` | Highest rated first |

## Brain Integration

Every search triggers:
1. `SEARCH` event with query text
2. Results shown to user
3. If user clicks a result → `SEARCH_RESULT_CLICK` event

## Future Expansion

- Brand filtering
- Rating filtering
- Availability filtering
- AI-powered semantic search (Phase 8)
