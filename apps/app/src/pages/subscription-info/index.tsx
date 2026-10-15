import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link, useLocation} from 'react-router';
import {RUNTIME_CONFIG} from '@/shared/config/runtime';
import {SellerDetails, sellerReady, SUBSCRIPTION_TERMS_VERSION} from '@/shared/business/profile';
import './subscription-info.css';

export type PublicOffer = {
    plan: string;
    baseGross: number;
    includedStaff: number;
    extraStaffGross: number;
    generate: number;
    adjust: number;
    adminSeats: number;
    maxChargeGross: number;
    termsVersion: string;
    priceVersion: string;
    ready: boolean;
};
export const fetchPublicOffer = async (): Promise<PublicOffer> => {
    const response = await fetch(`${RUNTIME_CONFIG.serverUrl().replace(/\/$/, '')}/commercial/offer`, {credentials: 'omit'});
    if (!response.ok) throw new Error('요금 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.');
    return response.json();
};
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
export function SubscriptionConditions() {
    return (
        <>
            <h2>이용기간과 자동 갱신</h2>
            <p>
                Plus는 1개 병동의 근무표를 관리하는 월 구독 상품입니다. 매회 결제의 서비스 제공기간은 1개월이며, 결제가 확인되면 유료 기능을
                이용할 수 있습니다. 설치와 실물 배송은 없습니다.
            </p>
            <p>
                가입할 때 확인한 결제일을 기준으로 매월 등록한 카드로 결제합니다. 해당 날짜가 없는 달은 말일에 결제합니다. 정확한
                이용기간·이번 결제금액·다음 결제일은 결제 확인 화면과 구독 관리에서 확인할 수 있습니다.
            </p>
            <p>
                월 기본료와 승인한 추가 편성 인원 요금이 합산됩니다. 사용량이 늘었다는 이유만으로 동의 없이 추가 청구하지 않습니다. 기본 AI
                횟수는 각 구독 주기 종료 시 만료되며 다음 주기로 이월하거나 전체 생성과 부분 조정 사이에 교환할 수 없습니다.
            </p>
            <h2>해지와 결제 실패</h2>
            <p>
                로그인 후 ‘요금제·병원 관리 → 병동 선택 → 결제 → 구독 관리’에서 다음 결제를 해지할 수 있습니다. 해지 접수가 완료되면 다음
                주기의 자동결제를 중단하고 이미 결제한 기간까지 이용할 수 있습니다. 해지는 환불 신청과 별개입니다.
            </p>
            <p>
                결제 실패나 확인 지연은 결제내역에서 안내합니다. 결제 확인 전에는 새 유료 이용기간을 부여하지 않습니다. 카드 등록만
                완료되었다고 구독이 시작되지는 않습니다.
            </p>
            <p>
                무료 체험은 별도 유료 전환 동의 없이 자동 청구하지 않습니다. 기존 병동·근무표 자료는 구독 해지 때문에 즉시 삭제되지
                않습니다.
            </p>
        </>
    );
}
export function RefundConditions() {
    return (
        <>
            <h2>Plus 월 구독 환불</h2>
            <ul>
                <li>결제 후 7일 이내이며 해당 결제기간의 유료 기능을 사용하지 않았다면 전액 환불합니다.</li>
                <li>
                    그 외에는 환불 요청일부터 남은 이용기간을 일할 계산해 환불합니다. 월 구독에 포함된 AI 사용분을 별도로 추가 공제하지
                    않습니다.
                </li>
                <li>
                    일할 환불액 = 해당 기간의 실제 결제금액 × 남은 이용일수 ÷ 전체 이용일수입니다. 한국시간 기준 요청일을 남은 이용일수에
                    포함하고 기간 종료일은 제외하며, 원 미만은 올림합니다. 이미 환불한 금액을 중복 지급하지 않습니다.
                </li>
            </ul>
            <h2>신청 방법과 처리</h2>
            <p>
                ‘요금제·병원 관리 → 병동 선택 → 결제 → 환불·정산 문의’에서 청구서를 선택해 접수하거나 하단 고객센터로 연락해 주세요. 접수
                시각을 환불 기준으로 기록합니다. 환불 확정 시 해당 유료 이용기간이 종료됩니다. 처리 지연 때문에 공제 기간이 늘어나지
                않습니다.
            </p>
            <p>
                신청일로부터 3영업일 이내에 환불 또는 카드 승인취소에 필요한 조치를 진행합니다. 실제 카드 명세서 반영일은 카드사에 따라 다를
                수 있으며, 확인이 필요한 경우 사유와 진행 상황을 안내합니다.
            </p>
            <h2>별도 상품과 법정 권리</h2>
            <p>
                Hospital은 개별 계약·계좌이체로 제공하며 계약서에 환불·서비스 조건을 명시합니다. 별도 횟수 팩·현장 세팅 등 일회성 상품은
                현재 이 카드 정기결제 경로에서 판매하지 않습니다. 별도 판매 시 구매 전에 해당 상품의 환불정책을 안내합니다.
            </p>
            <p>
                이 안내는 관계 법령에 따른 청약철회, 계약 내용과 다른 서비스 제공, 하자·미제공 등에 대한 소비자의 권리를 제한하지 않습니다.
                법령에 따른 권리가 더 유리한 경우 그 기준을 우선 적용합니다.
            </p>
        </>
    );
}
export default function SubscriptionInfoPage() {
    const {pathname} = useLocation();
    const refund = pathname === '/refund';
    const terms = pathname === '/subscription-terms';
    const offer = useQuery({queryKey: ['public-plus-offer'], queryFn: fetchPublicOffer, retry: false});
    const [capacity, setCapacity] = useState(50);
    const p = offer.data;
    const total = p ? p.baseGross + Math.max(0, capacity - p.includedStaff) * p.extraStaffGross : 0;
    const canStart =
        p?.ready &&
        sellerReady &&
        p.termsVersion === SUBSCRIPTION_TERMS_VERSION &&
        Number.isInteger(capacity) &&
        capacity >= p.includedStaff &&
        total <= p.maxChargeGross;
    return (
        <div className="subscription-info">
            <header>
                <Link to="/">dutying</Link>
                <nav aria-label="상품 안내">
                    <Link to="/pricing">요금제</Link>
                    <Link to="/subscription-terms">정기결제 안내</Link>
                    <Link to="/refund">환불정책</Link>
                    <Link to="/workspace">구독 관리</Link>
                </nav>
            </header>
            <main>
                <p className="eyebrow">듀팅 · 국내 웹 서비스</p>
                <h1>{refund ? '해지·환불정책' : terms ? 'Plus 정기결제 이용 안내' : '병동의 근무표를 함께 관리하세요.'}</h1>
                {!refund && !terms && (
                    <>
                        <p className="lead">
                            수간호사와 병동 관리자를 위한 AI 근무표 편성 서비스입니다. 간호사 명단·근무 조건을 관리하고 전체 생성, 부분
                            조정, 근무표 저장 기능을 이용합니다.
                        </p>
                        {offer.isPending ? (
                            <p role="status">요금 정보를 불러오고 있습니다.</p>
                        ) : offer.isError || !p ? (
                            <div role="alert">
                                <p>현재 요금 정보를 불러올 수 없습니다.</p>
                                <button onClick={() => void offer.refetch()}>다시 확인</button>
                            </div>
                        ) : (
                            <section className="offer">
                                <p className="eyebrow">1개 병동 · Plus</p>
                                <h2>월 {won(p.baseGross)}</h2>
                                <p>부가세 포함 · 1개월마다 자동결제</p>
                                <ul>
                                    <li>기본 편성 인원 {p.includedStaff}명</li>
                                    <li>OWNER 포함 관리자 {p.adminSeats}명</li>
                                    <li>
                                        구독 주기마다 전체 생성 {p.generate}회 · 부분 조정 {p.adjust}회
                                    </li>
                                    <li>추가 편성 인원 1명당 월 {won(p.extraStaffGross)} (VAT 포함)</li>
                                </ul>
                                <p>편성 인원은 근무표에 등록하는 간호사 수입니다. 일반 간호사는 웹에 가입하지 않아도 됩니다.</p>
                                <label>
                                    편성할 총 인원{' '}
                                    <input
                                        type="number"
                                        min={p.includedStaff}
                                        max={10000}
                                        value={capacity}
                                        onChange={(e) => setCapacity(Number(e.target.value))}
                                    />
                                </label>
                                <p className="price">
                                    예상 월 이용료{' '}
                                    {Number.isInteger(capacity) && capacity >= p.includedStaff ? won(total) : '인원을 확인해 주세요'}
                                </p>
                                <p>카드 1회 결제 상한은 {won(p.maxChargeGross)}입니다. 실제 결제 전 최종 견적을 다시 확인합니다.</p>
                                {canStart ? (
                                    <Link className="primary" to="/workspace/plans">
                                        로그인하고 Plus 신청
                                    </Link>
                                ) : (
                                    <p role="status">
                                        {total > p.maxChargeGross
                                            ? '카드 결제 상한을 초과합니다. 고객센터로 문의해 주세요.'
                                            : '온라인 구독 신청을 준비하고 있습니다.'}
                                    </p>
                                )}
                            </section>
                        )}
                        <section>
                            <h2>병원 전체 도입 · Hospital</h2>
                            <p>
                                여러 병동의 통합 운영은 개별 상담·계약 및 계좌이체로 진행합니다. Plus 카드 정기결제와 별도로 견적과 도입
                                범위를 확정합니다.
                            </p>
                            <Link to="/workspace/adoption">병원 도입 문의</Link>
                        </section>
                    </>
                )}
                {refund ? (
                    <RefundConditions />
                ) : (
                    <>
                        <SubscriptionConditions />
                        <p>
                            <Link to="/refund">환불 기준과 신청 방법 확인 →</Link>
                        </p>
                    </>
                )}
                <p className="version">적용 버전: {SUBSCRIPTION_TERMS_VERSION} · 적용일: 이 버전으로 신규 구독에 동의한 날</p>
            </main>
            <footer>
                <SellerDetails />
                <nav>
                    <Link to="/terms">서비스 이용약관</Link>
                    <Link to="/privacy">개인정보처리방침</Link>
                    <Link to="/refund">환불정책</Link>
                </nav>
            </footer>
        </div>
    );
}
