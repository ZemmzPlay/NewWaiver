import type { Metadata, Viewport } from 'next';
import { direction } from '@carnival/shared';
import { LocaleProvider } from '@/components/LocaleProvider';
import { currentLocale } from '@/lib/locale-server';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Play zones — theCarnival.ae',
  description: 'Register for the Soft Play and Bouncy Castle zones.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // A guardian filling this in one-handed must not be able to zoom the layout
  // apart mid-form, but pinch-zoom stays available for the waiver text.
  maximumScale: 5,
  themeColor: '#4154AC',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await currentLocale();
  return (
    <html lang={locale} dir={direction(locale)}>
      <body>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
