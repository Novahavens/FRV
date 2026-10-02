import { calculateFrv } from '@/lib/frv';
import type { Comp, LossProperty } from '@/lib/frv';
import type { StoredClaim } from '@/lib/db/claims';

/**
 * The Coppell reference claim, computed in memory.
 *
 * Used only when Supabase is not configured, so a fresh clone renders a real
 * report on first run. It is clearly labelled in the UI — an unlabelled sample
 * that looks like a real claim is how someone emails a fake FRV to an adjuster.
 */
export const DEMO_CLAIM_ID = '00000000-0000-4000-8000-000000000001';

const loss: LossProperty = {
  claimIdentifier: 'NH-2026-0417-A',
  address: '205 Park Meadow Way, Coppell TX 75019',
  lat: 32.9668, lng: -96.9903,
  bedrooms: 4, bathrooms: 2, sqft: 2100,
  termMonths: 3, managementFeeCents: 240_00,
};

const comps: Comp[] = [
  { id: 'c1', url: 'https://www.zillow.com/homedetails/1052-Village-Pkwy-Coppell-TX-75019/26965000_zpid/',
    address: '1052 Village Pkwy, Coppell TX 75019', rentCents: 3_835_00,
    bedrooms: 4, bathrooms: 2, sqft: 2250, furnished: false, lat: 32.9674, lng: -96.9911 },
  { id: 'c2', url: 'https://www.zillow.com/homedetails/318-Woodhurst-Dr-Coppell-TX-75019/26965111_zpid/',
    address: '318 Woodhurst Dr, Coppell TX 75019', rentCents: 3_600_00,
    bedrooms: 4, bathrooms: 2.5, sqft: 2100, furnished: false, lat: 32.9701, lng: -96.9884 },
  { id: 'c3', url: 'https://www.zillow.com/homedetails/744-Bethel-School-Rd-Coppell-TX-75019/26965222_zpid/',
    address: '744 Bethel School Rd, Coppell TX 75019', rentCents: 3_200_00,
    bedrooms: 4, bathrooms: 2, sqft: 1900, furnished: false, lat: 32.9622, lng: -96.9952 },
];

export function demoClaim(): StoredClaim {
  return {
    id: DEMO_CLAIM_ID,
    status: 'locked',
    version: 1,
    photoUrl: null,
    attribution: null,
    loss,
    calculation: calculateFrv(loss, comps),
  };
}
