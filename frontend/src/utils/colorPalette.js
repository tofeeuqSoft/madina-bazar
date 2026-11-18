// Shared preset color palette — used in Admin ProductForm (quick add)
// and Customer ProductDetails (swatch display). Keep names short so they
// fit under swatches on small screens.

export const PRESET_COLORS = [
  { name: 'Black', code: '#000000' },
  { name: 'White', code: '#ffffff' },
  { name: 'Gray', code: '#9e9e9e' },
  { name: 'Silver', code: '#c0c0c0' },
  { name: 'Red', code: '#e53935' },
  { name: 'Maroon', code: '#7b1e1e' },
  { name: 'Orange', code: '#fb8c00' },
  { name: 'Yellow', code: '#fdd835' },
  { name: 'Olive', code: '#808000' },
  { name: 'Green', code: '#43a047' },
  { name: 'Teal', code: '#00897b' },
  { name: 'Sky', code: '#29b6f6' },
  { name: 'Blue', code: '#1e88e5' },
  { name: 'Navy', code: '#1f3557' },
  { name: 'Purple', code: '#8e24aa' },
  { name: 'Pink', code: '#ec407a' },
  { name: 'Brown', code: '#6d4c41' },
  { name: 'Beige', code: '#e8d5a3' },
  { name: 'Golden', code: '#d9a857' },
  { name: 'Cream', code: '#f7f5f0' },
];

export const findPresetByName = (name) =>
  PRESET_COLORS.find((c) => c.name.toLowerCase() === String(name || '').toLowerCase());

export default PRESET_COLORS;
