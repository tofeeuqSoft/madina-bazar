const PRESETS = [
  { v: 'today', label: 'Today' },
  { v: 'yesterday', label: 'Yesterday' },
  { v: 'week', label: 'This Week' },
  { v: 'month', label: 'This Month' },
  { v: 'lastMonth', label: 'Last Month' },
  { v: 'year', label: 'This Year' },
];

/**
 * Date presets + custom range for accounting pages.
 * value: { preset: '' | preset, from, to }
 */
export default function DateRange({ value, onChange }) {
  const set = (patch) => onChange({ ...value, preset: '', ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 overflow-x-auto">
        {PRESETS.map((p) => (
          <button
            key={p.v}
            type="button"
            onClick={() => onChange({ preset: p.v, from: '', to: '' })}
            className={`px-2.5 py-1.5 rounded-full text-xs whitespace-nowrap border transition ${
              value.preset === p.v
                ? 'bg-gray-900 text-white dark:bg-gold-400 dark:text-[#0a0f0c] border-transparent font-medium'
                : 'bg-white dark:bg-[#12241a] border-[#e5e2da] dark:border-[#2a3b30]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        type="date"
        value={value.from || ''}
        onChange={(e) => set({ from: e.target.value })}
        className="input w-auto py-1.5 text-xs"
      />
      <span className="text-xs text-gray-500">→</span>
      <input
        type="date"
        value={value.to || ''}
        onChange={(e) => set({ to: e.target.value })}
        className="input w-auto py-1.5 text-xs"
      />
    </div>
  );
}

export const rangeParams = (value) =>
  value.preset ? { preset: value.preset } : { ...(value.from ? { from: value.from } : {}), ...(value.to ? { to: value.to } : {}) };
