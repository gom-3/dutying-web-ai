import ROUTE from '@/shared/constant/path';

export const wardBillingPath = (ref: string | number, tab: 'usage' | 'billing' = 'billing') =>
    `${ROUTE.BILLING}/${encodeURIComponent(String(ref))}/${tab === 'usage' ? 'usage' : 'subscription'}`;

export const wardPaymentReturnPath = (kind: 'payment-return' | 'billing-return', search = '') => `${ROUTE.BILLING}/${kind}${search}`;
