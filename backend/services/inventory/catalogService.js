import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import Category from '../../models/Category.js';
import InventoryStock from '../../models/InventoryStock.js';
import ImportBatch from '../../models/ImportBatch.js';
import { adjustStock, ensureStock, syncProductStock } from './stockService.js';
import { logInventoryAction } from './inventoryAuditService.js';

// Price swing guard: >30% change needs explicit force (prevents CSV accidents)
export const PRICE_GUARD_PCT = 30;

// Provider-agnostic media: any HTTPS URL works today (Cloudinary now,
// S3/ImgBB/Bunny tomorrow). Tag is informational only — rendering is URL-based.
const IMG_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
const VID_EXT = ['mp4', 'webm', 'mov'];

export const detectProvider = (url = '') => {
  const u = String(url).toLowerCase();
  if (u.includes('res.cloudinary.com')) return 'cloudinary';
  if (u.includes('amazonaws.com')) return 's3';
  return 'external';
};

const cleanUrl = (url = '') => String(url || '').trim();

export const validMediaUrl = (url, kind) => {
  const u = cleanUrl(url);
  if (!/^https?:\/\/.+\..+/.test(u) || u.length > 2000) return false;
  const path = u.split('?')[0].toLowerCase();
  const exts = kind === 'video' ? VID_EXT : IMG_EXT;
  return exts.some((e) => path.endsWith(`.${e}`));
};

export const parseMediaCell = (cell, kind, max) => {
  const parts = String(cell || '').split('|').map(cleanUrl).filter(Boolean).slice(0, max);
  const bad = String(cell || '').split('|').map(cleanUrl).filter(Boolean).filter((u) => !validMediaUrl(u, kind));
  return { urls: parts.filter((u) => validMediaUrl(u, kind)), bad };
};

const EDITABLE = ['regularPrice', 'salePrice', 'costPrice', 'minStock', 'isActive', 'vatExempt', 'name'];

// Category-wise product table with live stock sums (all warehouses)
export const catalogTable = async ({ category, search, page = 1, limit = 20 }) => {
  const q = {};
  if (category) q.category = category;
  if (search) {
    const { searchRegex } = await import('../../utils/safeRegex.js');
    const rx = searchRegex(search);
    q.$or = [{ name: rx }, { sku: rx }];
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [products, total] = await Promise.all([
    Product.find(q).populate('category', 'name').sort({ updatedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Product.countDocuments(q),
  ]);
  const ids = products.map((p) => p._id);
  const sums = await InventoryStock.aggregate([
    { $match: { product: { $in: ids } } },
    { $group: { _id: '$product', onHand: { $sum: '$onHand' }, available: { $sum: '$available' }, reserved: { $sum: '$reserved' } } },
  ]);
  const map = new Map(sums.map((s) => [String(s._id), s]));
  return {
    data: products.map((p) => ({
      ...p,
      stockLive: map.get(String(p._id)) || { onHand: p.stock || 0, available: p.stock || 0, reserved: 0 },
    })),
    total,
  };
};

const priceWarnings = (product, patch) => {
  const warnings = [];
  for (const f of ['regularPrice', 'salePrice', 'costPrice']) {
    if (patch[f] !== undefined && product[f] > 0) {
      const pct = Math.abs((Number(patch[f]) - product[f]) / product[f]) * 100;
      if (pct > PRICE_GUARD_PCT) warnings.push(`${f} changes ${pct.toFixed(0)}% (guard ${PRICE_GUARD_PCT}%)`);
    }
  }
  return warnings;
};

export const updateCatalogItem = async ({ productId, patch = {}, actor = null, force = false }) => {
  const product = await Product.findById(productId);
  if (!product) {
    const e = new Error('Product not found');
    e.statusCode = 404;
    throw e;
  }
  const clean = {};
  for (const f of EDITABLE) if (patch[f] !== undefined) clean[f] = patch[f];
  // Stock NEVER assigned directly — flows through the movement ledger.
  // Entered value = desired total on-hand (default warehouse); delta applied.
  let stockTarget = null;
  if (patch.stock !== undefined) {
    stockTarget = Number(patch.stock);
    if (!Number.isFinite(stockTarget) || stockTarget < 0) {
      const e = new Error('Invalid stock (must be 0 or more)');
      e.statusCode = 400;
      throw e;
    }
  }
  if (clean.name !== undefined) {
    const n = String(clean.name).trim();
    if (n.length < 2) {
      const e = new Error('Name too short');
      e.statusCode = 400;
      throw e;
    }
    clean.name = n;
  }
  for (const f of ['regularPrice', 'salePrice', 'costPrice', 'minStock']) {
    if (clean[f] !== undefined) {
      clean[f] = Number(clean[f]);
      if (!Number.isFinite(clean[f]) || clean[f] < 0) {
        const e = new Error(`Invalid ${f}`);
        e.statusCode = 400;
        throw e;
      }
    }
  }
  const warnings = priceWarnings(product, clean);
  if (warnings.length && !force) {
    const e = new Error(`Price swing guard: ${warnings.join('; ')}. Confirm with force to apply.`);
    e.statusCode = 400;
    e.code = 'PRICE_GUARD';
    throw e;
  }
  const oldValues = {};
  for (const k of Object.keys(clean)) oldValues[k] = product[k];
  Object.assign(product, clean);
  await product.save();
  if (stockTarget !== null) {
    const delta = stockTarget - (product.stock || 0);
    if (delta !== 0) {
      oldValues.stock = product.stock;
      await adjustStock({ productId: product._id, quantity: delta, bucket: 'onHand', reason: 'Catalog inline stock edit', actor, referenceId: `CATALOG:${product._id}:${Date.now()}` });
      const fresh = await Product.findById(product._id).select('stock');
      product.stock = fresh ? fresh.stock : product.stock;
    }
  }
  await logInventoryAction({ action: 'STOCK_ADJUSTED', actor, entityType: 'Product', entityId: product._id, oldValue: oldValues, newValue: clean, reason: 'Catalog inline edit' });
  return { product, warnings };
};

export const bulkCatalogEdit = async ({ ids = [], op, value, actor = null, force = false }) => {
  if (!ids.length) {
    const e = new Error('No products selected');
    e.statusCode = 400;
    throw e;
  }
  const OPS = {
    setActive: (p) => ({ isActive: !!value }),
    setVatExempt: (p) => ({ vatExempt: !!value }),
    setMinStock: (p) => ({ minStock: Math.max(0, Number(value) || 0) }),
    pricePct: (p) => {
      const mult = 1 + Number(value) / 100;
      if (!Number.isFinite(mult) || mult <= 0) throw Object.assign(new Error('Invalid percent'), { statusCode: 400 });
      return { regularPrice: round2(p.regularPrice * mult), salePrice: round2(p.salePrice * mult) };
    },
  };
  if (!OPS[op]) {
    const e = new Error('Unknown bulk op');
    e.statusCode = 400;
    throw e;
  }
  const results = [];
  for (const id of ids.slice(0, 500)) {
    try {
      const patch = OPS[op](await Product.findById(id));
      const r = await updateCatalogItem({ productId: id, patch, actor, force });
      results.push({ id, ok: true, warnings: r.warnings });
    } catch (e) {
      results.push({ id, ok: false, error: e.message });
    }
  }
  return results;
};
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// --- CSV import (quote-aware, no extra dependency) ---
export const parseCSV = (text) => {
  const rows = [];
  let cur = [];
  let field = '';
  let quoted = false;
  const push = () => {
    cur.push(field);
    field = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') push();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      push();
      if (cur.length > 1 || cur[0] !== '') rows.push(cur);
      cur = [];
    } else field += ch;
  }
  push();
  if (cur.length > 1 || cur[0] !== '') rows.push(cur);
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => String(h).trim().toLowerCase());
  return { headers, rows: rows.slice(1) };
};

const REQUIRED_COLS = ['name', 'category'];
const KNOWN_COLS = ['name', 'sku', 'category', 'regularprice', 'saleprice', 'costprice', 'stock', 'minstock', 'unit', 'size', 'color', 'vatexempt', 'isactive'];

const normKey = (k) => String(k || '').trim().toLowerCase().replace(/[\s_]+/g, '');

export const validateImport = async ({ rows, fileName = '', actor = null }) => {
  const headers = rows.length ? Object.keys(rows[0]).map(normKey) : [];
  const missing = REQUIRED_COLS.filter((c) => !headers.includes(c));
  if (missing.length) {
    const e = new Error(`Missing columns: ${missing.join(', ')}. Template: name, sku, category, regularPrice, salePrice, costPrice, stock, minStock, unit, size, color, vatExempt, isActive`);
    e.statusCode = 400;
    throw e;
  }
  const errors = [];
  const batchRows = [];
  const seenSku = new Set();
  const categories = await Category.find({}).select('name').lean();
  const catMap = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c._id]));

  let n = 0;
  for (const raw of rows.slice(0, 2000)) {
    n += 1;
    const r = {};
    for (const [k, v] of Object.entries(raw)) r[normKey(k)] = typeof v === 'string' ? v.trim() : v;
    const get = (k) => r[k] ?? '';
    const fail = (message) => errors.push({ rowNumber: n, message });

    const name = String(get('name') || '');
    if (name.length < 2) {
      fail('Name too short');
      continue;
    }
    const sku = String(get('sku') || '');
    if (sku) {
      if (seenSku.has(sku.toLowerCase())) {
        fail(`Duplicate SKU in file: ${sku}`);
        continue;
      }
      seenSku.add(sku.toLowerCase());
    }
    const catName = String(get('category') || '');
    const categoryId = /^[0-9a-fA-F]{24}$/.test(catName) ? catName : catMap.get(catName.toLowerCase());
    if (!categoryId) {
      fail(`Unknown category: ${catName || '(empty)'}`);
      continue;
    }
    const num = (k, def = 0) => {
      if (get(k) === '' || get(k) === undefined) return def;
      const v = Number(get(k));
      return Number.isFinite(v) ? v : NaN;
    };
    const regularPrice = num('regularprice', NaN);
    if (!Number.isFinite(regularPrice) || regularPrice < 0) {
      fail('Invalid regularPrice');
      continue;
    }
    const salePrice = num('saleprice', regularPrice);
    const costPrice = num('costprice', 0);
    const stock = num('stock', 0);
    const minStock = num('minstock', 5);
    if ([salePrice, costPrice, stock, minStock].some((v) => !Number.isFinite(v) || v < 0)) {
      fail('Invalid numeric field (salePrice/costPrice/stock/minStock)');
      continue;
    }
    const bool = (k, def) => {
      const v = String(get(k) ?? '').toLowerCase();
      if (v === '') return def;
      return ['1', 'true', 'yes', 'y'].includes(v);
    };

    // Media links (provider-agnostic URLs, | separated)
    const imgs = parseMediaCell(get('images'), 'image', 5);
    const vids = parseMediaCell(get('videos'), 'video', 1);
    if (imgs.bad.length || vids.bad.length) {
      fail(`Invalid media URL: ${[...imgs.bad, ...vids.bad].slice(0, 3).join(', ')}`);
      continue;
    }
    let mainIdx = parseInt(get('mainimage'), 10);
    if (!Number.isFinite(mainIdx) || mainIdx < 1 || mainIdx > Math.max(1, imgs.urls.length)) mainIdx = 1;
    const images = imgs.urls.map((url, i) => ({ url, isMain: i === mainIdx - 1, provider: detectProvider(url) }));
    const videos = vids.urls.map((url) => ({ url, provider: detectProvider(url) }));

    // Match existing by SKU (update) else create
    let existing = null;
    if (sku) existing = await Product.findOne({ sku });
    const newValues = {
      name,
      sku: sku || undefined,
      category: categoryId,
      regularPrice,
      salePrice,
      costPrice,
      stock,
      minStock,
      unit: String(get('unit') || 'Piece'),
      size: String(get('size') || ''),
      color: String(get('color') || ''),
      vatExempt: bool('vatexempt', false),
      isActive: bool('isactive', true),
      images,
      videos,
    };
    const warnings = [];
    if (existing) {
      warnings.push(...priceWarnings(existing, newValues));
      batchRows.push({ rowNumber: n, sku, action: 'UPDATE', product: existing._id, oldValues: snapshot(existing), newValues, warnings });
    } else {
      batchRows.push({ rowNumber: n, sku, action: 'CREATE', product: null, oldValues: null, newValues, warnings });
    }
  }

  const batch = await ImportBatch.create({
    fileName,
    totalRows: n,
    okRows: batchRows.length,
    errorRows: errors.length,
    rowErrors: errors.slice(0, 200),
    rows: batchRows,
    createdBy: actor?._id || actor,
  });
  return { batchId: batch.batchId, totalRows: n, okRows: batchRows.length, errorRows: errors.length, errors: errors.slice(0, 200), warnings: batchRows.filter((r) => r.warnings?.length).length };
};

const snapshot = (p) => ({
  name: p.name, regularPrice: p.regularPrice, salePrice: p.salePrice, costPrice: p.costPrice,
  stock: p.stock, minStock: p.minStock, unit: p.unit, vatExempt: p.vatExempt, isActive: p.isActive,
  images: (p.images || []).map((i) => ({ url: i.url, isMain: !!i.isMain, provider: i.provider || 'auto' })),
  videos: (p.videos || []).map((v) => ({ url: v.url, provider: v.provider || 'auto' })),
});

export const confirmImport = async ({ batchId, force = false, actor = null }) => {
  const batch = await ImportBatch.findOne({ batchId });
  if (!batch) {
    const e = new Error('Batch not found — validate first');
    e.statusCode = 404;
    throw e;
  }
  if (batch.status !== 'VALIDATED') {
    const e = new Error(`Batch already ${batch.status}`);
    e.statusCode = 400;
    throw e;
  }
  let created = 0;
  let updated = 0;
  for (const row of batch.rows) {
    try {
      if (row.action === 'CREATE') {
        const v = row.newValues;
        // Stock starts at 0 — opening units enter via the ledger below,
        // so the movement history balances from day one (never silent).
        const opening = Math.max(0, Number(v.stock) || 0);
        const doc = await Product.create({
          name: v.name, category: v.category, subcategory: null,
          regularPrice: v.regularPrice, salePrice: v.salePrice, costPrice: v.costPrice,
          sizes: v.size ? [v.size] : [], colors: v.color ? [{ name: v.color }] : [],
          images: v.images || [],
          videos: v.videos || [],
          stock: 0, minStock: v.minStock, unit: v.unit || 'Piece',
          vatExempt: !!v.vatExempt, isActive: v.isActive !== false,
          ...(v.sku ? { sku: v.sku } : {}),
        });
        row.product = doc._id;
        await ensureStock({ productId: doc._id });
        if (opening > 0) {
          await adjustStock({ productId: doc._id, quantity: opening, bucket: 'onHand', reason: `Opening stock (CSV import ${batch.batchId})`, actor, referenceId: batch.batchId });
        }
        created += 1;
      } else {
        const doc = await Product.findById(row.product);
        if (!doc) continue;
        const v = row.newValues;
        const warns = priceWarnings(doc, v);
        if (warns.length && !force) {
          row.warnings = warns;
          row.action = 'SKIPPED';
          continue;
        }
        row.oldValues = snapshot(doc);
        doc.name = v.name;
        doc.category = v.category;
        doc.regularPrice = v.regularPrice;
        doc.salePrice = v.salePrice;
        doc.costPrice = v.costPrice;
        doc.minStock = v.minStock;
        doc.unit = v.unit || doc.unit;
        doc.vatExempt = !!v.vatExempt;
        doc.isActive = v.isActive !== false;
        // Media replaces only when the CSV row carries media columns
        if ((v.images && v.images.length) || (v.videos && v.videos.length)) {
          if (v.images && v.images.length) doc.images = v.images;
          if (v.videos && v.videos.length) doc.videos = v.videos;
        }
        if (v.size) doc.sizes = [v.size];
        if (v.color) doc.colors = [{ name: v.color }];
        // Stock moves through the movement ledger (never silent)
        const delta = (v.stock || 0) - (doc.stock || 0);
        await doc.save();
        if (delta !== 0) {
          await adjustStock({ productId: doc._id, quantity: delta, bucket: 'onHand', reason: `CSV import ${batch.batchId}`, actor, referenceId: batch.batchId });
        }
        await syncProductStock(doc._id);
        updated += 1;
      }
    } catch (e) {
      row.action = 'SKIPPED';
      row.warnings = [...(row.warnings || []), e.message];
    }
  }
  batch.status = 'CONFIRMED';
  await batch.save();
  await logInventoryAction({ action: 'STOCK_ADJUSTED', actor, entityType: 'ImportBatch', entityId: batch._id, newValue: { created, updated }, reason: `CSV import ${batch.fileName}` });
  return { batchId, created, updated, skipped: batch.rows.filter((r) => r.action === 'SKIPPED').length };
};

export const rollbackImport = async ({ batchId, actor = null }) => {
  const batch = await ImportBatch.findOne({ batchId });
  if (!batch) {
    const e = new Error('Batch not found');
    e.statusCode = 404;
    throw e;
  }
  if (batch.status !== 'CONFIRMED') {
    const e = new Error('Only confirmed batches can be rolled back');
    e.statusCode = 400;
    throw e;
  }
  let deactivated = 0;
  let restored = 0;
  for (const row of batch.rows) {
    if (!row.product) continue;
    const doc = await Product.findById(row.product);
    if (!doc) continue;
    if (row.action === 'CREATE' || !row.oldValues) {
      doc.isActive = false; // never hard-delete — protects order history
      await doc.save();
      deactivated += 1;
    } else if (row.action === 'UPDATE') {
      Object.assign(doc, row.oldValues);
      await doc.save();
      restored += 1;
    }
  }
  batch.status = 'ROLLED_BACK';
  await batch.save();
  await logInventoryAction({ action: 'STOCK_ADJUSTED', actor, entityType: 'ImportBatch', entityId: batch._id, newValue: { deactivated, restored }, reason: `Rollback ${batch.batchId}` });
  return { batchId, deactivated, restored };
};
