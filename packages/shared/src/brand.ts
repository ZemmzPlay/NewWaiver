/**
 * The design tokens as plain strings.
 *
 * Hard rule 1 says no hardcoded design values, and everywhere that CSS reaches
 * — every screen, every print stylesheet — obeys it by using the custom
 * properties in `apps/web/src/styles/tokens/`. Two places CSS cannot reach:
 *
 *   1. HTML email. Gmail and Outlook strip `:root` and do not resolve `var()`.
 *   2. ZPL. A thermal printer has no stylesheet.
 *
 * So this file exists, and it is the *only* file in the repo allowed to contain
 * a literal colour. Keep values in sync with `apps/web/src/styles/tokens/colors.css`.
 */

export const brand = {
  indigo: '#4154AC',
  indigo700: '#33428A',
  indigo100: '#D9DDEF',
  sky: '#52A0D6',
  sky100: '#DDEDF7',
  orange: '#FD7440',
  orange700: '#D95526',
  orange100: '#FFE4D9',
  yellow: '#FFCB3D',
  yellow100: '#FFF5D8',
  pink: '#E2AFD5',
  white: '#FFFFFF',
  ink900: '#151726',
  ink700: '#33364A',
  ink500: '#5C6076',
  ink100: '#E6E8EF',
  ink50: '#F4F5F9',
} as const;

/**
 * Email cannot load the brand's webfonts reliably, and Monigue is a display
 * face that has no business at 16px anyway. These stacks are the closest
 * available fallback in the order the design system would pick.
 */
export const emailFonts = {
  display: "'Arial Black', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  body: "'Helvetica Neue', Helvetica, Arial, sans-serif",
} as const;
