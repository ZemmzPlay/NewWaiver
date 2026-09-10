'use server';

import { headers } from 'next/headers';
import { createLogger } from '@carnival/shared';
import type { RegisterInput } from '@carnival/shared';
import { currentDictionary } from '@/lib/locale-server';
import { register } from '@/server/registration';

const log = createLogger('action:register');

export type RegisterActionResult =
  | { ok: true; code: string; merged: boolean; emailQueued: boolean }
  | { ok: false; message: string };

/**
 * Errors reach the guardian as a plain sentence, in their own language. Never a
 * stack trace, and never a validation message that echoes back what they typed.
 */
export async function registerAction(input: RegisterInput): Promise<RegisterActionResult> {
  const t = await currentDictionary();
  const messages: Record<string, string> = {
    WAIVER_SUPERSEDED: t.errors.waiverSuperseded,
    UNKNOWN_PACKAGE: t.errors.unknownPackage,
  };
  try {
    const headerList = await headers();
    const result = await register(input, {
      ip: headerList.get('x-forwarded-for')?.split(',')[0]?.trim(),
      userAgent: headerList.get('user-agent') ?? undefined,
    });
    return { ok: true, code: result.code, merged: result.merged, emailQueued: result.emailQueued };
  } catch (error) {
    const key = error instanceof Error ? error.message : '';
    if (messages[key]) return { ok: false, message: messages[key]! };
    if (error && typeof error === 'object' && 'issues' in error) {
      return { ok: false, message: t.errors.validation };
    }
    log.error('registration failed', {
      detail: error instanceof Error ? `${error.name}: ${error.message.replace(/'[^']*'/g, "'…'")}`.slice(0, 240) : 'unknown',
    });
    return { ok: false, message: t.errors.generic };
  }
}
