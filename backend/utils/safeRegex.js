// Escape user input before new RegExp() — prevents ReDoS and
// "Invalid regular expression" 500s from crafted search strings.
export const escapeRegExp = (s) => String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const searchRegex = (s) => new RegExp(escapeRegExp(String(s ?? '').trim()), 'i');

export default { escapeRegExp, searchRegex };
