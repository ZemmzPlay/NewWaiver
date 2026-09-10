'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import { signOutAction } from '@/app/actions/counter';
import { Wordmark } from '../Brand';
import { LocaleToggle } from '../LocaleToggle';
import { useLocale } from '../LocaleProvider';

/**
 * The staff frame. Dark indigo so a counter screen never gets mistaken for the
 * guardian's phone, and three destinations only — there is nowhere else to go.
 *
 * The language toggle is here too. The counter script is written in English and
 * that is how the staff are briefed, but the person reading this screen at 3pm
 * on day three may not be the person who was briefed on day one.
 */
export function CounterChrome({ zoneName, staffRole, children, active }: {
  zoneName: string;
  staffRole: string;
  children: ReactNode;
  active: 'check-in' | 'board' | 'pickup' | 'overview' | 'admin';
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [signingOut, startSignOut] = useTransition();
  const supervisor = staffRole === 'supervisor' || staffRole === 'admin';
  const tabs = [
    { key: 'check-in' as const, label: t.counter.checkIn, href: '/counter' },
    { key: 'board' as const, label: t.counter.board, href: '/counter/board' },
    { key: 'pickup' as const, label: t.counter.pickup, href: '/counter/pickup' },
    // A counter staffer has three destinations and no more. These two appear
    // only for the people they are for.
    ...(supervisor ? [{ key: 'overview' as const, label: t.counter.overview, href: '/counter/overview' }] : []),
    ...(supervisor ? [{ key: 'admin' as const, label: t.counter.staffAdmin, href: '/counter/admin' }] : []),
  ];

  return (
    <div className="min-h-dvh flex flex-col bg-counter">
      <header className="bg-indigo px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <Wordmark colourway="white" height={26} />
          <div>
            <div className="eyebrow" style={{ color: 'var(--carnival-yellow)' }}>{zoneName}</div>
            <div className="text-2xs text-white" style={{ opacity: 0.7 }}>{t.counter.signedIn(staffRole)}</div>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2 items-center">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`btn btn-sm ${active === tab.key ? 'btn-accent' : ''}`}
              style={active === tab.key ? undefined : {
                background: 'transparent',
                color: 'var(--carnival-white)',
                border: '2px solid rgba(255,255,255,.35)',
              }}
            >
              {tab.label}
            </Link>
          ))}
          <LocaleToggle onDark />
          {/*
            Shift handover. Without this a laptop stayed locked to whoever
            typed a PIN first, for twelve hours — so a supervisor could not
            open the overview on a counter machine, and a staffer going off
            shift left their session running on it.
          */}
          <button
            type="button"
            className="btn btn-sm"
            disabled={signingOut}
            style={{ background: 'transparent', color: 'var(--carnival-white)', border: '2px solid rgba(255,255,255,.35)' }}
            onClick={() => startSignOut(async () => { await signOutAction(); router.refresh(); })}
          >
            {t.counter.endShift}
          </button>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
