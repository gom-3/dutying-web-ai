import {useQuery} from '@tanstack/react-query';
import {useState} from 'react';
import {Link, useLocation, useNavigate} from 'react-router';
import useAuthStore from '@/features/auth/model/store';
import {commercialGet, commercialPost, commercialQueryKey, type Organization, type Scope} from '@/features/commercial/api';
import {useWorkspaceNavigation, workspaceRoleLabel} from '@/features/commercial/hospital-entry';
import {isOperationalWardLink} from '@/features/commercial/ward-links';
import ROUTE from '@/shared/constant/path';
import {HospitalWardInvite} from './hospital-ward-invite';
import {InfoTip} from './info-tip';
import {hospitalLinkStatus} from './ward-links-panel';
import {ActionsFeedback, ErrorView, useAction, useCopy} from './workspace-ui';
import './hospital-overview.css';

const shortDate = (value: string) =>
    new Date(/[Z+-]\d*:?.*$/.test(value.slice(10)) ? value : `${value}Z`).toLocaleString(undefined, {
        timeZone: 'Asia/Seoul',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

function useHospitalOverview(scope: Scope) {
    const accountId = useAuthStore((state) => state.accountId);

    return useQuery({
        queryKey: commercialQueryKey(accountId, 'HOSPITAL', scope.ref, 'overview'),
        queryFn: () => commercialGet<Organization>(`/organizations/${scope.ref}`),
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
        retry: false,
    });
}

export function HospitalOverview({scope}: {scope: Scope}) {
    const t = useCopy();
    const ko = t('ko', 'en') === 'ko';
    const action = useAction();
    const select = useWorkspaceNavigation();
    const [wardCode, setWardCode] = useState('');
    const [inviteWardId, setInviteWardId] = useState<number | null>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const createdWardParam = new URLSearchParams(location.search).get('createdWardId');
    const createdWardId =
        createdWardParam && /^[1-9]\d*$/.test(createdWardParam) && Number.isSafeInteger(Number(createdWardParam))
            ? Number(createdWardParam)
            : null;
    const query = useHospitalOverview(scope);

    if (!query.data)
        return query.isPending ? (
            <p role="status" className="hospital-overview-loading">
                {t('병동을 불러오는 중입니다.', 'Loading wards…')}
            </p>
        ) : (
            <div className="hospital-overview-load-error">
                <ErrorView error={query.error} />
                <button type="button" className="secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>
                    {t('다시 불러오기', 'Try again')}
                </button>
            </div>
        );

    const organization = query.data;
    const visibleWards = organization.wards.filter((ward) => !['DETACHED', 'CANCELED', 'CANCELLED'].includes(ward.status));
    const activeWards = organization.wards.filter(isOperationalWardLink);
    const inviteWard =
        scope.role === 'OWNER'
            ? activeWards.find((ward) => ward.wardId === (inviteWardId ?? createdWardId) && ward.canManageStaff)
            : undefined;
    const onboardingPath = `${ROUTE.ONBOARDING_WARD_CREATE}?organizationId=${encodeURIComponent(scope.ref)}`;
    const staffCount = activeWards.every((ward) => ward.staff != null)
        ? activeWards.reduce((total, ward) => total + (ward.staff ?? 0), 0)
        : null;
    const scheduleStatus = (status?: string) =>
        ({
            CONFIRMED: t('확정', 'Confirmed'),
            IN_PROGRESS: t('작성 중', 'In progress'),
            DRAFT: t('작성 중', 'In progress'),
            NOT_STARTED: t('미작성', 'Not started'),
            EMPTY: t('미작성', 'Not started'),
            NONE: t('미작성', 'Not started'),
        })[status ?? ''] ?? t('현황 준비 중', 'Summary pending');
    const closeInvite = () => {
        setInviteWardId(null);

        if (createdWardParam != null) {
            const search = new URLSearchParams(location.search);

            search.delete('createdWardId');
            navigate({pathname: location.pathname, search: search.toString(), hash: location.hash}, {replace: true});
        }
    };

    return (
        <div className="hospital-overview">
            <section className="hospital-overview-summary" aria-labelledby="hospital-overview-title">
                <div className="hospital-overview-heading hospital-overview-context-sr">
                    <h2 id="hospital-overview-title">{t('병원 운영 현황', 'Hospital overview')}</h2>
                    <span className="hospital-overview-role">{workspaceRoleLabel(scope.role, ko)}</span>
                </div>
                <dl className="hospital-overview-metrics">
                    <div>
                        <dt>{t('운영 병동', 'Active wards')}</dt>
                        <dd>{activeWards.length}</dd>
                    </div>
                    <div>
                        <dt>
                            {t('편성 인원', 'Scheduling staff')}
                            <InfoTip label={t('편성 인원 안내', 'About scheduling staff')}>
                                {t(
                                    '운영 중인 병동의 활성 편성 인원을 합산합니다.',
                                    'Total active scheduling staff across operational wards.',
                                )}
                            </InfoTip>
                        </dt>
                        <dd>{staffCount ?? '—'}</dd>
                    </div>
                    <div>
                        <dt>
                            {t('접근 가능 병동', 'Accessible wards')}
                            <InfoTip label={t('접근 가능 병동 안내', 'About accessible wards')}>
                                {t(
                                    '최고 관리자는 운영 중인 모든 소속 병동에 접근할 수 있습니다. 일반 관리자는 지정된 병동에 접근하며, 기존 병동 권한도 유지됩니다.',
                                    'The owner can access all operational hospital wards. Administrators can access assigned wards and retain existing independent ward access.',
                                )}
                            </InfoTip>
                        </dt>
                        <dd>{activeWards.filter((ward) => ward.canOpenWard).length}</dd>
                    </div>
                </dl>
            </section>

            <section className="hospital-overview-wards" aria-labelledby="hospital-overview-wards-title">
                <div className="hospital-overview-toolbar">
                    <div className="hospital-overview-heading">
                        <h2 id="hospital-overview-wards-title">{t('연결 병동', 'Linked wards')}</h2>
                        <span className="hospital-overview-count">{visibleWards.length}</span>
                        <InfoTip label={t('병동 연결·권한 안내', 'About ward links and access')}>
                            {t(
                                '병원에서 새로 만든 병동은 자동으로 소속되며, 기존 병동은 병동 최고 관리자의 동의 후 연결됩니다. 최고 관리자는 운영 중인 모든 소속 병동을, 일반 관리자는 지정된 병동을 열 수 있습니다. 기존 병동 권한은 유지됩니다.',
                                'Wards created here belong to this hospital automatically. Existing wards require their owner’s consent. The hospital owner can open all operational wards; administrators can open assigned wards. Existing independent ward access is preserved.',
                            )}
                        </InfoTip>
                    </div>
                    {scope.role === 'OWNER' ? (
                        <div className="hospital-overview-create-actions">
                            <details className="hospital-overview-connect">
                                <summary>{t('기존 병동 연결', 'Connect existing ward')}</summary>
                                <form
                                    className="hospital-overview-connect-form"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        void action.run(async () => {
                                            const result = await commercialPost(`/organizations/${scope.ref}/ward-links`, {
                                                wardCode: wardCode.trim(),
                                            });

                                            setWardCode('');
                                            action.setNotice(
                                                t(
                                                    '연결 요청을 보냈습니다. 병동 관리자의 동의를 기다려 주세요.',
                                                    'Connection requested. Awaiting the ward owner’s consent.',
                                                ),
                                            );

                                            return result;
                                        });
                                    }}
                                >
                                    <div className="hospital-overview-field-heading">
                                        <label htmlFor="hospital-connect-ward-code">{t('연결할 병동 코드', 'Ward code to connect')}</label>
                                        <InfoTip label={t('기존 병동 연결 안내', 'About connecting existing wards')}>
                                            {t(
                                                '병동 최고 관리자에게 연결을 요청합니다. 동의 전에는 병동 정보가 공유되지 않습니다.',
                                                'Requests a link from the ward owner. Ward information stays private until they consent.',
                                            )}
                                        </InfoTip>
                                    </div>
                                    <div className="hospital-overview-connect-fields">
                                        <input
                                            id="hospital-connect-ward-code"
                                            type="text"
                                            maxLength={10}
                                            required
                                            autoComplete="off"
                                            disabled={action.busy}
                                            value={wardCode}
                                            onChange={(event) => setWardCode(event.target.value)}
                                        />
                                        <button disabled={action.busy || !wardCode.trim()}>
                                            {action.busy
                                                ? t('요청 중…', 'Sending…')
                                                : t('병동에 연결 요청 보내기', 'Send connection request')}
                                        </button>
                                    </div>
                                </form>
                            </details>
                            <Link className="workspace-button hospital-overview-create" to={onboardingPath}>
                                <span aria-hidden="true">+</span> {t('새 병동 만들기', 'Create a new ward')}
                            </Link>
                        </div>
                    ) : null}
                </div>

                {inviteWard ? (
                    <HospitalWardInvite
                        key={inviteWard.wardId}
                        ward={inviteWard}
                        created={inviteWard.wardId === createdWardId}
                        onClose={closeInvite}
                    />
                ) : null}

                {!visibleWards.length ? (
                    <div className="hospital-overview-empty">
                        <strong>{t('아직 연결된 병동이 없습니다', 'No linked wards yet')}</strong>
                        <p>
                            {scope.role === 'OWNER'
                                ? t('새 병동을 만들거나 기존 병동을 연결하세요.', 'Create a new ward or connect an existing one.')
                                : t(
                                      '병원 최고 관리자가 병동을 연결하면 여기에 표시됩니다.',
                                      'Wards will appear here once your hospital owner links them.',
                                  )}
                        </p>
                    </div>
                ) : (
                    <div className="hospital-overview-table-wrap">
                        <table role="table" aria-label={t('연결 병동 운영 현황', 'Linked ward operations')}>
                            <thead role="rowgroup">
                                <tr role="row">
                                    <th role="columnheader" scope="col" id={`hospital-${scope.ref}-ward`}>
                                        {t('병동', 'Ward')}
                                    </th>
                                    <th role="columnheader" scope="col" id={`hospital-${scope.ref}-staff`}>
                                        {t('활성 편성 인원', 'Active staff')}
                                    </th>
                                    <th role="columnheader" scope="col" id={`hospital-${scope.ref}-schedule`}>
                                        {t('근무표 현황', 'Schedule status')}
                                    </th>
                                    <th role="columnheader" scope="col" id={`hospital-${scope.ref}-action`}>
                                        {t('작업', 'Action')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody role="rowgroup">
                                {visibleWards.map((ward) => {
                                    const operational = isOperationalWardLink(ward);

                                    return (
                                        <tr role="row" key={ward.id}>
                                            <td
                                                role="cell"
                                                headers={`hospital-${scope.ref}-ward`}
                                                id={`hospital-ward-${ward.id}`}
                                                className="hospital-overview-ward-name"
                                                data-label={t('병동', 'Ward')}
                                            >
                                                {ward.name ??
                                                    (ward.status === 'SETUP'
                                                        ? t('병동 세팅 중', 'Ward setup in progress')
                                                        : t('공유 동의 대기', 'Awaiting sharing consent'))}
                                            </td>
                                            <td
                                                role="cell"
                                                headers={`hospital-${scope.ref}-staff`}
                                                className="hospital-overview-ward-staff"
                                                data-label={t('활성 편성 인원', 'Active staff')}
                                            >
                                                {ward.staff ?? '—'}
                                            </td>
                                            <td
                                                role="cell"
                                                headers={`hospital-${scope.ref}-schedule`}
                                                className="hospital-overview-ward-status"
                                                data-label={t('근무표 현황', 'Schedule status')}
                                            >
                                                <span
                                                    className={`hospital-overview-status ${ward.scheduleStatus === 'CONFIRMED' && operational ? 'is-confirmed' : ''}`}
                                                >
                                                    {operational
                                                        ? scheduleStatus(ward.scheduleStatus)
                                                        : hospitalLinkStatus(ward.status, ko)}
                                                </span>
                                                {ward.currentMonth ? (
                                                    <span className="hospital-overview-status-meta">{ward.currentMonth}</span>
                                                ) : null}
                                                {ward.updatedAt || ward.contactName ? (
                                                    <InfoTip
                                                        label={t(
                                                            `${ward.name ?? '병동'} 최근 수정 정보`,
                                                            `Latest update for ${ward.name ?? 'ward'}`,
                                                        )}
                                                    >
                                                        {ward.updatedAt ? `${t('최근 수정', 'Updated')} ${shortDate(ward.updatedAt)}` : ''}
                                                        {ward.contactName ? ` · ${ward.contactName}` : ''}
                                                    </InfoTip>
                                                ) : null}
                                            </td>
                                            <td
                                                role="cell"
                                                headers={`hospital-${scope.ref}-action`}
                                                className="hospital-overview-ward-actions"
                                            >
                                                {ward.canOpenWard && operational ? (
                                                    <button
                                                        className="hospital-overview-open secondary"
                                                        aria-describedby={`hospital-ward-${ward.id}`}
                                                        disabled={action.busy}
                                                        onClick={() =>
                                                            void action.run(() => select({type: 'WARD', ref: String(ward.wardId)}, true))
                                                        }
                                                    >
                                                        {t('병동 근무표 열기', 'Open ward scheduling')}
                                                        <span aria-hidden="true">↗</span>
                                                    </button>
                                                ) : (
                                                    <span className="hospital-overview-unavailable">
                                                        {operational
                                                            ? t('담당 권한 없음', 'No assigned access')
                                                            : t('연결 확인 중', 'Link pending')}
                                                    </span>
                                                )}
                                                {scope.role === 'OWNER' && ward.canManageStaff && operational ? (
                                                    <button
                                                        type="button"
                                                        className="hospital-overview-invite-action secondary"
                                                        aria-describedby={`hospital-ward-${ward.id}`}
                                                        aria-expanded={inviteWard?.wardId === ward.wardId}
                                                        onClick={() => setInviteWardId(ward.wardId)}
                                                    >
                                                        {t('담당자 초대', 'Invite ward staff')}
                                                    </button>
                                                ) : null}
                                                {scope.role === 'OWNER' && ward.canResumeSetup && ward.status === 'SETUP' ? (
                                                    <Link
                                                        className="workspace-button secondary"
                                                        to={onboardingPath}
                                                        aria-describedby={`hospital-ward-${ward.id}`}
                                                    >
                                                        {t('세팅 이어하기', 'Resume setup')}
                                                    </Link>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                <ActionsFeedback action={action} />
            </section>

            {scope.role === 'OWNER' && organization.wards.length ? (
                <details className="hospital-overview-link-management">
                    <summary>{t('병동 연결 관리', 'Manage ward links')}</summary>
                    <div className="hospital-overview-link-rows">
                        {organization.wards.map((ward) => (
                            <div className="hospital-overview-link-row" key={ward.id}>
                                <div>
                                    <strong>{ward.name ?? t('공유 동의 대기', 'Awaiting sharing consent')}</strong>
                                    <span>{hospitalLinkStatus(ward.status, ko)}</span>
                                </div>
                                <div className="hospital-overview-link-actions">
                                    {ward.status === 'QUOTED' || ward.status === 'CONSENTED' ? (
                                        <button
                                            disabled={action.busy}
                                            onClick={() =>
                                                void action.run(() =>
                                                    commercialPost(`/ward-links/${ward.id}/decision`, {
                                                        expectedVersion: ward.version,
                                                        action: 'ORG_ACCEPT',
                                                        contractHash: ward.contractHash,
                                                    }),
                                                )
                                            }
                                        >
                                            {t('계약 연결 동의', 'Accept contract link')}
                                        </button>
                                    ) : null}
                                    {isOperationalWardLink(ward) ? (
                                        <button
                                            className="secondary hospital-overview-detach"
                                            disabled={action.busy}
                                            onClick={() => {
                                                if (
                                                    !window.confirm(
                                                        t(
                                                            `${ward.name ?? '이 병동'}의 병원 연결을 즉시 해제할까요? 병원에서 부여한 담당 권한만 해제되며, 병동 자료와 기존 병동 권한은 유지됩니다.`,
                                                            `Disconnect ${ward.name ?? 'this ward'} from the hospital immediately? Only hospital-granted access will be revoked. Ward data and independent ward permissions are preserved.`,
                                                        ),
                                                    )
                                                )
                                                    return;

                                                void action.run(async () => {
                                                    const result = await commercialPost<{status?: string}>(
                                                        `/ward-links/${ward.id}/decision`,
                                                        {
                                                            expectedVersion: ward.version,
                                                            action: 'ORG_DETACH',
                                                        },
                                                    );

                                                    action.setNotice(
                                                        result?.status === 'DETACHED'
                                                            ? t(
                                                                  '병원 연결을 해제했습니다. 병동 자료는 유지됩니다.',
                                                                  'Hospital connection removed. Ward data is preserved.',
                                                              )
                                                            : t(
                                                                  '연결 상태를 다시 확인해 주세요.',
                                                                  'Please check the connection status again.',
                                                              ),
                                                    );

                                                    return result;
                                                });
                                            }}
                                        >
                                            {t('병원 연결 해제', 'Disconnect from hospital')}
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                </details>
            ) : null}
        </div>
    );
}
