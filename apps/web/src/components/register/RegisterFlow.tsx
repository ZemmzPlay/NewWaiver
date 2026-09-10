'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { RegisterInput } from '@carnival/shared';
import { registerAction } from '@/app/actions/register';
import { useLocale } from '../LocaleProvider';
import { PublicChrome, type StepKey } from '../PublicChrome';
import type { Tile } from '../PackageGrid';
import { PackageGrid } from '../PackageGrid';
import { ChildrenStep, newChild, type ChildDraft } from './ChildrenStep';
import { ConsentStep, type ConsentDraft } from './ConsentStep';
import { GuardianStep, type GuardianDraft } from './GuardianStep';
import { WaiverStep } from './WaiverStep';

const ORDER: StepKey[] = ['package', 'waiver', 'guardian', 'children', 'consent'];

export function RegisterFlow({ tiles, waiver, initialPackageId }: {
  tiles: Tile[];
  waiver: { id: string; title: string; html: string; version: number };
  initialPackageId: string | null;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const firstPackage = initialPackageId ?? tiles[0]?.packageId ?? '';

  const [step, setStepState] = useState<StepKey>(initialPackageId ? 'waiver' : 'package');
  const [packageId, setPackageId] = useState(firstPackage);
  const [guardian, setGuardian] = useState<GuardianDraft>({
    fullName: '', relation: null, relationOther: '', phone: '', email: '',
  });
  const [kids, setKids] = useState<ChildDraft[]>([newChild(firstPackage)]);
  // Marketing starts ticked — see the note in ConsentStep.
  const [consent, setConsent] = useState<ConsentDraft>({
    agreed: false, typedName: '', marketingConsent: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setStep = (next: StepKey) => {
    // The signature is pre-filled from the name they already gave, the moment
    // they arrive at the sign step rather than on every keystroke before it.
    if (next === 'consent') {
      setConsent((prev) => ({ ...prev, typedName: prev.typedName || guardian.fullName.trim() }));
    }
    setStepState(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const chrome = { current: ORDER.indexOf(step) + 1, total: ORDER.length, key: step };

  async function submit() {
    setSubmitting(true);
    setError(null);
    const payload: RegisterInput = {
      guardian: {
        fullName: guardian.fullName.trim(),
        relation: guardian.relation!,
        relationOther: guardian.relationOther.trim(),
        phone: guardian.phone,
        email: guardian.email,
        locale,
      },
      children: kids.map((child) => ({
        fullName: child.fullName.trim(),
        ageYears: child.ageYears!,
        packageId: child.packageId,
        medicalNotes: child.medicalNotes.trim(),
      })),
      consent: { waiverVersionId: waiver.id, agreed: true, typedName: consent.typedName.trim() },
      marketingConsent: consent.marketingConsent,
      // Hard rule 5: the write carries its own id, so a double tap or a retry
      // over a flaky uplink cannot produce two registrations.
      clientUuid: crypto.randomUUID(),
    };

    const result = await registerAction(payload);
    if (result.ok) {
      router.push(`/r/${result.code}?welcome=1${result.merged ? '&added=1' : ''}`);
      return;
    }
    setSubmitting(false);
    setError(result.message);
  }

  if (step === 'package') {
    return (
      <PublicChrome step={chrome}>
        <div className="px-6 pt-8 pb-2">
          <h1 className="headline" style={{ fontSize: 'var(--font-size-2xl)' }}>{t.packageStep.heading}</h1>
          <p className="mt-2 text-sm muted">{t.packageStep.help}</p>
        </div>
        <PackageGrid
          tiles={tiles}
          selectedId={packageId}
          onSelect={(tile) => {
            setPackageId(tile.packageId);
            setKids([newChild(tile.packageId)]);
            setStep('waiver');
          }}
        />
      </PublicChrome>
    );
  }

  if (step === 'waiver') {
    return (
      <PublicChrome step={chrome} ticker={false}>
        <WaiverStep
          title={waiver.title}
          html={waiver.html}
          version={waiver.version}
          onBack={() => setStep('package')}
          onContinue={() => setStep('guardian')}
        />
      </PublicChrome>
    );
  }

  if (step === 'guardian') {
    return (
      <PublicChrome step={chrome} ticker={false}>
        <GuardianStep
          value={guardian}
          onChange={setGuardian}
          onBack={() => setStep('waiver')}
          onContinue={() => setStep('children')}
        />
      </PublicChrome>
    );
  }

  if (step === 'children') {
    return (
      <PublicChrome step={chrome} ticker={false}>
        <ChildrenStep
          tiles={tiles}
          children={kids}
          onChange={setKids}
          onBack={() => setStep('guardian')}
          onContinue={() => setStep('consent')}
        />
      </PublicChrome>
    );
  }

  return (
    <PublicChrome step={chrome} ticker={false}>
      <ConsentStep
        guardianName={guardian.fullName}
        guardianEmail={guardian.email}
        waiverVersion={waiver.version}
        value={consent}
        onChange={setConsent}
        onBack={() => setStep('children')}
        onEditEmail={() => setStep('guardian')}
        onSubmit={submit}
        submitting={submitting}
        error={error}
      />
    </PublicChrome>
  );
}
