import { Star } from 'lucide-react';

/**
 * Star rating display / input.
 * @param value 0-5 (supports halves for display)
 * @param onRate fn(n) — when provided, stars are clickable
 * @param size icon size
 */
export default function Stars({ value = 0, onRate = null, size = 16, className = '' }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {stars.map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return onRate ? (
          <button
            key={n}
            type="button"
            onClick={() => onRate(n)}
            className="p-0.5 hover:scale-110 transition"
            aria-label={`Rate ${n}`}
          >
            <Star
              style={{ width: size, height: size }}
              className={n <= Math.round(value) ? 'fill-gold-400 text-gold-400' : 'text-gray-300 dark:text-gray-600'}
            />
          </button>
        ) : (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star style={{ width: size, height: size }} className="absolute inset-0 text-gray-300 dark:text-gray-600" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star style={{ width: size, height: size }} className="fill-gold-400 text-gold-400" />
            </span>
          </span>
        );
      })}
    </span>
  );
}
