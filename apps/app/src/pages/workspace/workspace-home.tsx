import {useId} from 'react';
import {Link} from 'react-router';
import {commercialError, scopePath, type Scope} from '@/features/commercial/api';
import {useWorkspaceNavigation} from '@/features/commercial/hospital-entry';
import ROUTE from '@/shared/constant/path';
import {ActionsFeedback, useAction, useCopy} from './workspace-ui';
import './workspace-home.css';

type TWorkspaceHomeProps = {
    scopes: Scope[];
    currentWardId?: number | null;
    loading?: boolean;
    error?: unknown;
    onRetry?: () => void;
};

export function WorkspaceHome({scopes, currentWardId, loading = false, error, onRetry}: TWorkspaceHomeProps) {
    const copy = useCopy();
    const open = useWorkspaceNavigation();
    const action = useAction();
    const hospitalHeading = useId();
    const wardHeading = useId();
    const hospitals = scopes.filter((scope) => scope.type === 'HOSPITAL');
    const wards = scopes.filter((scope) => scope.type === 'WARD');
    const roleLabel = (role: Scope['role']) =>
        role === 'OWNER'
            ? copy('최고 관리자', 'Owner')
            : role === 'MANAGER'
              ? copy('병원 관리자', 'Hospital administrator')
              : copy('병동 관리자', 'Ward administrator');

    if (loading) {
        return (
            <div className="workspace-home-state" role="status">
                {copy('관리 공간을 불러오는 중입니다.', 'Loading your workspaces…')}
            </div>
        );
    }

    if (error) {
        return (
            <div className="workspace-home-state">
                <p className="workspace-home-error" role="alert">
                    {commercialError(error)}
                </p>
                {onRetry ? (
                    <button type="button" className="secondary workspace-home-retry" onClick={onRetry}>
                        {copy('다시 불러오기', 'Try again')}
                    </button>
                ) : null}
            </div>
        );
    }

    const renderScope = (scope: Scope) => {
        const label = scope.type === 'HOSPITAL' ? copy('병원 열기', 'Open hospital') : copy('근무표 열기', 'Open schedule');

        return (
            <li key={scope.scopeId} className="workspace-home-row">
                <div className="workspace-home-identity">
                    <strong>{scope.name}</strong>
                    <span>{roleLabel(scope.role)}</span>
                </div>
                <div className="workspace-home-actions">
                    {scope.type === 'WARD' && scope.role === 'OWNER' ? (
                        <Link
                            className="workspace-home-billing"
                            to={scopePath(scope, 'billing')}
                            aria-label={`${scope.name} ${copy('구독·결제 관리', 'Subscription & billing')}`}
                        >
                            {copy('구독·결제 관리', 'Subscription & billing')}
                        </Link>
                    ) : null}
                    <button
                        type="button"
                        className="workspace-home-open"
                        aria-label={`${scope.name} ${label}`}
                        disabled={action.busy}
                        onClick={() => void action.run(() => open(scope, scope.type === 'WARD'))}
                    >
                        {label}
                    </button>
                </div>
            </li>
        );
    };

    return (
        <div className="workspace-home">
            <section className="workspace-home-section" aria-labelledby={hospitalHeading}>
                <h2 id={hospitalHeading}>{copy('병원', 'Hospitals')}</h2>
                {hospitals.length ? (
                    <ul className="workspace-home-list">{hospitals.map(renderScope)}</ul>
                ) : (
                    <p className="workspace-home-empty">{copy('연결된 병원이 없습니다.', 'No hospitals connected.')}</p>
                )}
            </section>
            <section className="workspace-home-section" aria-labelledby={wardHeading}>
                <h2 id={wardHeading}>{copy('병동', 'Wards')}</h2>
                {wards.length ? (
                    <ul className="workspace-home-list">{wards.map(renderScope)}</ul>
                ) : currentWardId ? (
                    <Link className="workspace-button workspace-home-current" to={ROUTE.HOME}>
                        {copy('현재 병동 근무표 열기', 'Open current ward schedule')}
                    </Link>
                ) : (
                    <p className="workspace-home-empty">{copy('참여 중인 병동이 없습니다.', 'You have not joined a ward.')}</p>
                )}
            </section>
            {action.busy ? (
                <p className="workspace-home-progress" role="status">
                    {copy('관리 공간을 여는 중입니다.', 'Opening workspace…')}
                </p>
            ) : null}
            <ActionsFeedback action={action} />
            <div className="workspace-home-options">
                <Link
                    className="workspace-button secondary workspace-home-option"
                    to={ROUTE.ONBOARDING_WARD_CREATE}
                    state={{resetOnboardingWardCreateStep: true}}
                >
                    {copy('새 병동 만들기', 'Create a ward')}
                </Link>
                <Link className="workspace-button secondary workspace-home-option" to={ROUTE.ENTER_WARD}>
                    {copy('초대 코드로 병동 참여', 'Join with an invite code')}
                </Link>
            </div>
        </div>
    );
}
