import { useState, useRef } from 'react';
import { ZoomIn } from 'lucide-react';

/**
 * Hover-to-zoom image (desktop). Mouse position controls zoom origin.
 * On touch devices it behaves like a normal image.
 */
export default function ZoomImage({ src, srcSet, sizes, alt = '', zoom = 2, className = '' }) {
  const [zooming, setZooming] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const ref = useRef(null);

  const handleMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setOrigin(`${x}% ${y}%`);
  };

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden group/zoom ${className}`}
      onMouseEnter={() => setZooming(true)}
      onMouseLeave={() => setZooming(false)}
      onMouseMove={handleMove}
    >
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        draggable={false}
        className="w-full h-full object-cover transition-transform duration-200 ease-out"
        style={{
          transform: zooming ? `scale(${zoom})` : 'scale(1)',
          transformOrigin: origin,
          cursor: zooming ? 'zoom-out' : 'zoom-in',
        }}
      />
      {!zooming && (
        <span className="absolute bottom-2 right-2 hidden sm:flex items-center gap-1 text-[11px] bg-black/50 text-white px-2 py-1 rounded-full opacity-0 group-hover/zoom:opacity-100 transition pointer-events-none">
          <ZoomIn className="w-3 h-3" /> Hover to zoom
        </span>
      )}
    </div>
  );
}
