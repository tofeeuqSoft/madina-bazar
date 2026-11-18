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

export const StatusBadge = ({ value }) => {
  const colors = {
    OPEN: 'bg-blue-100 text-blue-700',
    ASSIGNED: 'bg-indigo-100 text-indigo-700',
    IN_PROGRESS: 'bg-amber-100 text-amber-800',
    WAITING_CUSTOMER: 'bg-orange-100 text-orange-700',
    WAITING_INTERNAL: 'bg-purple-100 text-purple-700',
    RESOLVED: 'bg-green-100 text-green-700',
    CLOSED: 'bg-gray-200 text-gray-600',
    REOPENED: 'bg-rose-100 text-rose-700',
    ACTIVE: 'bg-green-100 text-green-700',
    WAITING: 'bg-amber-100 text-amber-800',
    LOW: 'bg-gray-100 text-gray-600',
    MEDIUM: 'bg-blue-100 text-blue-700',
    HIGH: 'bg-orange-100 text-orange-700',
    URGENT: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${colors[value] || 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash'}`}>
      {value?.replace(/_/g, ' ')}
    </span>
  );
};

export const Empty = ({ text = 'No data yet' }) => (
  <p className="p-8 text-center text-sm text-gray-500 dark:text-ash">{text}</p>
);

export const inputCls =
  'w-full border border-[#e5e2da] dark:border-[#2a3b30] rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary-500';
export const btnPrimary =
  'px-4 py-2 rounded-lg text-sm font-medium bg-primary-700 text-white hover:bg-primary-800 disabled:opacity-50';
export const btnGhost =
  'px-4 py-2 rounded-lg text-sm font-medium border border-[#e5e2da] dark:border-[#2a3b30] hover:bg-black/5 dark:hover:bg-white/5';
