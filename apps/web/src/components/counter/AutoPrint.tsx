'use client';

import { useEffect } from 'react';

/** Opens the print dialog once the labels have laid out. */
export function AutoPrint() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 250);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

/** A reprint, for when the first one came out crooked or the roll jammed. */
export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>
      Print again
    </button>
  );
}
