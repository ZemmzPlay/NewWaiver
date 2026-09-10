'use server';

import { headers } from 'next/headers';
import { isLocale, normaliseRegistrationCode } from '@carnival/shared';
import { createLogger } from '@carnival/shared';
import { requestLoginCode, verifyLoginCode } from '@/server/guardian-login';
import { registrationByCode } from '@/server/registration';

const log = createLogger('actions:login');

export type RequestCodeResult =
  | { ok: true; emailHint: string }
  | { ok: false; reason: 'not_found' | 'too_many' | 'send_failed' };

export async function requestCodeAction(phone: string, locale: string): Promise<RequestCodeResult> {
  try {
    const headerList = await headers();
    const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim();
    return await requestLoginCode(phone, isLocale(locale) ? locale : 'en', ip);
  } catch (error) {
    log.error('requestCodeAction threw', { message: error instanceof Error ? error.message : String(error) });
    return { ok: false, reason: 'send_failed' };
  }
}

export type VerifyCodeResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'bad_code' | 'too_many' | 'not_found' };

export async function verifyCodeAction(phone: string, otp: string): Promise<VerifyCodeResult> {
  try {
    return await verifyLoginCode(phone, otp);
  } catch (error) {
    log.error('verifyCodeAction threw', { message: error instanceof Error ? error.message : String(error) });
    return { ok: false, reason: 'bad_code' };
  }
}

/** The other way in: they still have the six digits, so no email is needed. */
export async function lookUpCodeAction(input: string): Promise<{ ok: boolean }> {
  try {
    const code = normaliseRegistrationCode(input);
    if (!code) return { ok: false };
    return { ok: Boolean(await registrationByCode(code)) };
  } catch (error) {
    log.error('lookUpCodeAction threw', { message: error instanceof Error ? error.message : String(error) });
    return { ok: false };
  }
}
