import {cn} from '@dutying/utils/style';
import {ArrowLeft, X} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import useOnclickOutside from 'react-cool-onclickoutside';
import {createPortal} from 'react-dom';
import toast from 'react-hot-toast';
import {Navigate, useNavigate} from 'react-router';
import {Pattern, match} from 'ts-pattern';
import {type TWard} from '@/entities/ward';
import useAuth from '@/features/auth';
import useGetWardByCode from '@/features/get-ward-by-code';
import useRegister from '@/features/register';
import RegisterShell from '@/pages/register/ui/register-shell';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import PageState from '@/shared/ui/PageState';

const CODE_LENGTH = 6;
const createEmptyCode = () => Array.from({length: CODE_LENGTH}, () => null) as (string | null)[];
const getApiErrorCode = (error: unknown) =>
    typeof error === 'object' && error !== null && 'code' in error ? (error as {code?: number}).code : undefined;
const toCodeList = (rawCode: string) => {
    const chars = rawCode
        .trim()
        .toUpperCase()
        .replace(/[^0-9A-Z]/g, '')
        .slice(0, CODE_LENGTH)
        .split('');

    return Array.from({length: CODE_LENGTH}, (_, index) => chars[index] ?? null);
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
    const [codeList, setCodeList] = useState<(string | null)[]>(createEmptyCode);
    const [focusedIndex, setFocusedIndex] = useState<number>(0);
    const [error, setError] = useState(false);
    const [permissionWard, setPermissionWard] = useState<TWard | null>(null);
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const codeButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const codeListRef = useRef(codeList);
    const focusedIndexRef = useRef(focusedIndex);
    const isSubmittingRef = useRef(false);
    const lastSubmittedCodeRef = useRef<string | null>(null);
    const focusCodeIndex = useCallback((index: number) => {
        const nextIndex = Math.min(CODE_LENGTH - 1, Math.max(0, index));

        focusedIndexRef.current = nextIndex;
        setFocusedIndex(nextIndex);
        window.requestAnimationFrame(() => {
            codeButtonRefs.current[nextIndex]?.focus();
        });
    }, []);
    const clearFocusedIndex = useCallback(() => {
        focusedIndexRef.current = -1;
        setFocusedIndex(-1);
    }, []);
    const setNextCodeList = useCallback((nextCodeList: (string | null)[]) => {
        codeListRef.current = nextCodeList;
        setCodeList(nextCodeList);
    }, []);
    const clickAwayRef = useOnclickOutside(clearFocusedIndex);
    const modalRoot = typeof document !== 'undefined' ? document.querySelector('#modal-root') : null;
    const codeValue = useMemo(() => codeList.join(''), [codeList]);
    const isAccountBootstrapPending = !_loaded || accountMeStatus === 'idle' || accountMeStatus === 'loading';
    const isAccountBootstrapError = accountMeStatus === 'error';
    const handleJoinWard = useCallback(
        async (code: string) => {
            if (isSubmittingRef.current || lastSubmittedCodeRef.current === code) {
                return;
            }

            isSubmittingRef.current = true;
            lastSubmittedCodeRef.current = code;
            setIsSubmitting(true);
            setError(false);
            setIsPermissionModalOpen(false);

            try {
                await joinWardByCode({code});
            } catch (error) {
                const errorCode = getApiErrorCode(error);

                if (errorCode === 403) {
                    try {
                        setPermissionWard(await getWardByCode(code));
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
    const handleKeyDown = useCallback(
        async (e: KeyboardEvent) => {
            if (isPermissionModalOpen) {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
                e.preventDefault();

                const nextCodeList = toCodeList(await navigator.clipboard.readText());
                const nextFocusIndex = nextCodeList.findIndex((code) => code === null);

                setNextCodeList(nextCodeList);
                focusCodeIndex(nextFocusIndex === -1 ? CODE_LENGTH - 1 : nextFocusIndex);

                return;
            }

            const currentCodeList = codeListRef.current;
            const currentFocusedIndex = focusedIndexRef.current;
            const activeIndex =
                currentFocusedIndex >= 0
                    ? currentFocusedIndex
                    : Math.max(
                          0,
                          currentCodeList.findIndex((code) => code === null),
                      );

            match(e.key)
                .with('ArrowRight', 'ArrowDown', () => {
                    e.preventDefault();
                    focusCodeIndex(activeIndex + 1);
                })
                .with('ArrowLeft', 'ArrowUp', () => {
                    e.preventDefault();
                    focusCodeIndex(activeIndex - 1);
                })
                .with('Backspace', () => {
                    e.preventDefault();
                    setNextCodeList(currentCodeList.map((code, index) => (index === activeIndex ? null : code)));
                    focusCodeIndex(activeIndex - 1);
                })
                .with(Pattern.string.regex(/[0-9a-zA-Z]/).maxLength(1), () => {
                    e.preventDefault();
                    setNextCodeList(currentCodeList.map((code, index) => (index === activeIndex ? e.key.toUpperCase() : code)));
                    focusCodeIndex(activeIndex + 1);
                });
        },
        [focusCodeIndex, isPermissionModalOpen, setNextCodeList],
    );

    useEffect(() => {
        if (codeList.every((code) => code !== null)) {
            void handleJoinWard(codeValue);
        } else {
            setError(false);
            setPermissionWard(null);
            setIsPermissionModalOpen(false);
            lastSubmittedCodeRef.current = null;
        }
    }, [codeList, codeValue, handleJoinWard]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    return (
        <RegisterShell>
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
                    .with('LINKED', () => <Navigate to={ROUTE.MAKE} replace />)
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
                                <p className="mt-2 text-sm text-gray-3">
                                    {t('page.onboardingJoinWard.description')}
                                </p>
                            </div>

                            <section className="mt-6 rounded-[24px] bg-white p-6">
                                <div
                                    ref={clickAwayRef}
                                    className="grid grid-cols-6 gap-2"
                                    aria-label={t('page.onboardingJoinWard.codeInputAria')}
                                >
                                    {codeList.map((code, index) => (
                                        <button
                                            type="button"
                                            ref={(element) => {
                                                codeButtonRefs.current[index] = element;
                                            }}
                                            onClick={() => focusCodeIndex(index)}
                                            onFocus={() => {
                                                focusedIndexRef.current = index;
                                                setFocusedIndex(index);
                                            }}
                                            key={index}
                                            aria-label={t('page.onboardingJoinWard.codeDigitAria', {index: index + 1})}
                                            className={cn(
                                                'flex aspect-square min-h-12 cursor-text items-center justify-center rounded-[14px] bg-gray-7 font-poppins text-[28px] font-semibold text-sub-1 transition-colors',
                                                focusedIndex === index && 'bg-main-light text-main-1',
                                                !code && focusedIndex !== index && 'text-gray-4',
                                            )}
                                        >
                                            {code ?? ''}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {isSubmitting ? (
                                <p className="mt-4 rounded-[16px] bg-white px-4 py-3 text-center text-sm font-medium text-gray-3">
                                    {t('page.onboardingJoinWard.checkingPermission')}
                                </p>
                            ) : null}

                            {error ? (
                                <p
                                    role="alert"
                                    className="mt-4 rounded-[16px] bg-[#FFF1F6] px-4 py-3 text-center text-sm font-medium text-red"
                                >
                                    {t('page.onboardingJoinWard.invalidCode')}
                                </p>
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
