import { Trash2 } from 'lucide-react';

/**
 * Diagram-exact delivery alert. Shared by Cart + Checkout.
 * Shows unavailable grocery lines, available nationwide lines,
 * and a single "Remove unavailable items" action.
 */
export default function AvailabilityAlert({ result, onRemove, compact = false }) {
  const lines = result?.lines || [];
  if (!lines.length) return null;

  const unavailable = lines.filter((l) => !l.available);
  const availableNationwide = lines.filter((l) => l.available && !l.isGrocery);
  if (!unavailable.length) return null;

  const groceryOut = unavailable.filter((l) => l.reason === 'OUT_OF_ZONE');
  const others = unavailable.filter((l) => l.reason !== 'OUT_OF_ZONE');

  return (
    <div className={`rounded-xl border border-danger/40 bg-danger/5 ${compact ? 'p-3' : 'p-3.5'} text-sm`}>
      <p className="font-semibold text-danger mb-1">⚠️ Some items are not available at your delivery address.</p>

      {groceryOut.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Grocery Items</p>
          {groceryOut.map((l) => (
            <p key={l.key} className="text-gray-700 dark:text-gray-200 text-[13px]">
              ❌ {l.name} <span className="text-gray-500">— {l.message}</span>
            </p>
          ))}
        </div>
      )}

      {others.map((l) => (
        <p key={l.key} className="text-gray-700 dark:text-gray-200 text-[13px] mt-1">
          ❌ {l.name} <span className="text-gray-500">— {l.message}</span>
        </p>
      ))}

      <div className="border-t border-danger/20 mt-2.5 pt-2.5" />

      {availableNationwide.slice(0, 5).map((l) => (
        <p key={l.key} className="text-gray-700 dark:text-gray-200 text-[13px]">
          {l.name} <span className="text-success font-medium">✓ Available</span>
        </p>
      ))}
      {availableNationwide.length > 5 && (
        <p className="text-xs text-gray-500">+{availableNationwide.length - 5} more available</p>
      )}

      <button
        type="button"
        onClick={() => onRemove?.(unavailable)}
        className="btn-outline text-xs mt-2.5 inline-flex items-center gap-1"
      >
        <Trash2 className="w-3.5 h-3.5" /> Remove unavailable items
      </button>
    </div>
  );
}
