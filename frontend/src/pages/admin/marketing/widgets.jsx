export const Card = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-[#12241a] rounded-xl p-5 shadow-sm border border-[#e5e2da] dark:border-[#2a3b30] ${className}`}>
    {children}
  </div>
);

export const PageHead = ({ title, sub, right }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      {sub && <p className="text-sm text-gray-500 dark:text-ash mt-1">{sub}</p>}
    </div>
    {right && <div className="flex items-center gap-2">{right}</div>}
  </div>
);

export const Empty = ({ text = 'No data yet — sales will appear here as orders come in' }) => (
  <p className="p-8 text-center text-sm text-gray-500 dark:text-ash">{text}</p>
);

// Simple CSS bar chart (no chart lib needed)
export const Bars = ({ rows, labelKey = 'label', valueKey = 'value', money = false }) => {
  if (!rows?.length) return <Empty />;
  const max = Math.max(...rows.map((r) => r[valueKey] || 0), 1);
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 truncate text-gray-500">{r[labelKey]}</span>
          <div className="flex-1 h-4 rounded bg-black/5 dark:bg-white/10 overflow-hidden">
            <div className="h-full rounded bg-primary-600/80" style={{ width: `${Math.max(3, ((r[valueKey] || 0) / max) * 100)}%` }} />
          </div>
          <b className="w-20 text-right">{money ? `৳${Math.round(r[valueKey] || 0)}` : r[valueKey]}</b>
        </div>
      ))}
    </div>
  );
};

export const inputCls =
  'border border-[#e5e2da] dark:border-[#2a3b30] rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary-500';
export const btnPrimary =
  'px-4 py-2 rounded-lg text-sm font-medium bg-primary-700 text-white hover:bg-primary-800 disabled:opacity-50';
export const btnGhost =
  'px-4 py-2 rounded-lg text-sm font-medium border border-[#e5e2da] dark:border-[#2a3b30] hover:bg-black/5 dark:hover:bg-white/5';
