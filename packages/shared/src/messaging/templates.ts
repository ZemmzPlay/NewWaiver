/**
 * The three emails from PRD s6, in the brand's voice: short imperative
 * sentences, ALL CAPS display lines, no exclamation marks in body copy.
 *
 * Built as tables with inline styles because that is the only thing every
 * client renders the same way. Colours come from `brand`, which is the one
 * sanctioned place for a literal - see the note in brand.ts.
 */

import { brand, emailFonts } from '../brand.js';
import { type Locale, localiseDigits } from '../i18n/index.js';
import type { OutboundMessage } from './channel.js';

export interface TemplateContext {
  /** Public base URL, e.g. https://waiver.thecarnival.ae */
  baseUrl: string;
  eventName: string;
  /** The language the guardian filled the form in. Defaults to English. */
  locale?: Locale;
}

/**
 * Email copy in both languages.
 *
 * Kept here rather than in the shared dictionary because these strings only
 * ever render inside an email, and an email is the one surface where a missing
 * translation is invisible until a parent complains.
 */
const COPY = {
  en: {
    registeredEyebrow: 'You are registered',
    showCode: (zone: string) => `Show this code at the ${zone} counter and we will get everyone inside.`,
    keepOpen: 'Keep the live page open on your phone.',
    keepOpenBody: 'It shows a countdown for each child, and it is faster than email in a loud hall.',
    openLive: 'Open the live page',
    clockNote: "The clock starts at the counter, not now. Your child's sticker carries their pickup time.",
    minutesLeft: (n: number) => `${n} minutes left`,
    nearlyUp: 'Time is nearly up',
    finishesAt: (child: string, time: string) => `<strong>${child}</strong> finishes at <strong>${time}</strong>.`,
    headBack: (zone: string) => `Head back to the <strong>${zone}</strong> counter now.`,
    seeCountdown: 'See the countdown',
    readyEyebrow: 'Ready for pickup',
    comeBack: 'Please come back now',
    waiting: (child: string) => `<strong>${child}</strong> has finished and is waiting for you.`,
    returnNow: (zone: string, code: string) =>
      `Please return to the <strong>${zone}</strong> counter now. Bring your code <strong>${code}</strong>.`,
    loginEyebrow: 'Your sign-in code',
    loginHeadline: 'Open your page',
    loginBody: 'Type this code on the Carnival page to open your family page again.',
    loginExpiry: 'It works for 10 minutes. If you did not ask for it, ignore this email — nobody can get in without it.',
    minutesUnit: 'min',
    subjectRegistered: (code: string) => `Your Carnival code is ${code}`,
    subjectWarning: (n: number, child: string) => `${n} minutes left — ${child}`,
    subjectPickup: (child: string) => `Please come back for ${child}`,
    subjectLogin: (code: string) => `${code} is your Carnival sign-in code`,
    footer: 'theCARNIVAL.ae &nbsp;&middot;&nbsp; Organized by Zawaya Gaming',
  },
  ar: {
    registeredEyebrow: 'تم تسجيلك',
    showCode: (zone: string) => `أظهر هذا الرمز عند استقبال ${zone} وسندخل الجميع.`,
    keepOpen: 'أبقِ الصفحة المباشرة مفتوحة على جوالك.',
    keepOpenBody: 'تعرض العد التنازلي لكل طفل، وهي أسرع من البريد داخل قاعة صاخبة.',
    openLive: 'افتح الصفحة المباشرة',
    clockNote: 'يبدأ الوقت عند الاستقبال لا الآن. ملصق طفلك يحمل وقت الاستلام.',
    minutesLeft: (n: number) => `بقيت ${n} دقائق`,
    nearlyUp: 'الوقت شارف على الانتهاء',
    finishesAt: (child: string, time: string) => `<strong>${child}</strong> ينتهي عند <strong>${time}</strong>.`,
    headBack: (zone: string) => `عُد الآن إلى استقبال <strong>${zone}</strong>.`,
    seeCountdown: 'شاهد العد التنازلي',
    readyEyebrow: 'جاهز للاستلام',
    comeBack: 'رجاءً عُد الآن',
    waiting: (child: string) => `<strong>${child}</strong> أنهى وقته وينتظرك.`,
    returnNow: (zone: string, code: string) =>
      `رجاءً عُد الآن إلى استقبال <strong>${zone}</strong>. أحضر رمزك <strong>${code}</strong>.`,
    loginEyebrow: 'رمز الدخول',
    loginHeadline: 'افتح صفحتك',
    loginBody: 'اكتب هذا الرمز في صفحة كرنفال لفتح صفحة عائلتك من جديد.',
    loginExpiry: 'صالح لعشر دقائق. إن لم تطلبه، تجاهل هذه الرسالة — لا يمكن لأحد الدخول بدونه.',
    minutesUnit: 'دقيقة',
    subjectRegistered: (code: string) => `رمز كرنفال الخاص بك: ${code}`,
    subjectWarning: (n: number, child: string) => `بقيت ${n} دقائق — ${child}`,
    subjectPickup: (child: string) => `رجاءً عُد لاستلام ${child}`,
    subjectLogin: (code: string) => `${code} رمز الدخول إلى كرنفال`,
    footer: 'theCARNIVAL.ae &nbsp;&middot;&nbsp; تنظيم زوايا جيمنج',
  },
} as const;

function copy(ctx: TemplateContext) {
  return COPY[ctx.locale === 'ar' ? 'ar' : 'en'];
}

/**
 * Wraps a Latin-digit run so an Arabic paragraph cannot reorder it. Codes,
 * times and phone numbers all need this; ordinary numbers inside a sentence do
 * not, because they are single runs with nothing to swap around.
 */
function ltr(value: string): string {
  return `<span dir="ltr" style="unicode-bidi:isolate;display:inline-block">${value}</span>`;
}

/**
 * The same isolation for places that cannot carry markup: the subject line and
 * the plain-text part. U+2066 LEFT-TO-RIGHT ISOLATE and U+2069 POP DIRECTIONAL
 * ISOLATE are invisible, and every mail client that does bidi at all honours
 * them. Without this a subject reading "your code is 815 646" arrives in an
 * Arabic inbox as "646 815".
 */
function ltrText(value: string): string {
  return `\u2066${value}\u2069`;
}

function layout(opts: {
  preheader: string;
  ground: string;
  onGround: string;
  eyebrow: string;
  headline: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
  footNote?: string;
  locale?: Locale;
  footer: string;
}): string {
  const rtl = opts.locale === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';
  const align = rtl ? 'right' : 'left';
  const cta = opts.cta
    ? `<tr><td align="${align}" style="padding:0 32px 32px">
         <a href="${opts.cta.href}" style="display:inline-block;background:${brand.orange};color:${brand.white};font-family:${emailFonts.body};font-size:15px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;padding:16px 32px;border-radius:999px">${opts.cta.label}</a>
       </td></tr>`
    : '';
  const foot = opts.footNote
    ? `<tr><td align="${align}" style="padding:0 32px 32px;font-family:${emailFonts.body};font-size:13px;line-height:1.65;color:${brand.ink500}">${opts.footNote}</td></tr>`
    : '';

  return `<!doctype html><html lang="${opts.locale ?? 'en'}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body dir="${dir}" style="margin:0;padding:0;background:${brand.ink50}">
<span style="display:none;font-size:1px;color:${brand.ink50};max-height:0;overflow:hidden">${opts.preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.ink50};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${brand.white};border-radius:16px;overflow:hidden">
  <tr><td align="${align}" style="background:${opts.ground};padding:32px">
    <div style="font-family:${emailFonts.body};font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${opts.onGround};opacity:.75">${opts.eyebrow}</div>
    <div style="font-family:${emailFonts.display};font-size:34px;line-height:1.05;letter-spacing:.01em;text-transform:uppercase;color:${opts.onGround};padding-top:8px">${opts.headline}</div>
  </td></tr>
  <tr><td align="${align}" style="padding:32px 32px 24px;font-family:${emailFonts.body};font-size:16px;line-height:1.65;color:${brand.ink700}">${opts.bodyHtml}</td></tr>
  ${cta}
  ${foot}
  <tr><td align="${align}" style="background:${brand.indigo};padding:20px 32px;font-family:${emailFonts.body};font-size:12px;line-height:1.6;color:${brand.white};opacity:.9">
    ${opts.footer}
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

export interface RegistrationEmailInput {
  code: string;
  children: { firstName: string; zoneName: string; minutes: number }[];
  guardianFirstName: string;
}

export function registrationEmail(ctx: TemplateContext, input: RegistrationEmailInput): Omit<OutboundMessage, 'to' | 'reference'> {
  const t = copy(ctx);
  const statusUrl = `${ctx.baseUrl}/r/${input.code}`;
  // Grouped three and three, exactly as it appears on screen and is said aloud.
  const shown = `${input.code.slice(0, 3)} ${input.code.slice(3)}`;
  const end = ctx.locale === 'ar' ? 'left' : 'right';
  const rows = input.children
    .map((c) => `<tr><td style="padding:6px 0;font-weight:700">${c.firstName}</td><td style="padding:6px 0;text-align:${end};color:${brand.ink500}">${c.zoneName} &middot; ${localiseDigits(c.minutes, ctx.locale ?? 'en')} ${t.minutesUnit}</td></tr>`)
    .join('');

  const html = layout({
    locale: ctx.locale,
    footer: t.footer,
    preheader: `${shown}`,
    ground: brand.yellow,
    onGround: brand.indigo,
    eyebrow: t.registeredEyebrow,
    // The space inside the code makes it two bidi runs, and an Arabic paragraph
    // reorders them: "815 646" renders as "646 815". Isolating the run is the
    // difference between a parent reading their code out correctly and not.
    headline: ltr(shown),
    bodyHtml: `
      <p style="margin:0 0 16px">${t.showCode(input.children[0]?.zoneName ?? '')}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;border-top:1px solid ${brand.ink100};border-bottom:1px solid ${brand.ink100};margin:0 0 16px">${rows}</table>
      <p style="margin:0"><strong>${t.keepOpen}</strong> ${t.keepOpenBody}</p>`,
    cta: { label: t.openLive, href: statusUrl },
    footNote: t.clockNote,
  });

  const text = [
    ltrText(shown),
    '',
    ...input.children.map((c) => `- ${c.firstName}: ${c.zoneName}, ${c.minutes} min`),
    '',
    statusUrl,
  ].join('\n');

  return { subject: t.subjectRegistered(ltrText(shown)), html, text };
}

export interface WarningEmailInput {
  code: string;
  childFirstName: string;
  zoneName: string;
  minutesLeft: number;
  endsAtLocal: string;
}

export function expiryWarningEmail(ctx: TemplateContext, input: WarningEmailInput): Omit<OutboundMessage, 'to' | 'reference'> {
  const t = copy(ctx);
  const statusUrl = `${ctx.baseUrl}/r/${input.code}`;
  const html = layout({
    locale: ctx.locale,
    footer: t.footer,
    preheader: `${input.childFirstName} — ${input.endsAtLocal}`,
    ground: brand.orange,
    onGround: brand.white,
    eyebrow: t.minutesLeft(input.minutesLeft),
    headline: t.nearlyUp,
    bodyHtml: `
      <p style="margin:0 0 16px">${t.finishesAt(input.childFirstName, input.endsAtLocal)}</p>
      <p style="margin:0">${t.headBack(input.zoneName)}</p>`,
    cta: { label: t.seeCountdown, href: statusUrl },
  });
  const text = `${input.childFirstName} — ${input.endsAtLocal} — ${input.zoneName}\n\n${statusUrl}`;
  return { subject: t.subjectWarning(input.minutesLeft, input.childFirstName), html, text };
}

export interface PickupEmailInput {
  code: string;
  childFirstName: string;
  zoneName: string;
}

export function pickupRequestEmail(ctx: TemplateContext, input: PickupEmailInput): Omit<OutboundMessage, 'to' | 'reference'> {
  const t = copy(ctx);
  const statusUrl = `${ctx.baseUrl}/r/${input.code}`;
  const shown = `${input.code.slice(0, 3)} ${input.code.slice(3)}`;
  const html = layout({
    locale: ctx.locale,
    footer: t.footer,
    preheader: input.childFirstName,
    ground: brand.indigo,
    onGround: brand.white,
    eyebrow: t.readyEyebrow,
    headline: t.comeBack,
    bodyHtml: `
      <p style="margin:0 0 16px">${t.waiting(input.childFirstName)}</p>
      <p style="margin:0">${t.returnNow(input.zoneName, ltr(shown))}</p>`,
    cta: { label: t.openLive, href: statusUrl },
  });
  const text = `${input.childFirstName} — ${input.zoneName} — ${shown}\n\n${statusUrl}`;
  return { subject: t.subjectPickup(input.childFirstName), html, text };
}

export interface LoginEmailInput {
  /** The six-digit one-time code. Never the registration code. */
  otp: string;
}

/**
 * The sign-in code for "open my page again".
 *
 * Deliberately the plainest of the four: no countdown, no link that logs
 * anybody in, and nothing about which children are registered — this email is
 * sent to an address on the say-so of a phone number, so until the code comes
 * back it tells the reader nothing they did not already know.
 */
export function loginCodeEmail(ctx: TemplateContext, input: LoginEmailInput): Omit<OutboundMessage, 'to' | 'reference'> {
  const t = copy(ctx);
  const html = layout({
    locale: ctx.locale,
    footer: t.footer,
    preheader: input.otp,
    ground: brand.indigo,
    onGround: brand.white,
    eyebrow: t.loginEyebrow,
    headline: ltr(input.otp),
    bodyHtml: `
      <p style="margin:0 0 16px">${t.loginBody}</p>
      <p style="margin:0;color:${brand.ink500};font-size:14px">${t.loginExpiry}</p>`,
  });
  return { subject: t.subjectLogin(ltrText(input.otp)), html, text: input.otp };
}
