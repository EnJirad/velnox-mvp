/**
 * Velnox Backend — Categories (spec §11, §13).
 *
 * Hierarchical: parentId + level + sortOrder. The tree is built server-side so
 * the frontend gets a ready-to-render tree (or a flat list for filters).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
import type { Db } from "./db";
import { AppError } from "./errors";
import type { Category } from "./types";

function mapCategory(r: Record<string, any>): Category {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug ?? null,
    description: r.description ?? null,
    imageUrl: r.image_url ?? null,
    parentId: r.parent_id ?? null,
    level: Number(r.level),
    sortOrder: Number(r.sort_order),
    isActive: Boolean(r.is_active),
  };
}

export async function listCategories(db: Db, onlyActive = true): Promise<Category[]> {
  const rows = await db(
    `SELECT * FROM categories
     ${onlyActive ? "WHERE is_active = true" : ""}
     ORDER BY sort_order ASC, name ASC`,
  );
  return rows.map(mapCategory);
}

/** Nested tree: [{ ...category, children: [...] }] — for the storefront. */
export async function categoryTree(db: Db): Promise<Category[]> {
  const all = await listCategories(db, true);
  const byParent = new Map<string | null, Category[]>();
  for (const c of all) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  const attach = (parentId: string | null): Category[] =>
    (byParent.get(parentId) ?? []).map((c) => ({ ...c, children: attach(c.id) }));
  return attach(null);
}

export interface CreateCategoryInput {
  name: string;
  slug?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  sortOrder?: number;
}

export async function createCategory(db: Db, input: CreateCategoryInput): Promise<Category> {
  const name = input.name.trim();
  if (!name) throw new AppError("INVALID_INPUT", "กรุณากรอกชื่อหมวดหมู่");
  let level = 0;
  if (input.parentId) {
    const parent = await db("SELECT level FROM categories WHERE id = $1", [input.parentId]);
    if (!parent[0]) throw new AppError("NOT_FOUND", "ไม่พบหมวดหมู่หลัก");
    level = Number(parent[0].level) + 1;
  }
  const slug = input.slug?.trim() || slugify(name);
  const rows = await db(
    `INSERT INTO categories (name, slug, description, image_url, parent_id, level, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [name, slug, input.description ?? null, input.imageUrl ?? null, input.parentId ?? null, level, input.sortOrder ?? 0],
  );
  return mapCategory(rows[0]);
}

export async function updateCategory(
  db: Db,
  categoryId: string,
  patch: Partial<Pick<Category, "name" | "description" | "imageUrl" | "isActive" | "sortOrder" | "parentId">>,
): Promise<Category> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, string> = {
    name: "name",
    description: "description",
    imageUrl: "image_url",
    isActive: "is_active",
    sortOrder: "sort_order",
    parentId: "parent_id",
  };
  for (const [k, col] of Object.entries(map)) {
    const val = (patch as Record<string, unknown>)[k];
    if (val !== undefined) {
      sets.push(`${col} = $${sets.length + 1}`);
      values.push(val);
    }
  }
  if (sets.length === 0) {
    const rows = await db("SELECT * FROM categories WHERE id = $1", [categoryId]);
    if (!rows[0]) throw new AppError("NOT_FOUND", "ไม่พบหมวดหมู่");
    return mapCategory(rows[0]);
  }
  values.push(categoryId);
  const rows = await db(`UPDATE categories SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
  if (!rows[0]) throw new AppError("NOT_FOUND", "ไม่พบหมวดหมู่");
  return mapCategory(rows[0]);
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\u0E00-\u0E7F]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
