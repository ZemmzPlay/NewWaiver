'use client';

import { dubaiTime, formatCountdown, formatForDisplay } from '@carnival/shared';
import type { BoardRow } from '@/server/sessions';
import { TickingNumber } from '../TickingNumber';

/** Serialised over the wire, so the two Date fields arrive as strings. */
export type WireRow = Omit<BoardRow, 'startedAt' | 'endsAt'> & { startedAt: string; endsAt: string };

export function panelClass(row: WireRow): string {
  if (row.escalated) return 'panel-escalated';
  return `panel-${row.status}`;
}

/** The line every staff screen leads with: who, where, and how long is left. */
export function SessionHeadline({ row, now }: { row: WireRow; now: number }) {
  const remaining = new Date(row.endsAt).getTime() - now;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <div className="headline" style={{ fontSize: 'var(--font-size-2xl)', color: 'inherit' }}>
          {row.childName}
        </div>
        <div className="text-sm mt-1" style={{ opacity: 0.85 }}>
          {row.guardianName} · <span className="numeric">{formatForDisplay(row.guardianPhone)}</span>
        </div>
      </div>
      <div className="text-right">
        <TickingNumber
          value={formatCountdown(remaining)}
          className="display-num block"
          style={{ fontSize: 'var(--font-size-3xl)', color: 'inherit' }}
        />
        <div className="eyebrow" style={{ color: 'inherit', opacity: 0.8 }}>
          out <span className="numeric">{dubaiTime(new Date(row.endsAt))}</span>
        </div>
      </div>
    </div>
  );
}
