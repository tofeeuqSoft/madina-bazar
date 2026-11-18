export const tk = (v) => `৳${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const toCSV = (head, rows) => {
  const esc = (c) => `"${String(c ?? '').replace(/"/g, '""')}"`;
  return [head.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
};

export const downloadCSV = (name, head, rows) => {
  const blob = new Blob([toCSV(head, rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const monthAgoStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};
