import {useState} from 'react';
import {Link} from 'react-router';
import {useTranslation} from 'react-i18next';
import {scopePath, useCommercialContext, useWardEntitlement} from './api';
import useAuthStore from '@/features/auth/model/store';

export function CommercialEntry({compact = false}: {compact?: boolean}) {
    const context = useCommercialContext();
    const {i18n} = useTranslation();
    if (!context.data?.enabled) return null;
    const ko = i18n.language.startsWith('ko');
    return (
        <Link
            to="/workspace"
            className="mx-1 my-2 block rounded-xl bg-gray-7 p-3 text-sm font-medium text-sub-1"
            title={ko ? '요금제·병원 관리' : 'Plans & workspaces'}
        >
            {compact ? '↗' : ko ? '요금제·병원 관리' : 'Plans & workspaces'}
        </Link>
    );
}
export function WardUsageSummary() {
    const wardId = useAuthStore((s) => s.wardId);
    const query = useWardEntitlement();
    const {i18n} = useTranslation();
    if (!query.data || !wardId) return null;
    const e = query.data;
    const ko = i18n.language.startsWith('ko');
    return (
        <Link
            to={scopePath({type: 'WARD', ref: String(wardId)})}
            className="mx-3 my-2 block rounded-xl bg-main-light p-3 text-xs leading-6 text-sub-1"
        >
            {e.plan}
            {e.entitlementSource === 'EVENT' ? (ko ? ' · 무료 이벤트' : ' · Trial') : ''}
            <br />
            {ko ? '전체' : 'Full'} {e.usage[0]?.remaining ?? 0} · {ko ? '부분' : 'Partial'} {e.usage[1]?.remaining ?? 0}
            {e.capacity.overLimit ? <span className="block">{ko ? '편성 인원 조정이 필요합니다' : 'Review staff capacity'}</span> : null}
        </Link>
    );
}

export function AiPlanNotice({hasResult = false}: {hasResult?: boolean}) {
    const q = useWardEntitlement();
    const ward = useAuthStore((s) => s.wardId);
    const {i18n} = useTranslation();
    const ko = i18n.language.startsWith('ko');
    const [dismissed, setDismissed] = useState(false);
    if (!q.data || !ward) return null;
    const e = q.data;
    const full = e.usage.find((u) => u.meter === 'FULL_GENERATE');
    const partial = e.usage.find((u) => u.meter === 'PARTIAL_ADJUST');
    return (
        <aside
            className="flex flex-wrap items-center gap-3 rounded-xl bg-main-light px-4 py-3 text-sm"
            aria-label={ko ? 'AI 사용량' : 'AI allowance'}
        >
            <span>
                {e.plan} · {ko ? '전체' : 'Full'} {full?.remaining ?? 0} · {ko ? '부분' : 'Partial'} {partial?.remaining ?? 0}
            </span>
            {e.capacity.overLimit ? (
                <span>
                    {ko ? '편성 인원을 조정하면 새 월과 AI를 이용할 수 있습니다.' : 'Review staff capacity to start a new month or use AI.'}
                </span>
            ) : null}
            <Link to={scopePath({type: 'WARD', ref: String(ward)}, 'billing')}>
                {e.canManageBilling ? (ko ? '요금제·추가 횟수' : 'Plan & additional uses') : ko ? 'OWNER에게 요청' : 'Request from owner'}
            </Link>
            {hasResult && e.plan === 'FREE' && !dismissed ? (
                <span>
                    {ko ? '다음 달 편성도 Plus로 이어가세요.' : 'Continue next month’s scheduling with Plus.'}{' '}
                    <button onClick={() => setDismissed(true)}>{ko ? '나중에' : 'Later'}</button>
                </span>
            ) : null}
        </aside>
    );
}

export function PlanFeatureNotice({action}: {action: 'BOARD_CREATE' | 'REQUEST_SUBMIT'}) {
    const query = useWardEntitlement();
    const ward = useAuthStore((s) => s.wardId);
    const {i18n} = useTranslation();
    const ko = i18n.language.startsWith('ko');
    if (!query.data || !ward || query.data.allowedActions.includes(action)) return null;
    return (
        <aside className="mb-3 rounded-xl bg-main-light p-4 text-sm leading-6">
            {action === 'BOARD_CREATE'
                ? ko
                    ? '새 글·댓글 작성은 Plus부터 사용할 수 있습니다. 기존 글 조회·수정·삭제는 유지됩니다.'
                    : 'New posts and comments require Plus. Existing posts remain available to read, edit or delete.'
                : ko
                  ? '새 신청과 신청 변경은 Plus부터 사용할 수 있습니다. 이미 접수한 신청의 승인·거절·반영은 계속할 수 있습니다.'
                  : 'New or edited requests require Plus. Previously submitted requests can still be approved, rejected or applied.'}{' '}
            <Link className="underline" to={scopePath({type: 'WARD', ref: String(ward)}, 'billing')}>
                {query.data.canManageBilling ? (ko ? '요금제 보기' : 'View plans') : ko ? 'OWNER에게 요청' : 'Request from owner'}
            </Link>
        </aside>
    );
}
