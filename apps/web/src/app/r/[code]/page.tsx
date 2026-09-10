import { notFound } from 'next/navigation';
import { formatRegistrationCode, normaliseRegistrationCode } from '@carnival/shared';
import { StatusScreen } from '@/components/StatusScreen';
import { currentLocale } from '@/lib/locale-server';
import { statusForCode } from '@/server/status';

export const dynamic = 'force-dynamic';

/**
 * Step 6 — confirmation — and the live status page, on one URL.
 *
 * PRD s3 wants a confirmation screen carrying the code and a prominent link to
 * the live page; PRD s6 wants the live page kept open on the phone. Folding
 * them together means the parent never has to navigate: the page they are
 * already looking at becomes the countdown once the staffer starts the clock.
 * `?welcome=1` only changes the banner at the top.
 *
 * The QR code that used to sit at the bottom of this page is gone. It only
 * earned its place if a counter had a scanner to read it, and there is no
 * scanner in the buy list — so it was a square of ink telling a parent to do
 * something nobody could act on. The screenshot prompt does the job it was
 * actually there for.
 */
export default async function StatusPage({ params, searchParams }: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ welcome?: string; added?: string }>;
}) {
  const { code: raw } = await params;
  const query = await searchParams;
  const code = normaliseRegistrationCode(raw);
  if (!code) notFound();

  const status = await statusForCode(code, await currentLocale());
  if (!status) notFound();

  return (
    <StatusScreen
      status={status}
      shownCode={formatRegistrationCode(status.code)}
      welcome={query.welcome === '1'}
      added={query.added === '1'}
    />
  );
}
