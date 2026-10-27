import {useQueryClient} from '@tanstack/react-query';
import {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link, useNavigate} from 'react-router';
import useAuth from '@/features/auth';
import useAuthStore from '@/features/auth/model/store';
import ROUTE from '@/shared/constant/path';
import {commercialError, commercialPost, commercialQueryKey, scopePath, useCommercialContext, type Scope} from './api';
import './hospital-entry.css';

// Access context already excludes inactive memberships. Organization status describes setup/contract progress.
export const activeHospitalScopes = (scopes: Scope[] = []) => scopes.filter((scope) => scope.type === 'HOSPITAL');
export const workspaceRoleLabel = (role: string, ko: boolean) =>
    role === 'OWNER'
        ? ko
            ? '최고 관리자'
            : 'Owner'
        : role === 'MANAGER'
          ? ko
              ? '병원 관리자'
              : 'Hospital administrator'
          : ko
            ? '병동 관리자'
            : 'Ward administrator';

/** Scope selection must finish before loading a ward's scheduling data. */
export function useWorkspaceNavigation() {
    const client = useQueryClient();
    const accountId = useAuthStore((state) => state.accountId);
    const {
        actions: {handleGetAccountMe},
    } = useAuth();
    const navigate = useNavigate();

    return async (scope: Pick<Scope, 'type' | 'ref'>, openWard = false) => {
        await commercialPost(`/scopes/${scope.type}/${scope.ref}/select`);
        // Preserve account-scoped commercial queries while dropping the old scheduling workspace.
        await client.cancelQueries({predicate: (query) => query.queryKey[0] !== 'commercial'});
        client.removeQueries({predicate: (query) => query.queryKey[0] !== 'commercial'});
        await handleGetAccountMe();
        await client.invalidateQueries({queryKey: commercialQueryKey(accountId, 'context')});
        navigate(openWard ? ROUTE.HOME : scopePath(scope, scope.type === 'HOSPITAL' ? 'overview' : 'usage'));
    };
}

export function HospitalEntry({compact = false, card = false}: {compact?: boolean; card?: boolean}) {
    const context = useCommercialContext();
    const hospitals = activeHospitalScopes(context.data?.scopes);
    const select = useWorkspaceNavigation();
    const navigate = useNavigate();
    const {i18n} = useTranslation();
    const ko = i18n.language.startsWith('ko');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<unknown>(null);

    if (!context.data?.enabled || !hospitals.length) return null;

    const label = ko ? '병원으로 들어가기' : 'Open hospital';

    return (
        <div className={card ? 'hospital-entry-card' : 'hospital-entry-nav'}>
            <button
                type="button"
                className="hospital-entry-button"
                title={label}
                aria-label={label}
                disabled={busy}
                onClick={async () => {
                    if (busy) return;

                    if (hospitals.length > 1) {
                        navigate('/workspace/hospitals');

                        return;
                    }

                    setBusy(true);
                    setError(null);

                    try {
                        await select(hospitals[0]);
                    } catch (cause) {
                        setError(cause);
                        await context.refetch();
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <span>
                    <strong>{compact ? (ko ? '병원' : 'Hospital') : busy ? (ko ? '병원을 여는 중…' : 'Opening hospital…') : label}</strong>
                    {card ? (
                        <span className="hospital-entry-description">
                            {hospitals.length === 1 ? hospitals[0].name : ko ? '관리할 병원을 선택하세요.' : 'Choose a hospital to manage.'}
                        </span>
                    ) : null}
                </span>
                {card ? <span aria-hidden="true">→</span> : null}
            </button>
            {error ? (
                <p role="alert" className="hospital-entry-error">
                    {commercialError(error)}
                </p>
            ) : null}
        </div>
    );
}

export function HospitalChooser() {
    const context = useCommercialContext();
    const hospitals = activeHospitalScopes(context.data?.scopes);
    const select = useWorkspaceNavigation();
    const {i18n} = useTranslation();
    const ko = i18n.language.startsWith('ko');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const automatic = useRef<string | null>(null);
    const open = async (scope: Scope) => {
        setBusy(true);
        setError(null);

        try {
            await select(scope);
        } catch (cause) {
            setError(cause);
            await context.refetch();
        } finally {
            setBusy(false);
        }
    };

    useEffect(() => {
        if (hospitals.length === 1 && automatic.current !== hospitals[0].scopeId) {
            automatic.current = hospitals[0].scopeId;
            void open(hospitals[0]);
        }
    }, [hospitals.map((scope) => scope.scopeId).join(',')]);

    return (
        <section className="workspace-section">
            <h2>
                {hospitals.length ? (ko ? '관리할 병원 선택' : 'Choose a hospital') : ko ? '연결된 병원이 없습니다' : 'No hospital access'}
            </h2>
            {hospitals.length ? (
                <div className="workspace-grid">
                    {hospitals.map((scope) => (
                        <button
                            key={scope.scopeId}
                            className="secondary workspace-hospital-choice"
                            disabled={busy}
                            onClick={() => void open(scope)}
                        >
                            <strong>{scope.name}</strong>
                            <span>{workspaceRoleLabel(scope.role, ko)}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <>
                    <p>
                        {ko
                            ? '병원 최고 관리자에게 이 계정의 관리자 등록을 요청해 주세요. 등록 후 이곳에서 병원을 열 수 있습니다.'
                            : 'Ask your hospital owner to add this account as an administrator.'}
                    </p>
                    <Link className="workspace-button secondary" to="/workspace/invitations">
                        {ko ? '받은 초대 확인' : 'View invitations'}
                    </Link>
                    <Link className="workspace-button secondary" to={ROUTE.REGISTER}>
                        {ko ? '시작 화면으로' : 'Back to start'}
                    </Link>
                </>
            )}
            {busy ? <p role="status">{ko ? '병원을 여는 중입니다.' : 'Opening hospital…'}</p> : null}
            {error ? (
                <p role="alert" className="workspace-error">
                    {commercialError(error)}
                </p>
            ) : null}
        </section>
    );
}
