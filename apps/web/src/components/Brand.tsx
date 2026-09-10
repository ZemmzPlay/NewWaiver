import type { CSSProperties, ReactNode } from 'react';

/**
 * Brand primitives so screens do not re-encode sizing and colourway rules.
 * Assets live under /logo and /shapes in apps/web/public.
 */

export type Colourway = 'indigo' | 'orange' | 'pink' | 'sky' | 'white' | 'yellow';
export type ShapeName = 'clover' | 'star' | 'arch' | 'asterisk' | 'sunburst';

export function Wordmark({ colourway = 'indigo', height = 28, className = '' }: {
  colourway?: Colourway; height?: number; className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/logo/logo-${colourway}.svg`}
      alt="theCarnival.ae"
      height={height}
      style={{ height, width: 'auto', display: 'block' }}
      className={className}
    />
  );
}

/**
 * "Organized by Zawaya Gaming". The supplied lockup is wide and set small, so at
 * the 20px it used to sit at the words were unreadable — which defeats the point
 * of an endorsement mark.
 */
export function Endorsement({ height = 40 }: { height?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo/organized-by-zawaya-gaming.svg"
      alt="Organized by Zawaya Gaming"
      height={height}
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
}

/**
 * Shapes, not icons. Decorative, meaningless individually, interchangeable.
 * Never a button glyph and never a nav item.
 */
export function Shape({ name, size = 48, className = '', spin = false, style }: {
  name: ShapeName; size?: number | string; className?: string; spin?: boolean; style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`shape-mask ${spin ? 'shape-spin' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        WebkitMaskImage: `url(/shapes/${name}.svg)`,
        maskImage: `url(/shapes/${name}.svg)`,
        ...style,
      }}
    />
  );
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`eyebrow ${className}`}>{children}</div>;
}

/** Marquee strips of caps type. Ambient, and the only other thing that loops. */
export function Marquee({ items, className = '' }: { items: string[]; className?: string }) {
  const run = [...items, ...items];
  return (
    <div className={`marquee ${className}`} aria-hidden="true">
      <div className="marquee-track">
        {run.map((item, index) => (
          <span key={`${item}-${index}`} className="eyebrow" style={{ color: 'inherit' }}>{item}</span>
        ))}
      </div>
    </div>
  );
}
