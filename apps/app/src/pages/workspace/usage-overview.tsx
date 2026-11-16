import {useId} from 'react';
import {Link} from 'react-router';
import {aiFillUsage} from '@/features/commercial/ai-fill-usage';
import {scopePath, type Entitlement, type Scope} from '@/features/commercial/api';
import {useCopy} from './workspace-ui';
import './usage-overview.css';

function UsageMeter({value, limit, label, description}: {value: number; limit: number; label: string; description: string}) {
    return (
        <meter
            className="usage-overview__meter"
            min={0}
            max={Math.max(limit, 1)}
            value={Math.max(0, Math.min(value, Math.max(limit, 1)))}
            aria-label={label}
            aria-valuetext={description}
        />
    );
}

export function UsageOverview({scope, e, billingPath}: {scope: Scope; e: Entitlement; billingPath?: string}) {
    const t = useCopy();
    const titleId = useId();
    const aiTitleId = useId();
    const staffTitleId = useId();
    const adminsTitleId = useId();
    const usage = aiFillUsage(e);
    const aiUnlimited = usage?.enforced === false;
    const aiEmpty = !!usage && !aiUnlimited && usage.remaining === 0;
    const staffUnlimited = e.restrictionStates?.STAFF_CAPACITY === false;
    const staffOverLimit = !staffUnlimited && (e.capacity.overLimit || e.capacity.used > e.capacity.purchased);
    const staffRemaining = Math.max(0, e.capacity.purchased - e.capacity.used);
    const adminsUnlimited = e.restrictionStates?.ADMIN_SEATS === false;
    const adminsUsed = e.adminSeats.active + e.adminSeats.reserved;
    const adminsRemaining = Math.max(0, e.adminSeats.limit - adminsUsed);
    const planName = {FREE: 'Free', PLUS: 'Plus', HOSPITAL: t('병원 계약', 'Hospital contract')}[e.plan] ?? e.plan;
    const date = (value: string) =>
        new Date(/[Z+-]\d*:?.*$/.test(value.slice(10)) ? value : `${value}Z`).toLocaleString(t('ko-KR', 'en-GB'), {
            timeZone: 'Asia/Seoul',
            hour12: false,
        });

    return (
        <section className="workspace-section usage-overview" aria-labelledby={titleId}>
            <header className="usage-overview__header">
                <div>
                    <p className="usage-overview__eyebrow">{t('현재 요금제', 'Current plan')}</p>
                    <div className="usage-overview__plan">
                        <h2 id={titleId} className="usage-overview__plan-name">
                            {planName}
                        </h2>
                        {e.entitlementSource === 'EVENT' ? (
                            <span className="usage-overview__plan-caption">{t('무료 이벤트', 'Free trial')}</span>
                        ) : null}
                    </div>
                </div>
                <Link
                    className="workspace-button usage-overview__action"
                    to={billingPath ?? scopePath(scope, scope.type === 'HOSPITAL' && !e.canManageBilling ? 'support' : 'billing')}
                >
                    {e.canManageBilling
                        ? t('요금제·추가 횟수 보기', 'Plans & additional uses')
                        : scope.type === 'HOSPITAL'
                          ? t('운영 지원 요청하기', 'Request support')
                          : t('증설 요청하기', 'Request more capacity')}
                    <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                        <path d="m11.3 4.3 5.7 5.7-5.7 5.7-1.4-1.4 3.3-3.3H3V9h10.2l-3.3-3.3z" />
                    </svg>
                </Link>
            </header>

            <article className="usage-overview__ai" data-empty={aiEmpty || undefined} aria-labelledby={aiTitleId}>
                <div className="usage-overview__ai-summary">
                    <div className="usage-overview__ai-main">
                        <div className="usage-overview__ai-heading">
                            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                <path d="m10 2 2.7 6.3L19 11l-6.3 2.7L10 20l-2.7-6.3L1 11l6.3-2.7L10 2Zm10 12 1.2 2.8L24 18l-2.8 1.2L20 22l-1.2-2.8L16 18l2.8-1.2L20 14Z" />
                            </svg>
                            <h3 id={aiTitleId} className="usage-overview__label">
                                {t('AI 채우기', 'AI fill')}
                            </h3>
                        </div>
                        <p className="usage-overview__ai-value">
                            {usage ? (
                                aiUnlimited ? (
                                    t('횟수 제한 해제', 'No usage limit')
                                ) : (
                                    <>
                                        <strong>{usage.remaining}</strong>
                                        <span>{t('회 남음', usage.remaining === 1 ? ' use remaining' : ' uses remaining')}</span>
                                    </>
                                )
                            ) : (
                                t('사용량 정보 없음', 'Usage unavailable')
                            )}
                        </p>
                    </div>
                    {usage ? (
                        <dl className="usage-overview__ai-stats">
                            <div>
                                <dt>{t('사용 완료', 'Completed')}</dt>
                                <dd>
                                    {usage.used}
                                    <span>{t('회', usage.used === 1 ? ' use' : ' uses')}</span>
                                </dd>
                            </div>
                            <div>
                                <dt>{t('처리 중', 'In progress')}</dt>
                                <dd>
                                    {usage.reserved}
                                    <span>{t('회', usage.reserved === 1 ? ' use' : ' uses')}</span>
                                </dd>
                            </div>
                        </dl>
                    ) : null}
                </div>
                {usage && !aiUnlimited ? (
                    <UsageMeter
                        value={usage.remaining}
                        limit={usage.granted}
                        label={t('남은 AI 채우기 횟수', 'AI fill uses remaining')}
                        description={t(
                            `${usage.granted}회 중 ${usage.remaining}회 남음`,
                            `${usage.remaining} of ${usage.granted} uses remaining`,
                        )}
                    />
                ) : null}
                <details className="usage-overview__allowance">
                    <summary>
                        {t('상세 내역', 'Details')}
                        <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                            <path d="m3 6 5 5 5-5z" />
                        </svg>
                    </summary>
                    {aiUnlimited ? (
                        <p className="usage-overview__allowance-note">
                            {t(
                                '제한 해제 중에는 잔여 횟수와 관계없이 이용할 수 있어요.',
                                'Balances do not limit usage while the usage limit is disabled.',
                            )}
                        </p>
                    ) : null}
                    {usage?.lots.length ? (
                        <ul className="usage-overview__lots">
                            {usage.lots.map((lot) => (
                                <li key={lot.id}>
                                    <div>
                                        <span>
                                            {lot.source === 'PURCHASE'
                                                ? t('추가 구매', 'Purchased')
                                                : lot.source === 'COMPENSATION'
                                                  ? t('보상 지급', 'Compensation')
                                                  : t('기본 제공', 'Included')}
                                        </span>
                                        <small>
                                            {lot.expiresAt
                                                ? `${date(lot.expiresAt)} (KST) ${t('만료', 'expires')}`
                                                : scope.type === 'WARD'
                                                  ? t('최초 제공 · 만료 없음', 'Lifetime allocation · No expiration')
                                                  : t('만료 없음', 'No expiration')}
                                        </small>
                                    </div>
                                    <strong>
                                        {lot.available}
                                        {t('회 남음', ' remaining')}
                                    </strong>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    <p className="usage-overview__allowance-note">
                        {scope.type === 'WARD'
                            ? t(
                                  '채우기·수정 요청은 같은 횟수를 사용해요. 결과가 없거나 실패가 확정되면 차감하지 않아요.',
                                  'Filling and revisions share one allowance. No applicable result or a confirmed failure does not consume a use.',
                              )
                            : t('편성 인원·AI 횟수는 연결된 병동이 함께 사용해요.', 'Linked wards share staff capacity and AI uses.')}
                    </p>
                    {staffOverLimit ? (
                        <p className="usage-overview__allowance-note">
                            {t(
                                '한도를 초과해도 기존 근무표의 편집·확정·내보내기는 이용할 수 있어요.',
                                'Existing schedules remain editable, confirmable and exportable when over capacity.',
                            )}
                        </p>
                    ) : null}
                </details>
            </article>

            <div className="usage-overview__people">
                <article
                    className="usage-overview__people-section"
                    data-warning={staffOverLimit || undefined}
                    aria-labelledby={staffTitleId}
                >
                    <div className="usage-overview__people-heading">
                        <h3 id={staffTitleId} className="usage-overview__label">
                            {t('활성 편성 인원', 'Active scheduling staff')}
                        </h3>
                        <span className="usage-overview__limit">
                            {staffUnlimited
                                ? t('인원 제한 해제', 'No staff limit')
                                : t(`최대 ${e.capacity.purchased}명`, `Up to ${e.capacity.purchased} staff`)}
                        </span>
                    </div>
                    <p className="usage-overview__people-value">
                        <strong>{e.capacity.used}</strong>
                        <span>{t('명 편성 중', ' staff scheduled')}</span>
                    </p>
                    {!staffUnlimited ? (
                        <UsageMeter
                            value={e.capacity.used}
                            limit={e.capacity.purchased}
                            label={t('편성 인원 사용량', 'Scheduling staff usage')}
                            description={t(
                                `최대 ${e.capacity.purchased}명 중 ${e.capacity.used}명 편성 중`,
                                `${e.capacity.used} of ${e.capacity.purchased} staff scheduled`,
                            )}
                        />
                    ) : null}
                    {!staffUnlimited ? (
                        <p className="usage-overview__people-caption">
                            {staffOverLimit
                                ? t('편성 인원 한도 초과', 'Staff limit exceeded')
                                : staffRemaining === 0
                                  ? t('추가 편성 가능 인원 없음', 'No staff places available')
                                  : t(`${staffRemaining}명 추가 가능`, `Room for ${staffRemaining} more staff`)}
                        </p>
                    ) : null}
                </article>

                <article
                    className="usage-overview__people-section"
                    data-warning={(!adminsUnlimited && adminsUsed > e.adminSeats.limit) || undefined}
                    aria-labelledby={adminsTitleId}
                >
                    <div className="usage-overview__people-heading">
                        <h3 id={adminsTitleId} className="usage-overview__label">
                            {t('관리자', 'Administrators')}
                        </h3>
                        <span className="usage-overview__limit">
                            {adminsUnlimited
                                ? t('정원 제한 해제', 'No seat limit')
                                : t(`정원 ${e.adminSeats.limit}명`, `${e.adminSeats.limit} seats`)}
                        </span>
                    </div>
                    <div className="usage-overview__admin-summary">
                        <p className="usage-overview__people-value">
                            <strong>{e.adminSeats.active}</strong>
                            <span>{t('명 참여 중', ' active')}</span>
                        </p>
                        {e.adminSeats.reserved > 0 ? (
                            <p className="usage-overview__pending">
                                {t('초대 대기', 'Pending invitations')}
                                <strong>{t(`${e.adminSeats.reserved}명`, `${e.adminSeats.reserved}`)}</strong>
                            </p>
                        ) : null}
                    </div>
                    {!adminsUnlimited ? (
                        <UsageMeter
                            value={adminsUsed}
                            limit={e.adminSeats.limit}
                            label={t('관리자 정원 사용량', 'Administrator seat usage')}
                            description={t(
                                `정원 ${e.adminSeats.limit}명 중 관리자 ${e.adminSeats.active}명, 초대 대기 ${e.adminSeats.reserved}명`,
                                `${e.adminSeats.active} active and ${e.adminSeats.reserved} pending out of ${e.adminSeats.limit} seats`,
                            )}
                        />
                    ) : null}
                    {!adminsUnlimited ? (
                        <p className="usage-overview__people-caption">
                            {adminsUsed > e.adminSeats.limit
                                ? t('관리자 정원 초과', 'Seat limit exceeded')
                                : adminsRemaining === 0
                                  ? t('정원 마감 · 초대 대기 포함', 'All seats in use · Includes pending invitations')
                                  : t(`${adminsRemaining}명 초대 가능`, `Room for ${adminsRemaining} more`)}
                        </p>
                    ) : null}
                </article>
            </div>

            {staffOverLimit ? (
                <p className="usage-overview__notice" data-warning="true">
                    {t(
                        '새 월·AI 이용을 위해 편성 인원을 줄이거나 한도를 늘려 주세요.',
                        'Reduce active staff or increase capacity to start a new month or use AI.',
                    )}
                </p>
            ) : null}
            {e.promotion ? (
                <p className="usage-overview__notice">
                    <strong>
                        {t('무료 이벤트 종료', 'Free trial ends')} · {date(e.promotion.endsAt)} (KST)
                    </strong>
                    <span>{t('종료 후 Free 전환 · 자동 결제 없음', 'Returns to Free · No automatic payment')}</span>
                </p>
            ) : null}
        </section>
    );
}
