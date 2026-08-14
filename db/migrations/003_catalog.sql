-- ============================================================================
-- Velnox — Migration 003: Catalog (categories + variants)
-- ----------------------------------------------------------------------------
-- Phase 2 (Database): Commerce layer (spec §13–17).
--   * categories       — hierarchy (parent/child/level/sort/active) + seed roots
--   * products         — seller_id, category_id, slug, brand, compare_at_price,
--                        product_type, weight, moderation status, soft delete
--   * product_variants — per-variant SKU/price/weight/options/image
--   * product_images   — variant_id + thumbnail_url
--   * inventory        — variant-level stock + partial unique (product,variant)
--
-- Backward compatible: legacy `products.category` TEXT stays until the frontend
-- is migrated; `inventory` unique constraint is re-created as a partial unique
-- index so old rows (variant_id IS NULL) keep their one-row-per-product rule.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- categories — hierarchy (spec §13)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE,
  description TEXT,
  image_url   TEXT,
  parent_id   UUID REFERENCES categories (id) ON DELETE SET NULL,
  level       INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (level >= 0)
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories (parent_id);

-- Seed root categories (idempotent)
INSERT INTO categories (name, slug, level, sort_order)
SELECT * FROM (VALUES
  ('Electronics', 'electronics', 0, 1),
  ('Home',        'home',        0, 2),
  ('Beauty',      'beauty',      0, 3),
  ('Food',        'food',        0, 4),
  ('Fashion',     'fashion',     0, 5),
  ('Other',       'other',       0, 99)
) AS seed(name, slug, level, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = seed.slug);

-- ---------------------------------------------------------------------------
-- products — extend to full marketplace catalog (spec §14)
-- ---------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES sellers (id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories (id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'physical';
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC(10,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- product_type (spec §19)
DO $$
BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_product_type_check;
  ALTER TABLE products ADD CONSTRAINT products_product_type_check
    CHECK (product_type IN ('one_time','velrepeat','service','digital','physical'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- status: add moderation values (spec §14) — old values kept valid
DO $$
BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
  ALTER TABLE products ADD CONSTRAINT products_status_check
    CHECK (status IN ('draft','pending_review','published','rejected','suspended','archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill seller_id from the owning shop (legacy products were shop-scoped)
UPDATE products p
   SET seller_id = s.seller_id
  FROM shops s
 WHERE p.shop_id = s.id
   AND p.seller_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_seller ON products (seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products (slug);

-- ---------------------------------------------------------------------------
-- product_variants — per-variant SKU/price/stock/image (spec §15, §20)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  name             TEXT NOT NULL,          -- e.g. "Black / M"
  sku              TEXT UNIQUE,
  price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  compare_at_price NUMERIC(12,2),
  weight           NUMERIC(10,3),
  options          JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { color: "Black", size: "M" }
  image_url        TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants (product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants (sku);

-- ---------------------------------------------------------------------------
-- product_images — variant binding + thumbnail (spec §16)
-- ---------------------------------------------------------------------------
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants (id) ON DELETE SET NULL;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

CREATE INDEX IF NOT EXISTS idx_product_images_variant ON product_images (variant_id);

-- ---------------------------------------------------------------------------
-- inventory — variant-level stock (spec §17)
--   availableStock is computed: stock - reserved_stock (never stored)
-- ---------------------------------------------------------------------------
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants (id) ON DELETE CASCADE;

-- Replace the legacy UNIQUE (product_id) with partial unique indexes so both
-- product-level rows (variant_id NULL) and variant rows stay unique.
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_product_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_product
  ON inventory (product_id) WHERE variant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_product_variant
  ON inventory (product_id, variant_id) WHERE variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_variant ON inventory (variant_id);
