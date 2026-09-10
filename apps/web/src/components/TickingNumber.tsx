'use client';

/**
 * A number that changes while you are looking at it, set in the display face.
 *
 * Monigue's figures are proportional and it has no `tnum` feature — "1" is 267
 * units where "5" is 407, on a 1000-unit em. At display size a countdown
 * redrawing every second visibly shifts as its digits change, and the eye reads
 * that movement as something happening.
 *
 * `font-variant-numeric: tabular-nums` cannot help without the feature in the
 * font, so each digit gets a fixed-width cell instead. Separators — the colon
 * in a clock, a minus sign — keep their natural width, because they never
 * change and boxing them would only add gaps.
 *
 * This is what lets the brand face carry every number in the product. The
 * alternative was setting countdowns in Google Sans, which put two different
 * typefaces side by side on the confirmation screen.
 */
export function TickingNumber({ value, className = '', style }: {
  value: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={className}
      style={{ direction: 'ltr', unicodeBidi: 'isolate', whiteSpace: 'nowrap', ...style }}
      // Screen readers get the plain string; the per-digit spans are visual only.
      aria-label={value}
    >
      {[...value].map((char, index) =>
        /\d/.test(char) ? (
          <span
            key={index}
            aria-hidden="true"
            style={{ display: 'inline-block', width: 'var(--digit-cell)', textAlign: 'center' }}
          >
            {char}
          </span>
        ) : (
          <span key={index} aria-hidden="true">{char}</span>
        ),
      )}
    </span>
  );
}
