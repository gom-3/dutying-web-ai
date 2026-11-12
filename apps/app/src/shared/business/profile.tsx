/* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Empty environment values must keep using the public seller-information fallback. */
import {ChevronDown} from 'lucide-react';

// Public seller information only. Populate from the business registration certificate.
export const SELLER = {
    name: '컴공로드맵',
    representative: import.meta.env.VITE_SELLER_REPRESENTATIVE || '이경화',
    registrationNumber: import.meta.env.VITE_SELLER_REGISTRATION_NUMBER || '319-05-02789',
    address: import.meta.env.VITE_SELLER_ADDRESS || '(우: 34885) 대전광역시 중구 태평로 55 (삼부아파트4단지) 412동 82호',
    phone: import.meta.env.VITE_SELLER_PHONE || '010-7696-1007',
    email: import.meta.env.VITE_SELLER_EMAIL || 'official@dutying.ai',
    ecommerceNumber: import.meta.env.VITE_SELLER_ECOMMERCE_NUMBER || '2023-대전중구-0497',
};
export const sellerReady = Boolean(SELLER.representative && SELLER.registrationNumber && SELLER.address && SELLER.phone && SELLER.email);
export const SUBSCRIPTION_TERMS_VERSION = 'plus-ai-fill-monthly-2026-11-12';

const sellerLabels = {
    brand: '듀팅(Dutying)',
    pending: '사업자 상세정보를 준비하고 있습니다. 현재 온라인 구독 신청을 준비 중입니다.',
    representative: '대표자',
    registrationNumber: '사업자등록번호',
    address: '사업장 주소',
    phone: '고객센터',
    email: '이메일',
    ecommerceNumber: '통신판매업 신고번호',
};

export function SellerDetails({labels = sellerLabels, collapsible = false}: {labels?: typeof sellerLabels; collapsible?: boolean}) {
    const brand = (
        <strong>
            {SELLER.name} · {labels.brand}
        </strong>
    );
    const information = (
        <>
            {!sellerReady && <p role="status">{labels.pending}</p>}
            {SELLER.representative && (
                <p>
                    {labels.representative}: {SELLER.representative}
                </p>
            )}
            {SELLER.registrationNumber && (
                <p>
                    {labels.registrationNumber}: {SELLER.registrationNumber}
                </p>
            )}
            {SELLER.address && (
                <p>
                    {labels.address}: {SELLER.address}
                </p>
            )}
            {SELLER.phone && (
                <p>
                    {labels.phone}: {SELLER.phone}
                </p>
            )}
            {SELLER.email && (
                <p>
                    {labels.email}: <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>
                </p>
            )}
            {SELLER.ecommerceNumber && (
                <p>
                    {labels.ecommerceNumber}: {SELLER.ecommerceNumber}
                </p>
            )}
        </>
    );

    if (collapsible) {
        return (
            <details className="group/seller text-sm leading-7">
                <summary className="flex min-h-11 w-fit max-w-full cursor-pointer list-none items-center gap-1.5 rounded-sm hover:text-main-1 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                    {brand}
                    <ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open/seller:rotate-180" />
                </summary>
                <div>{information}</div>
            </details>
        );
    }

    return (
        <div className="text-sm leading-7">
            {brand}
            {information}
        </div>
    );
}
