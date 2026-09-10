'use client';

import Link from 'next/link';
import { Shape } from './Brand';
import { useLocale } from './LocaleProvider';

/**
 * The top of the first screen a guardian sees.
 *
 * No wordmark: it is already in the header directly above, at a readable size.
 * No explanatory sub-head either — the tiles under it say what the choice is,
 * and a paragraph nobody reads is a paragraph between a parent holding a child
 * and the button they came to press.
 */
export function LandingHero() {
  const { t } = useLocale();

  return (
    <>
      <section className="bg-indigo px-6 pt-8 pb-8 relative overflow-hidden">
        <Shape
          name="sunburst"
          size={280}
          spin
          className="absolute -end-16 -top-16 text-white"
          style={{ opacity: 0.12 }}
        />
        <div className="relative">
          <h1 className="display" style={{ fontSize: 'var(--font-size-4xl)', color: 'var(--carnival-white)' }}>
            {t.landing.title}
          </h1>
          <p className="eyebrow mt-3" style={{ color: 'var(--carnival-yellow)' }}>
            {t.landing.takesAbout}
          </p>
        </div>
      </section>

      <section className="px-6 pt-8 pb-2">
        <Link href="/find" className="card card-poster card-lift block">
          <div className="eyebrow">{t.landing.alreadyRegistered}</div>
          <p className="mt-2 text-sm">{t.landing.alreadyRegisteredBody}</p>
          <span className="btn btn-outline btn-sm mt-4">{t.landing.findMyCode}</span>
        </Link>
      </section>
    </>
  );
}
