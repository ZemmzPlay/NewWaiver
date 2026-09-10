import { FindFlow } from '@/components/FindFlow';
import { PublicChrome } from '@/components/PublicChrome';

export const dynamic = 'force-dynamic';

export default function FindPage() {
  return (
    <PublicChrome ticker={false}>
      <FindFlow />
    </PublicChrome>
  );
}
