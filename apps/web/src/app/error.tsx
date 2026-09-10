'use client';

import { useEffect } from 'react';
import { createLogger } from '@carnival/shared';

const log = createLogger('app:error-boundary');

/**
 * Last-resort net. Every flow that talks to the database already catches its
 * own errors and shows a plain sentence (see `app/actions/*`) — this only
 * fires for whatever slips past that, so it can't lean on anything those
 * flows use (locale context, a specific screen's copy) that might be part of
 * why this triggered in the first place. Deliberately plain, deliberately
 * bilingual without the i18n system, deliberately just a reload button.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    log.error('unhandled error reached the app boundary', {
      message: error.message, digest: error.digest,
    });
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: '420px' }}>
        <p style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Something went wrong. Please try again.
        </p>
        <p dir="rtl" style={{ fontSize: '1.1rem', marginBottom: '1.5rem', opacity: 0.8 }}>
          حدث خطأ ما. يرجى المحاولة مرة أخرى.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '0.75rem 1.5rem', fontSize: '1rem', borderRadius: '999px',
            border: 'none', background: '#4154AC', color: 'white', cursor: 'pointer',
          }}
        >
          Try again / أعد المحاولة
        </button>
      </div>
    </div>
  );
}
