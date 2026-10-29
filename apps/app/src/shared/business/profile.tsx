/* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Empty environment values must keep using the public seller-information fallback. */
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
export const SUBSCRIPTION_TERMS_VERSION = 'plus-monthly-2026-10-11';
export function SellerDetails() {
    return (
        <div className="text-sm leading-7">
            <strong>{SELLER.name} · 듀팅(Dutying)</strong>
            {!sellerReady && <p role="status">사업자 상세정보를 준비하고 있습니다. 현재 온라인 구독 신청을 준비 중입니다.</p>}
            {SELLER.representative && <p>대표자: {SELLER.representative}</p>}
            {SELLER.registrationNumber && <p>사업자등록번호: {SELLER.registrationNumber}</p>}
            {SELLER.address && <p>사업장 주소: {SELLER.address}</p>}
            {SELLER.phone && <p>고객센터: {SELLER.phone}</p>}
            {SELLER.email && (
                <p>
                    이메일: <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>
                </p>
            )}
            {SELLER.ecommerceNumber && <p>통신판매업 신고번호: {SELLER.ecommerceNumber}</p>}
        </div>
    );
}
