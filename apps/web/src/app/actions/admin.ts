'use server';

import { revalidatePath } from 'next/cache';
import {
  createLogger, createStaffInput, resetPinInput, setStaffActiveInput,
} from '@carnival/shared';
import { requireSupervisor } from '@/server/auth';
import { currentEvent } from '@/server/event';
import {
  createStaffAccount, listStaff, resetStaffPin, setStaffActive, type StaffRow,
} from '@/server/staff.js';
import type { ActionResult } from './counter.js';

const log = createLogger('action:admin');

const MESSAGES: Record<string, string> = {
  FORBIDDEN: 'Supervisors and admins only.',
  UNAUTHORISED: 'Your shift session has ended. Enter your PIN again.',
  PIN_TAKEN: 'Someone else already has that PIN. Pick a different one.',
  STAFF_NOT_FOUND: 'That account is no longer on file. Reload the page.',
};

function plain(error: unknown): string {
  const key = error instanceof Error ? error.message : '';
  if (MESSAGES[key]) return MESSAGES[key]!;
  log.error('admin action failed', { detail: error instanceof Error ? error.message : String(error) });
  return 'That did not go through. Try again.';
}

export async function listStaffAction(): Promise<ActionResult<StaffRow[]>> {
  try {
    await requireSupervisor();
    const event = await currentEvent();
    return { ok: true, data: await listStaff(event.id) };
  } catch (error) {
    return { ok: false, message: plain(error) };
  }
}

export async function createStaffAction(input: unknown): Promise<ActionResult<StaffRow>> {
  try {
    const actor = await requireSupervisor();
    const parsed = createStaffInput.parse(input);
    const event = await currentEvent();
    const staff = await createStaffAccount({
      eventId: event.id, fullName: parsed.fullName, pin: parsed.pin,
      role: parsed.role, zoneId: parsed.zoneId || null,
    }, actor.staffId);
    revalidatePath('/counter/admin');
    return { ok: true, data: staff };
  } catch (error) {
    return { ok: false, message: plain(error) };
  }
}

export async function resetPinAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireSupervisor();
    const parsed = resetPinInput.parse(input);
    await resetStaffPin(parsed.staffId, parsed.pin, actor.staffId);
    revalidatePath('/counter/admin');
    return { ok: true } as ActionResult;
  } catch (error) {
    return { ok: false, message: plain(error) };
  }
}

export async function setStaffActiveAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireSupervisor();
    const parsed = setStaffActiveInput.parse(input);
    await setStaffActive(parsed.staffId, parsed.isActive, actor.staffId);
    revalidatePath('/counter/admin');
    return { ok: true } as ActionResult;
  } catch (error) {
    return { ok: false, message: plain(error) };
  }
}
