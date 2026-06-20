import {cn} from '@dutying/utils/style';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeft, Building2, ChevronRight, DoorOpen, LoaderCircle, X} from 'lucide-react';
import {type ChangeEvent, type FormEvent, useCallback, useMemo, useRef, useState} from 'react';
import useOnclickOutside from 'react-cool-onclickoutside';
import {createPortal} from 'react-dom';
import toast from 'react-hot-toast';
import {Navigate, useNavigate} from 'react-router';
import {match} from 'ts-pattern';
import {type TWard} from '@/entities/ward';
import useAuth from '@/features/auth';
import useGetWardByCode from '@/features/get-ward-by-code';
import useRegister from '@/features/register';
import RegisterShell from '@/pages/register/ui/register-shell';
import {AdminAPI, AdminWardAPI, WardAPI} from '@/shared/api';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import PageState from '@/shared/ui/PageState';

const CODE_LENGTH = 6;
const CODE_CHARACTER_REGEX = /^[0-9A-Z]$/;
const CODE_VALUE_REGEX = /^[0-9A-Z]{6}$/;
const PERMISSION_WARDS_STALE_TIME_MS = 60_000;
const getApiErrorCode = (error: unknown) =>
    typeof error === 'object' && error !== null && 'code' in error ? (error as {code?: number}).code : undefined;
const toCodeValue = (rawCode: string) => Array.from(rawCode.toUpperCase()).slice(0, CODE_LENGTH).join('');
const toCodeList = (codeValue: string) => {
    const chars = Array.from(codeValue);

    return Array.from({length: CODE_LENGTH}, (_, index) => chars[index] ?? null);
};
const isNumber = (value: number | null): value is number => typeof value === 'number';
const isActiveWardMembershipStatus = (status?: string | null) => status === undefined || status === null || status === 'ACTIVE';
const getMembershipWardId = (membership: TAdminWardMembership) => (typeof membership.wardId === 'number' ? membership.wardId : null);

type TAdminWardMembership = {
    wardId?: number | null;
    role?: string | null;
    status?: string | null;
};

type TAccountWithMemberships = {
    memberships?: TAdminWardMembership[];
    adminMemberships?: TAdminWardMembership[];
    wardAdminMemberships?: TAdminWardMembership[];
};

type TPermissionWard = {
    ward: TWard;
    membership?: TAdminWardMembership;
};

const getAccountMemberships = (account: unknown) => {
    if (typeof account !== 'object' || account === null) return [];

    const source = account as TAccountWithMemberships;

    return [source.memberships, source.adminMemberships, source.wardAdminMemberships].flatMap((memberships) =>
        Array.isArray(memberships) ? memberships : [],
    );
};

function OnboardingJoinWardPage() {
    const {t} = useTypedTranslation();
    const {
        state: {accountMe, accountMeStatus, _loaded},
        actions: {handleGetAccountMe},
    } = useAuth();
    const {
        actions: {joinWardByCode},
    } = useRegister();
    const {getWardByCode} = useGetWardByCode();
    const navigate = useNavigate();
    const [codeValue, setCodeValue] = useState('');
    const [focusedIndex, setFocusedIndex] = useState<number>(0);
    const [error, setError] = useState(false);
    const [permissionWard, setPermissionWard] = useState<TWard | null>(null);
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const codeInputRef = useRef<HTMLInputElement | null>(null);
    const isSubmittingRef = useRef(false);
    const codeCharacters = useMemo(() => Array.from(codeValue), [codeValue]);
    const codeList = useMemo(() => toCodeList(codeValue), [codeValue]);
    const hasInvalidCodeCharacters = useMemo(
        () => codeCharacters.some((codeCharacter) => !CODE_CHARACTER_REGEX.test(codeCharacter)),
        [codeCharacters],
    );
    const isCodeComplete = codeCharacters.length === CODE_LENGTH;
    const canSubmitCode = CODE_VALUE_REGEX.test(codeValue);
    const firstInvalidCodeIndex = useMemo(
        () => codeCharacters.findIndex((codeCharacter) => !CODE_CHARACTER_REGEX.test(codeCharacter)),
        [codeCharacters],
    );
    const canRefreshAdminMe = _loaded && accountMeStatus === 'success';
    const {data: latestAdminMe, isFetching: isAdminMeRefreshing} = useQuery({
        queryKey: ['onboarding-join-ward', 'admin-me'],
        queryFn: AdminAPI.getMe,
        enabled: canRefreshAdminMe,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
    });
    const activeMemberships = useMemo(() => {
        const memberships = [...getAccountMemberships(accountMe), ...getAccountMemberships(latestAdminMe)];

        if (memberships.length === 0) return [];

        const membershipByWardId = new Map<number, TAdminWardMembership>();

        memberships.forEach((membership) => {
            const wardId = getMembershipWardId(membership);

            if (wardId === null || !isActiveWardMembershipStatus(membership.status) || membershipByWardId.has(wardId)) {
                return;
            }

            membershipByWardId.set(wardId, membership);
        });

        return Array.from(membershipByWardId.values()).sort(
            (left, right) => (getMembershipWardId(left) ?? 0) - (getMembershipWardId(right) ?? 0),
        );
    }, [accountMe, latestAdminMe]);
    const permissionWardIds = useMemo(
        () => activeMemberships.map((membership) => getMembershipWardId(membership)).filter(isNumber),
        [activeMemberships],
    );
    const membershipByWardId = useMemo(() => {
        const nextMembershipByWardId = new Map<number, TAdminWardMembership>();

        activeMemberships.forEach((membership) => {
            const wardId = getMembershipWardId(membership);

            if (wardId !== null) {
                nextMembershipByWardId.set(wardId, membership);
            }
        });

        return nextMembershipByWardId;
    }, [activeMemberships]);
    const {data: permissionWards = [], isLoading: isPermissionWardsLoading} = useQuery<TPermissionWard[]>({
        queryKey: ['onboarding-join-ward', 'permission-wards', permissionWardIds],
        queryFn: async (): Promise<TPermissionWard[]> => {
            const results = await Promise.allSettled(
                permissionWardIds.map(async (wardId): Promise<TPermissionWard> => {
                    const ward = await AdminWardAPI.getWard(wardId).catch(() => WardAPI.getWard(wardId));
                    const membership = membershipByWardId.get(wardId);

                    return membership ? {ward, membership} : {ward};
                }),
            );

            return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
        },
        enabled: permissionWardIds.length > 0,
        staleTime: PERMISSION_WARDS_STALE_TIME_MS,
    });
    const codeFeedback = hasInvalidCodeCharacters
        ? t('page.onboardingJoinWard.validation.invalidCharacters')
        : codeCharacters.length > 0 && !isCodeComplete
          ? t('page.onboardingJoinWard.validation.incomplete')
          : null;
    const focusCodeIndex = useCallback((index: number) => {
        const nextIndex = Math.min(CODE_LENGTH - 1, Math.max(0, index));

        setFocusedIndex(nextIndex);
        window.requestAnimationFrame(() => {
            const input = codeInputRef.current;

            if (!input) return;

            const selectionStart = Math.min(nextIndex, input.value.length);
            const selectionEnd = Math.min(selectionStart + 1, input.value.length);

            input.focus();
            input.setSelectionRange(selectionStart, selectionEnd);
        });
    }, []);
    const clearFocusedIndex = useCallback(() => {
        setFocusedIndex(-1);
    }, []);
    const setNextCodeValue = useCallback((nextCodeValue: string) => {
        setCodeValue(nextCodeValue);
        setError(false);
        setPermissionWard(null);
        setIsPermissionModalOpen(false);
    }, []);
    const syncFocusedIndexFromInput = useCallback(() => {
        const input = codeInputRef.current;

        if (!input || document.activeElement !== input) return;

        const nextIndex = Math.min(CODE_LENGTH - 1, Math.max(0, input.selectionStart ?? input.value.length));

        setFocusedIndex(nextIndex);
    }, []);
    const clickAwayRef = useOnclickOutside(clearFocusedIndex);
    const modalRoot = typeof document !== 'undefined' ? document.querySelector('#modal-root') : null;
    const isAccountBootstrapPending = !_loaded || accountMeStatus === 'idle' || accountMeStatus === 'loading';
    const isAccountBootstrapError = accountMeStatus === 'error';
    const isRegisteredWardsLoading = isAdminMeRefreshing || isPermissionWardsLoading;
    const shouldShowRegisteredWards = isRegisteredWardsLoading || permissionWards.length > 0;
    const handleJoinWard = useCallback(
        async (code: string) => {
            const submitCode = toCodeValue(code);

            if (isSubmittingRef.current || !CODE_VALUE_REGEX.test(submitCode)) {
                return;
            }

            isSubmittingRef.current = true;
            setIsSubmitting(true);
            setError(false);
            setIsPermissionModalOpen(false);

            try {
                await joinWardByCode({code: submitCode});
            } catch (error) {
                const errorCode = getApiErrorCode(error);

                if (errorCode === 403) {
                    try {
                        setPermissionWard(await getWardByCode(submitCode));
                    } catch {
                        setPermissionWard(null);
                    }

                    setIsPermissionModalOpen(true);

                    return;
                }

                setError(true);

                if (errorCode !== 404) {
                    toast.error(t('page.onboardingJoinWard.toast.joinFailed'));
                }
            } finally {
                isSubmittingRef.current = false;
                setIsSubmitting(false);
            }
        },
        [getWardByCode, joinWardByCode, t],
    );
    const handleCodeInputChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const nextCodeValue = toCodeValue(event.target.value);
            const selectionStart = Math.min(event.target.selectionStart ?? nextCodeValue.length, nextCodeValue.length);

            setNextCodeValue(nextCodeValue);
            window.requestAnimationFrame(() => {
                const input = codeInputRef.current;

                if (!input || document.activeElement !== input) return;

                input.setSelectionRange(selectionStart, selectionStart);
                setFocusedIndex(Math.min(CODE_LENGTH - 1, selectionStart));
            });
        },
        [setNextCodeValue],
    );
    const handleCodeFormSubmit = useCallback(
        (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();

            if (!canSubmitCode) {
                focusCodeIndex(firstInvalidCodeIndex === -1 ? codeCharacters.length : firstInvalidCodeIndex);

                return;
            }

            void handleJoinWard(codeValue);
        },
        [canSubmitCode, codeCharacters.length, codeValue, firstInvalidCodeIndex, focusCodeIndex, handleJoinWard],
    );
    const handlePermissionWardClick = useCallback(
        (ward: TWard) => {
            const nextCodeValue = toCodeValue(ward.code);

            setNextCodeValue(nextCodeValue);
            void handleJoinWard(nextCodeValue);
        },
        [handleJoinWard, setNextCodeValue],
    );
    const getRoleLabel = useCallback(
        (role?: string | null) => (role === 'OWNER' ? t('page.wardAdmins.role.owner') : t('page.wardAdmins.role.editor')),
        [t],
    );

    return (
        <RegisterShell maxWidth="max-w-[640px]">
            {isAccountBootstrapPending ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center">
                    <LoadingSpinner size={56} />
                </div>
            ) : isAccountBootstrapError ? (
                <div className="flex min-h-[420px] items-center justify-center">
                    <PageState
                        tone="error"
                        title={t('page.onboardingJoinWard.state.accountErrorTitle')}
                        description={t('page.onboardingJoinWard.state.accountErrorDescription')}
                        action={{
                            label: t('page.onboardingJoinWard.state.retry'),
                            onClick: () => void handleGetAccountMe().catch(() => undefined),
                        }}
                        className="py-0"
                    />
                </div>
            ) : (
                match(accountMe?.status)
                    .with('DEMO', () => <Navigate to={ROUTE.MAKE} replace />)
                    .otherwise(() => (
                        <>
                            <button
                                type="button"
                                className="mb-6 flex h-10 w-fit cursor-pointer items-center gap-2 rounded-[12px] bg-white px-3 text-sm font-medium text-gray-3 transition-colors hover:bg-gray-7"
                                onClick={() => navigate(ROUTE.REGISTER)}
                            >
                                <ArrowLeft className="h-4 w-4" />
                                {t('page.onboardingJoinWard.backToWardSelect')}
                            </button>

                            <div>
                                <h1 className="text-[32px] font-semibold text-sub-1">{t('page.onboardingJoinWard.title')}</h1>
                                <p className="mt-2 text-sm text-gray-3">{t('page.onboardingJoinWard.description')}</p>
                            </div>

                            <form className="mt-6 rounded-[24px] bg-white p-6" onSubmit={handleCodeFormSubmit}>
                                <div className="mb-4">
                                    <h2 className="text-[18px] leading-tight font-semibold text-sub-1">
                                        {t('page.onboardingJoinWard.codeEntry.title')}
                                    </h2>
                                </div>

                                <div ref={clickAwayRef} className="relative">
                                    <input
                                        ref={codeInputRef}
                                        value={codeValue}
                                        onChange={handleCodeInputChange}
                                        onFocus={syncFocusedIndexFromInput}
                                        onSelect={syncFocusedIndexFromInput}
                                        onKeyUp={syncFocusedIndexFromInput}
                                        onBlur={clearFocusedIndex}
                                        className="sr-only"
                                        aria-label={t('page.onboardingJoinWard.codeInputAria')}
                                        aria-invalid={hasInvalidCodeCharacters}
                                        aria-describedby={codeFeedback ? 'ward-code-feedback' : undefined}
                                        autoCapitalize="characters"
                                        autoComplete="one-time-code"
                                        inputMode="text"
                                    />
                                    <div className="grid grid-cols-6 gap-2" aria-hidden="true">
                                        {codeList.map((code, index) => (
                                            <button
                                                type="button"
                                                onClick={() => focusCodeIndex(index)}
                                                tabIndex={-1}
                                                key={index}
                                                className={cn(
                                                    'flex aspect-square min-h-12 cursor-text items-center justify-center rounded-[14px] bg-gray-7 font-poppins text-[34px] font-semibold text-main-1 transition-colors',
                                                    focusedIndex === index && 'bg-main-light ring-2 ring-main-1/20',
                                                    code && !CODE_CHARACTER_REGEX.test(code) && 'bg-[#FFF1F6] ring-1 ring-red/50',
                                                    !code && focusedIndex !== index && 'text-gray-4',
                                                )}
                                            >
                                                {code ?? ''}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {codeFeedback ? (
                                    <p
                                        id="ward-code-feedback"
                                        role={hasInvalidCodeCharacters ? 'alert' : 'status'}
                                        className={cn('mt-2 text-sm font-medium', hasInvalidCodeCharacters ? 'text-red' : 'text-gray-3')}
                                    >
                                        {codeFeedback}
                                    </p>
                                ) : null}

                                <button
                                    type="submit"
                                    disabled={!canSubmitCode || isSubmitting}
                                    className={cn(
                                        'mt-5 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-main-1 px-4 text-sm font-semibold text-white transition-colors hover:bg-main-1-hover disabled:cursor-not-allowed disabled:bg-gray-6 disabled:text-gray-4',
                                    )}
                                >
                                    {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
                                    {isSubmitting ? t('page.onboardingJoinWard.form.submitting') : t('page.onboardingJoinWard.form.submit')}
                                </button>
                            </form>

                            {error ? (
                                <p
                                    role="alert"
                                    className="mt-4 rounded-[16px] bg-[#FFF1F6] px-4 py-3 text-center text-sm font-medium text-red"
                                >
                                    {t('page.onboardingJoinWard.invalidCode')}
                                </p>
                            ) : null}

                            {shouldShowRegisteredWards ? (
                                <section className="mt-4 rounded-[24px] bg-white p-6">
                                    <div className="min-w-0">
                                        <h2 className="text-[18px] leading-tight font-semibold text-sub-1">
                                            {t('page.onboardingJoinWard.registeredWards.title')}
                                        </h2>
                                    </div>

                                    <div className="mt-4 overflow-hidden rounded-[16px] border border-gray-6">
                                        {isRegisteredWardsLoading ? (
                                            <div className="flex min-h-20 items-center justify-center gap-2 px-4 text-sm font-medium text-gray-3">
                                                <LoaderCircle className="h-4 w-4 animate-spin text-main-1" />
                                                {t('page.onboardingJoinWard.registeredWards.loading')}
                                            </div>
                                        ) : (
                                            permissionWards.map(({ward, membership}, index) => (
                                                <button
                                                    type="button"
                                                    key={ward.wardId}
                                                    disabled={isSubmitting}
                                                    onClick={() => handlePermissionWardClick(ward)}
                                                    aria-label={t('page.onboardingJoinWard.registeredWards.enterAria', {
                                                        hospitalName: ward.hospitalName,
                                                        wardName: ward.name,
                                                    })}
                                                    className={cn(
                                                        'group flex min-h-20 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-7 disabled:cursor-not-allowed disabled:opacity-60',
                                                        index > 0 && 'border-t border-gray-6',
                                                    )}
                                                >
                                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-main-light text-main-1">
                                                        <Building2 className="h-5 w-5" />
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-[16px] font-semibold text-sub-1">
                                                            {ward.hospitalName}
                                                        </span>
                                                        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm text-gray-3">
                                                            <span className="truncate">{ward.name}</span>
                                                            <span className="rounded-full bg-main-light px-2 py-0.5 text-xs font-semibold text-main-1">
                                                                {getRoleLabel(membership?.role)}
                                                            </span>
                                                        </span>
                                                    </span>
                                                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-4 transition-transform group-hover:translate-x-0.5" />
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </section>
                            ) : null}

                            {isPermissionModalOpen && modalRoot
                                ? createPortal(
                                      <div
                                          onClick={() => setIsPermissionModalOpen(false)}
                                          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(21,11,60,0.42)] px-4"
                                      >
                                          <section
                                              onClick={(event) => event.stopPropagation()}
                                              className="flex w-full max-w-[440px] flex-col rounded-[24px] bg-white p-6"
                                              role="dialog"
                                              aria-modal="true"
                                              aria-labelledby="join-ward-permission-title"
                                          >
                                              <div className="flex items-start justify-between gap-4">
                                                  <div>
                                                      <p className="text-sm font-semibold text-sub-2.5">
                                                          {t('page.onboardingJoinWard.permission.eyebrow')}
                                                      </p>
                                                      <h2
                                                          id="join-ward-permission-title"
                                                          className="mt-2 text-[24px] font-semibold text-sub-1"
                                                      >
                                                          {permissionWard
                                                              ? t('page.onboardingJoinWard.permission.titleWithWard', {
                                                                    hospitalName: permissionWard.hospitalName,
                                                                    wardName: permissionWard.name,
                                                                })
                                                              : t('page.onboardingJoinWard.permission.title')}
                                                      </h2>
                                                  </div>
                                                  <button
                                                      type="button"
                                                      onClick={() => setIsPermissionModalOpen(false)}
                                                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-gray-7 text-gray-3 transition-colors hover:bg-gray-6"
                                                      aria-label={t('page.onboardingJoinWard.permission.close')}
                                                  >
                                                      <X className="h-4 w-4" />
                                                  </button>
                                              </div>
                                              <p className="mt-3 text-sm leading-6 text-gray-3">
                                                  {permissionWard
                                                      ? t('page.onboardingJoinWard.permission.descriptionWithWard', {
                                                            hospitalName: permissionWard.hospitalName,
                                                            wardName: permissionWard.name,
                                                        })
                                                      : t('page.onboardingJoinWard.permission.description')}
                                              </p>
                                              <button
                                                  type="button"
                                                  onClick={() => setIsPermissionModalOpen(false)}
                                                  className="mt-8 flex h-11 cursor-pointer items-center justify-center rounded-[12px] bg-main-1 px-4 text-sm font-semibold text-white transition-colors hover:bg-main-1-hover"
                                              >
                                                  {t('page.onboardingJoinWard.permission.confirm')}
                                              </button>
                                          </section>
                                      </div>,
                                      modalRoot,
                                  )
                                : null}
                        </>
                    ))
            )}
        </RegisterShell>
    );
}

export default OnboardingJoinWardPage;
