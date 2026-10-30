import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import useAuthStore from '@/features/auth/model/store';
import {commercialError, commercialGet, commercialPost, commercialQueryKey, type Scope, type WardLink} from '@/features/commercial/api';
import {isOperationalWardLink, useWardHospitalLinks} from '@/features/commercial/ward-links';
import './ward-links-panel.css';

type TLinkContract = {
    hospitalName: string;
    ready: boolean;
    contractHash?: string;
    capacity: number;
    monthlyGross: number;
    setupGross: number;
    startsAt: string;
    endsAt: string;
    termsRef: string;
};

const currency = (value: number) =>
    new Intl.NumberFormat('ko-KR', {style: 'currency', currency: 'KRW', maximumFractionDigits: 0}).format(value);

export const hospitalLinkStatus = (status: string, ko: boolean) =>
    ({
        SETUP: ko ? '병동 세팅 중' : 'Ward setup in progress',
        MANAGED: ko ? '병원 소속' : 'Hospital ward',
        MANAGED_DETACH_PENDING: ko ? '소속 해제 대기' : 'Awaiting hospital disconnection',
        REQUESTED: ko ? '연결 요청 도착' : 'Connection requested',
        SHARED: ko ? '기본 정보 공유 완료' : 'Basic information shared',
        QUOTED: ko ? '연결 조건 확인 필요' : 'Review connection terms',
        CONSENTED: ko ? '연결 준비 중' : 'Preparing connection',
        ACTIVE: ko ? '연결 완료' : 'Connected',
        DETACH_PENDING: ko ? '연결 해제 대기' : 'Awaiting hospital disconnection',
        DETACHED: ko ? '연결 해제됨' : 'Disconnected',
        CANCELED: ko ? '연결 요청 종료' : 'Request closed',
        CANCELLED: ko ? '연결 요청 종료' : 'Request closed',
        REJECTED: ko ? '연결 거절됨' : 'Declined',
    })[status] ?? (ko ? '상태 확인 중' : 'Checking status');

function LinkRequest({link}: {link: WardLink}) {
    const {i18n} = useTranslation();
    const ko = i18n.language.startsWith('ko');
    const client = useQueryClient();
    const accountId = useAuthStore((state) => state.accountId);
    const [agreed, setAgreed] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'DECLINE' | null>(null);
    const [contractOpen, setContractOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const [notice, setNotice] = useState('');
    const contract = useQuery({
        queryKey: commercialQueryKey(accountId, 'link-contract', link.id, link.contractHash, link.version),
        queryFn: () => commercialGet<TLinkContract>(`/ward-links/${link.id}/contract`),
        // Older servers do not include hospitalName in their link list.
        enabled: !link.hospitalName || contractOpen,
        staleTime: 10_000,
        retry: false,
    });
    const hospitalName =
        link.hospitalName?.trim() ?? contract.data?.hospitalName?.trim() ?? (ko ? '연결을 요청한 병원' : 'Requesting hospital');
    const requiresTerms = ['QUOTED', 'CONSENTED'].includes(link.status);
    const operational = isOperationalWardLink(link);
    const detaching = ['DETACH_PENDING', 'MANAGED_DETACH_PENDING'].includes(link.status);
    const canDecline = link.canDecline && !operational && !detaching;
    const wardAccepted = link.wardConsent ?? link.wardConsentedBy != null;
    const canAcceptTerms = requiresTerms && !wardAccepted;
    const run = async (action: 'SHARE' | 'DECLINE' | 'WARD_ACCEPT') => {
        if (busy) return;

        if (
            action === 'WARD_ACCEPT' &&
            (!contract.data?.ready || !link.contractHash || contract.data.contractHash !== link.contractHash || contract.isFetching)
        )
            return;

        setBusy(true);
        setError(null);
        setNotice('');

        try {
            await commercialPost(`/ward-links/${link.id}/decision`, {
                expectedVersion: link.version,
                action,
                ...(action === 'WARD_ACCEPT' ? {contractHash: contract.data?.contractHash} : {}),
            });
            setAgreed(false);
            setConfirmAction(null);
            setNotice(
                action === 'SHARE'
                    ? ko
                        ? '기본 정보를 공유했습니다. 병원 연결은 준비 중입니다.'
                        : 'Basic information shared. The connection is being prepared.'
                    : action === 'DECLINE'
                      ? ko
                          ? '연결 요청을 거절했습니다.'
                          : 'Connection request declined.'
                      : ko
                        ? '계약 연결에 동의했습니다. 연결 완료를 기다려 주세요.'
                        : 'Contract link accepted. Awaiting connection.',
            );
            await client.invalidateQueries({queryKey: ['commercial']});
        } catch (cause) {
            setError(cause);
            // A stale request must display the latest decision and terms before another attempt.
            await client.invalidateQueries({queryKey: ['commercial']});
        } finally {
            setBusy(false);
        }
    };

    return (
        <article className="ward-link-request" aria-label={hospitalName}>
            <div className="ward-link-request-heading">
                <h3>{hospitalName}</h3>
                <span className="ward-link-state">{hospitalLinkStatus(link.status, ko)}</span>
            </div>
            {link.status === 'REQUESTED' ? (
                <>
                    <p>
                        {ko
                            ? `${hospitalName}에서 이 병동을 연결하려고 합니다. 공유 범위를 확인한 뒤 동의해 주세요.`
                            : `${hospitalName} would like to connect this ward. Review the information shared before agreeing.`}
                    </p>
                    <dl className="ward-link-sharing">
                        <div>
                            <dt>{ko ? '지금 공유할 정보' : 'Shared now'}</dt>
                            <dd>{ko ? '병동 이름, 활성 편성 인원 수' : 'Ward name and active staff count'}</dd>
                        </div>
                        <div>
                            <dt>{ko ? '연결 완료 후' : 'After connection'}</dt>
                            <dd>
                                {ko
                                    ? '병원 관리 화면에서 권한과 이용 조건에 따라 병동 운영 요약을 확인합니다.'
                                    : 'The hospital can view ward summaries according to access and service conditions.'}
                            </dd>
                        </div>
                        <div>
                            <dt>{ko ? '명단·근무표 수정' : 'Roster and schedule editing'}</dt>
                            <dd>
                                {ko
                                    ? '이 동의로 수정 권한이 생기지 않습니다. 담당 병동 권한을 별도로 배정해야 합니다.'
                                    : 'This consent does not grant editing access. Assigned ward permissions are required separately.'}
                            </dd>
                        </div>
                    </dl>
                    <p className="ward-link-subtle">
                        {ko
                            ? '계약·요금 확인은 별도로 진행하며, 기본 정보 공유만으로 결제되지 않습니다.'
                            : 'Contract and billing are reviewed separately. Sharing basic information does not charge you.'}
                    </p>
                    <label className="ward-link-consent">
                        <input type="checkbox" checked={agreed} disabled={busy} onChange={(event) => setAgreed(event.target.checked)} />
                        <span>
                            {ko
                                ? `${hospitalName}에 병동 이름과 활성 인원 수를 공유하는 데 동의합니다.`
                                : `I agree to share the ward name and active staff count with ${hospitalName}.`}
                        </span>
                    </label>
                    <button type="button" disabled={!agreed || busy} onClick={() => void run('SHARE')}>
                        {busy ? (ko ? '처리 중…' : 'Saving…') : ko ? '동의하고 연결 진행' : 'Agree and continue connection'}
                    </button>
                </>
            ) : detaching ? (
                <p>{ko ? '연결 해제는 병원 최고 관리자가 처리합니다.' : 'The hospital owner manages disconnection.'}</p>
            ) : operational ? (
                <p>
                    {ko
                        ? '이 병동은 병원 소속으로 운영 중입니다. 병원 최고 관리자는 명단·근무표를 관리할 수 있으며, 일반 관리자는 담당 병동 권한이 있어야 수정할 수 있습니다.'
                        : 'This ward belongs to the hospital. The hospital owner can manage its roster and schedules; other hospital administrators need assigned ward permissions.'}
                </p>
            ) : link.status === 'SHARED' ? (
                <p>
                    {ko
                        ? '병동 이름과 활성 인원 수 공유에 동의했습니다. 병원 측에서 연결을 준비하고 있습니다. 아직 연결 완료 상태는 아닙니다.'
                        : 'You agreed to share the ward name and active staff count. The hospital is preparing the connection; it is not connected yet.'}
                </p>
            ) : link.status === 'ACTIVE' ? (
                <p>
                    {ko
                        ? '이 병동이 병원에 연결되어 있습니다. 병원 최고 관리자는 명단·근무표를 관리할 수 있으며, 일반 관리자는 담당 병동 권한이 있어야 수정할 수 있습니다.'
                        : 'This ward is connected. The hospital owner can manage its roster and schedules; other hospital administrators need assigned ward permissions.'}
                </p>
            ) : requiresTerms ? (
                <p>
                    {wardAccepted
                        ? ko
                            ? '병동 측 동의가 완료되었습니다. 병원 측 확인과 연결 활성화를 기다려 주세요.'
                            : 'Ward consent recorded. Waiting for hospital confirmation and activation.'
                        : ko
                          ? '기본 정보 공유가 완료되었습니다. 확정된 계약 조건을 확인한 뒤 연결에 동의해 주세요.'
                          : 'Basic information shared. Review the final contract terms to continue.'}
                </p>
            ) : null}
            {requiresTerms ? (
                <details className="ward-link-contract" onToggle={(event) => setContractOpen(event.currentTarget.open)}>
                    <summary>{ko ? '계약 연결 조건 확인' : 'Review contract link terms'}</summary>
                    {contract.isPending ? (
                        <p role="status">{ko ? '조건을 불러오는 중입니다.' : 'Loading terms…'}</p>
                    ) : contract.error ? (
                        <div>
                            <p role="alert">{commercialError(contract.error)}</p>
                            <button type="button" className="secondary" onClick={() => void contract.refetch()}>
                                {ko ? '조건 다시 불러오기' : 'Retry terms'}
                            </button>
                        </div>
                    ) : contract.data?.ready && contract.data.contractHash === link.contractHash ? (
                        <>
                            <p>{ko ? '병원 전체 계약 기준입니다.' : 'These terms apply to the hospital contract.'}</p>
                            <dl className="ward-link-sharing">
                                <div>
                                    <dt>{ko ? '계약 인원' : 'Capacity'}</dt>
                                    <dd>
                                        {contract.data.capacity}
                                        {ko ? '명' : ' staff'}
                                    </dd>
                                </div>
                                <div>
                                    <dt>{ko ? '월 이용료' : 'Monthly fee'}</dt>
                                    <dd>{currency(contract.data.monthlyGross)}</dd>
                                </div>
                                <div>
                                    <dt>{ko ? '초기 도입비' : 'Setup fee'}</dt>
                                    <dd>{currency(contract.data.setupGross)}</dd>
                                </div>
                                <div>
                                    <dt>{ko ? '계약 기간' : 'Contract period'}</dt>
                                    <dd>
                                        {contract.data.startsAt} ~ {contract.data.endsAt}
                                    </dd>
                                </div>
                                <div>
                                    <dt>{ko ? '계약 문서' : 'Terms reference'}</dt>
                                    <dd>{contract.data.termsRef}</dd>
                                </div>
                            </dl>
                            {canAcceptTerms ? (
                                <>
                                    <label className="ward-link-consent">
                                        <input
                                            type="checkbox"
                                            checked={agreed}
                                            disabled={busy}
                                            onChange={(event) => setAgreed(event.target.checked)}
                                        />
                                        <span>
                                            {ko
                                                ? '위 계약 조건으로 병동을 연결하는 데 동의합니다.'
                                                : 'I agree to connect this ward under these terms.'}
                                        </span>
                                    </label>
                                    <button
                                        type="button"
                                        disabled={!agreed || busy || contract.isFetching}
                                        onClick={() => void run('WARD_ACCEPT')}
                                    >
                                        {ko ? '계약 조건 확인 후 연결 동의' : 'Accept contract link'}
                                    </button>
                                </>
                            ) : null}
                        </>
                    ) : contract.data?.ready ? (
                        <div>
                            <p role="alert">
                                {ko
                                    ? '연결 조건이 변경되었습니다. 요청을 새로 불러와 다시 확인해 주세요.'
                                    : 'Connection terms changed. Refresh the request and review them again.'}
                            </p>
                            <button
                                type="button"
                                className="secondary"
                                onClick={() => void client.invalidateQueries({queryKey: ['commercial']})}
                            >
                                {ko ? '요청 새로고침' : 'Refresh request'}
                            </button>
                        </div>
                    ) : (
                        <p>{ko ? '확정된 연결 조건을 기다리고 있습니다.' : 'Awaiting final connection terms.'}</p>
                    )}
                </details>
            ) : null}
            <div className="ward-link-secondary-actions">
                {canDecline ? (
                    <button type="button" className="secondary" disabled={busy} onClick={() => setConfirmAction('DECLINE')}>
                        {ko ? '연결 요청 거절' : 'Decline request'}
                    </button>
                ) : null}
            </div>
            {confirmAction ? (
                <div className="ward-link-confirm" role="group" aria-label={ko ? '요청 확인' : 'Confirm action'}>
                    <p>
                        {ko
                            ? `${hospitalName}의 연결 요청을 거절할까요? 병동의 기존 자료와 권한은 유지됩니다.`
                            : `Decline ${hospitalName}'s request? Existing ward data and access are preserved.`}
                    </p>
                    <button type="button" disabled={busy} onClick={() => void run(confirmAction)}>
                        {ko ? '거절 확인' : 'Confirm decline'}
                    </button>
                    <button type="button" className="secondary" disabled={busy} onClick={() => setConfirmAction(null)}>
                        {ko ? '취소' : 'Cancel'}
                    </button>
                </div>
            ) : null}
            {notice ? (
                <p role="status" className="ward-link-feedback">
                    {notice}
                </p>
            ) : null}
            {error ? (
                <p role="alert" className="workspace-error">
                    {commercialError(error)}
                </p>
            ) : null}
        </article>
    );
}

export function WardLinksPanel({scope}: {scope: Scope}) {
    const links = useWardHospitalLinks(scope.ref);
    const {i18n} = useTranslation();
    const ko = i18n.language.startsWith('ko');

    return (
        <section className="workspace-section ward-links-panel">
            <h2>{ko ? '병원 연결 요청' : 'Hospital connections'}</h2>
            <p className="ward-link-subtle">
                {ko
                    ? '요청한 병원과 공유 범위를 확인하고 연결을 진행하세요.'
                    : 'Review the requesting hospital and shared information before continuing.'}
            </p>
            {!links.canReview ? (
                <p role="alert">
                    {ko
                        ? '이 병동의 최고 관리자만 연결 요청을 확인할 수 있습니다.'
                        : 'Only this ward’s owner can review connection requests.'}
                </p>
            ) : links.isPending ? (
                <p role="status">{ko ? '연결 요청을 불러오는 중입니다.' : 'Loading connection requests…'}</p>
            ) : links.error ? (
                <div>
                    <p role="alert" className="workspace-error">
                        {commercialError(links.error)}
                    </p>
                    <button type="button" className="secondary" onClick={() => void links.refetch()}>
                        {ko ? '다시 불러오기' : 'Retry'}
                    </button>
                </div>
            ) : !links.data?.length ? (
                <div className="ward-link-empty">
                    <h3>{ko ? '받은 병원 연결 요청이 없습니다' : 'No hospital connection requests'}</h3>
                    <p>
                        {ko
                            ? '병원 최고 관리자가 이 병동의 코드로 요청을 보내면 이곳에서 확인할 수 있습니다.'
                            : 'Requests from a hospital owner using this ward’s code will appear here.'}
                    </p>
                </div>
            ) : (
                links.data.map((link) => <LinkRequest key={`${link.id}-${link.version}-${link.contractHash ?? ''}`} link={link} />)
            )}
        </section>
    );
}
