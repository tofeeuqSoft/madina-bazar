/**
 * Smart product search: Bangla + English + Banglish + soft typo tolerance
 */

/** Grocery synonyms: any form → expanded terms to match DB names */
const SYNONYM_GROUPS = [
  // Rice / চাল
  ['rice', 'chal', 'chawl', 'chhal', 'চাল', 'ricee', 'rise'],
  // Oil / তেল
  ['oil', 'tel', 'teal', 'তেল', 'soyabean', 'soybean', 'soyabeenoil', 'mustard oil', 'sorisha', 'sorishatel', 'সরিষার তেল'],
  // Sugar / চিনি
  ['sugar', 'chini', 'chiny', 'chinee', 'চিনি', 'misri'],
  // Salt / লবণ
  ['salt', 'lobon', 'laban', 'লবণ', 'nun', 'noon'],
  // Flour / আটা / ময়দা
  ['flour', 'ata', 'atta', 'aata', 'আটা', 'moyda', 'maida', 'ময়দা', 'mayda'],
  // Lentils / ডাল
  ['dal', 'daal', 'dahl', 'ডাল', 'lentil', 'lentils', 'mushur', 'masoor', 'মসুর', 'mugdal', 'moong', 'মুগ'],
  // Onion / পেঁয়াজ
  ['onion', 'peaj', 'peyaj', 'piaj', 'peper', 'পেঁয়াজ', 'peyaj'],
  // Garlic / রসুন
  ['garlic', 'roshun', 'rasun', 'rosun', 'রসুন'],
  // Ginger / আদা
  ['ginger', 'ada', 'adda', 'আদা'],
  // Potato / আলু
  ['potato', 'alu', 'aaloo', 'aloo', 'আলু'],
  // Egg / ডিম
  ['egg', 'eggs', 'dim', 'deem', 'ডিম'],
  // Milk / দুধ
  ['milk', 'dudh', 'dud', 'দুধ', 'liquid milk'],
  // Tea / চা
  ['tea', 'cha', 'chai', 'চা', 'teabag'],
  // Spices / মসলা
  ['spice', 'spices', 'moshla', 'masala', 'মসলা', 'morich', 'মরিচ', 'chili', 'chilli', 'turmeric', 'holud', 'হলুদ', 'cumin', 'jeera', 'জিরা'],
  // Chicken / মুরগি
  ['chicken', 'murgi', 'murghi', 'মুরগি', 'broiler', 'cicken', 'chiken'],
  // Fish / মাছ
  ['fish', 'mach', 'maach', 'মাছ', 'rui', 'ilish', 'hilsa'],
  // Beef / গরুর মাংস
  ['beef', 'goru', 'gorur', 'গরু', 'meat', 'mangsho', 'মাংস'],
  // Frozen
  ['frozen', 'forzen', 'freeze', 'ফ্রোজেন', 'ready to cook', 'readytocook', 'rtc'],
  // Soap / সাবান
  ['soap', 'sabun', 'saban', 'সাবান', 'detergent', 'washing powder'],
  // Water / পানি
  ['water', 'pani', 'paani', 'পানি', 'mineral water'],
  // Bread / পাউরুটি
  ['bread', 'pauruti', 'pauroti', 'পাউরুটি', 'bun'],
  // Butter / মাখন
  ['butter', 'makhon', 'মাখন', 'ghee', 'ঘি', 'ghi'],
  // Honey / মধু
  ['honey', 'modhu', 'মধু'],
  // Noodles / নুডুলস
  ['noodle', 'noodles', 'নূডুলস', 'নুডলস', 'maggi', 'pasta'],
  // Biscuit
  ['biscuit', 'biscuits', 'বিস্কুট', 'cookie', 'cookies'],
  // Juice
  ['juice', 'jus', 'জুস', 'মোরব্বা'],
];

/** Build map: term → all terms in its group */
const SYNONYM_MAP = new Map();
for (const group of SYNONYM_GROUPS) {
  const normalized = group.map((t) => t.toLowerCase().trim());
  for (const term of normalized) {
    const existing = SYNONYM_MAP.get(term) || new Set();
    normalized.forEach((x) => existing.add(x));
    SYNONYM_MAP.set(term, existing);
  }
}

/** Common Bangla character / keyboard typos (optional soft replace) */
const CHAR_VARIANTS = {
  a: '[aáä@]',
  e: '[eé]',
  i: '[ií1]',
  o: '[oó0]',
  u: '[uú]',
  s: '[scz]',
  c: '[ck]',
  k: '[kc]',
  ph: '(ph|f)',
  f: '(f|ph)',
};

export function normalizeSearch(input = '') {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width
    .replace(/[।.!?,;:'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Expand query into unique search tokens (synonyms + original words)
 */
export function expandSearchTerms(query) {
  const q = normalizeSearch(query);
  if (!q) return [];

  const terms = new Set();
  terms.add(q);

  // Whole phrase synonym
  if (SYNONYM_MAP.has(q)) {
    SYNONYM_MAP.get(q).forEach((t) => terms.add(t));
  }

  // Word-level
  const words = q.split(' ').filter((w) => w.length >= 1);
  for (const w of words) {
    terms.add(w);
    if (SYNONYM_MAP.has(w)) {
      SYNONYM_MAP.get(w).forEach((t) => terms.add(t));
    }
    // Prefix matches for partial banglish: "chi" → chini group if any key starts with
    if (w.length >= 3) {
      for (const [key, group] of SYNONYM_MAP) {
        if (key.startsWith(w) || w.startsWith(key.slice(0, Math.min(4, key.length)))) {
          group.forEach((t) => terms.add(t));
        }
      }
    }
  }

  return [...terms].filter((t) => t.length >= 1).slice(0, 40);
}

/**
 * Escape regex special chars
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fuzzy regex: allow one optional char between letters for short typos
 * "chiken" ≈ chicken, "rce" soft match
 */
export function fuzzyRegex(term) {
  if (!term || term.length < 2) return escapeRegex(term);

  // For Bangla script — exact-ish contains
  if (/[\u0980-\u09FF]/.test(term)) {
    return escapeRegex(term);
  }

  // Latin: split chars with optional single-char gap for typo tolerance on longer words
  const chars = [...term];
  if (chars.length <= 3) {
    return escapeRegex(term);
  }

  // Build pattern: c h i k e n → ch?i?k?e?n with limited flexibility
  // Simpler: allow one missing character via alternation of original + deletions
  const parts = chars.map((c) => escapeRegex(c));
  // Optional middle flexibility: each char may be followed by optional typo
  return parts.join('.?');
}

/**
 * Build MongoDB $or conditions for product search
 */
export function buildProductSearchOr(query) {
  const terms = expandSearchTerms(query);
  if (!terms.length) return null;

  const or = [];

  for (const term of terms) {
    const exact = escapeRegex(term);
    const fuzzy = fuzzyRegex(term);

    or.push(
      { name: { $regex: exact, $options: 'i' } },
      { brand: { $regex: exact, $options: 'i' } },
      { sku: { $regex: exact, $options: 'i' } },
      { description: { $regex: exact, $options: 'i' } }
    );

    // Fuzzy only for latin terms length >= 4 to avoid noise
    if (term.length >= 4 && !/[\u0980-\u09FF]/.test(term) && fuzzy !== exact) {
      or.push({ name: { $regex: fuzzy, $options: 'i' } });
    }
  }

  // Also try text index if available (handled separately)
  return or.slice(0, 80); // safety cap
}

/**
 * Rank score for client/server sort (higher = better)
 */
export function scoreProduct(product, query) {
  const q = normalizeSearch(query);
  const terms = expandSearchTerms(query);
  const name = normalizeSearch(product.name || '');
  const brand = normalizeSearch(product.brand || '');
  let score = 0;

  if (name === q) score += 100;
  if (name.startsWith(q)) score += 50;
  if (name.includes(q)) score += 30;

  for (const t of terms) {
    if (name.includes(t)) score += 15;
    if (brand.includes(t)) score += 8;
  }

  return score;
}
