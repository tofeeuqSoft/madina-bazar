/**
 * Cursor-based pagination helpers
 * Cursor = base64url(JSON({ id, sortValue, sort }))
 * Stable order: primary sort field + _id
 */

import mongoose from 'mongoose';

export function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const json = Buffer.from(String(cursor), 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Parse sort string like "-createdAt" | "salePrice" | "-salePrice" | "name"
 * @returns {{ field: string, dir: 1|-1 }}
 */
export function parseSort(sort = '-createdAt') {
  const raw = String(sort || '-createdAt');
  const dir = raw.startsWith('-') ? -1 : 1;
  const field = raw.replace(/^-/, '') || 'createdAt';
  // whitelist
  const allowed = new Set([
    'createdAt',
    'updatedAt',
    'salePrice',
    'regularPrice',
    'name',
    'stock',
  ]);
  return {
    field: allowed.has(field) ? field : 'createdAt',
    dir,
  };
}

/**
 * Build Mongo sort object: primary field + _id for stability
 */
export function buildSortObject(sortStr) {
  const { field, dir } = parseSort(sortStr);
  return { [field]: dir, _id: dir };
}

/**
 * Cursor filter: items "after" the cursor in sort order
 */
export function buildCursorFilter(cursor, sortStr) {
  const decoded = decodeCursor(cursor);
  if (!decoded?.id) return null;

  const { field, dir } = parseSort(sortStr);
  const id = mongoose.isValidObjectId(decoded.id)
    ? new mongoose.Types.ObjectId(decoded.id)
    : decoded.id;

  const sortValue = decoded.sortValue;

  // For desc (dir=-1): next page has smaller values OR same value + smaller _id
  // For asc  (dir=1):  next page has larger values OR same value + larger _id
  if (sortValue === undefined || sortValue === null) {
    return dir === -1 ? { _id: { $lt: id } } : { _id: { $gt: id } };
  }

  if (dir === -1) {
    return {
      $or: [
        { [field]: { $lt: sortValue } },
        { [field]: sortValue, _id: { $lt: id } },
      ],
    };
  }

  return {
    $or: [
      { [field]: { $gt: sortValue } },
      { [field]: sortValue, _id: { $gt: id } },
    ],
  };
}

/**
 * Create next cursor from last document
 */
export function nextCursorFromDoc(doc, sortStr) {
  if (!doc?._id) return null;
  const { field } = parseSort(sortStr);
  return encodeCursor({
    id: String(doc._id),
    sortValue: doc[field],
    sort: sortStr,
  });
}

/**
 * Run cursor query
 * @returns {{ items, nextCursor, hasMore, limit }}
 */
export async function paginateCursor(Model, {
  filter = {},
  sort = '-createdAt',
  cursor,
  limit = 20,
  populate,
  select,
  lean = true,
}) {
  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const sortObj = buildSortObject(sort);
  const cursorFilter = buildCursorFilter(cursor, sort);

  const finalFilter = cursorFilter
    ? { $and: [filter, cursorFilter] }
    : filter;

  let q = Model.find(finalFilter).sort(sortObj).limit(limitNum + 1);
  if (select) q = q.select(select);
  if (populate) {
    if (Array.isArray(populate)) populate.forEach((p) => { q = q.populate(p); });
    else q = q.populate(populate);
  }
  if (lean) q = q.lean();

  const rows = await q;
  const hasMore = rows.length > limitNum;
  const items = hasMore ? rows.slice(0, limitNum) : rows;
  const nextCursor = hasMore
    ? nextCursorFromDoc(items[items.length - 1], sort)
    : null;

  return {
    items,
    nextCursor,
    hasMore,
    limit: limitNum,
  };
}
