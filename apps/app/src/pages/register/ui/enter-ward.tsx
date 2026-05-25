import {cn} from '@dutying/utils/style';
import {ArrowLeft, Check, RotateCcw, X} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import useOnclickOutside from 'react-cool-onclickoutside';
import {createPortal} from 'react-dom';
import {useNavigate} from 'react-router';
import {Pattern, match} from 'ts-pattern';
import {type TWard} from '@/entities/ward';
import useGetWardByCode from '@/features/get-ward-by-code';
import useRegister from '@/features/register';
import ROUTE from '@/shared/constant/path';
import RegisterShell from './register-shell';

const CODE_LENGTH = 6;
const createEmptyCode = () => Array.from({length: CODE_LENGTH}, () => null) as (string | null)[];
const toCodeList = (rawCode: string) => {
    const chars = rawCode
        .trim()
        .toUpperCase()
        .replace(/[^0-9A-Z]/g, '')
        .slice(0, CODE_LENGTH)
        .split('');

    return Array.from({length: CODE_LENGTH}, (_, index) => chars[index] ?? null);
};

function EnterWard() {
    const [codeList, setCodeList] = useState<(string | null)[]>(createEmptyCode);
    const [focusedIndex, setFocusedIndex] = useState<number>(0);
    const [open, setOpen] = useState(false);
    const [ward, setWard] = useState<TWard | null>(null);
    const [error, setError] = useState(false);
    const {
        state: {accountMe},
        actions: {enterWard},
    } = useRegister();
    const {getWardByCode} = useGetWardByCode();
    const navigate = useNavigate();
    const clickAwayRef = useOnclickOutside(() => setFocusedIndex(-1));
    const modalRoot = typeof document !== 'undefined' ? document.querySelector('#modal-root') : null;
    const codeValue = useMemo(() => codeList.join(''), [codeList]);
    const handleGetWard = useCallback(
        async (code: string) => {
            try {
                const ward = await getWardByCode(code);

                setWard(ward);
                setError(false);
                setOpen(true);
            } catch {
                setError(true);
                setOpen(false);
                setWard(null);
            }
        },
        [getWardByCode],
    );
    const resetCode = () => {
        setFocusedIndex(0);
        setCodeList(createEmptyCode());
        setOpen(false);
        setError(false);
    };
    const handleKeyDown = useCallback(
        async (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
                e.preventDefault();

                const nextCodeList = toCodeList(await navigator.clipboard.readText());
                const nextFocusIndex = nextCodeList.findIndex((code) => code === null);

                setCodeList(nextCodeList);
                setFocusedIndex(nextFocusIndex === -1 ? CODE_LENGTH - 1 : nextFocusIndex);

                return;
            }

            const activeIndex =
                focusedIndex >= 0
                    ? focusedIndex
                    : Math.max(
                          0,
                          codeList.findIndex((code) => code === null),
                      );

            match(e.key)
                .with('ArrowRight', 'ArrowDown', () => {
                    e.preventDefault();
                    setFocusedIndex(Math.min(CODE_LENGTH - 1, activeIndex + 1));
                })
                .with('ArrowLeft', 'ArrowUp', () => {
                    e.preventDefault();
                    setFocusedIndex(Math.max(0, activeIndex - 1));
                })
                .with('Backspace', () => {
                    e.preventDefault();
                    setCodeList(codeList.map((code, index) => (index === activeIndex ? null : code)));
                    setFocusedIndex(Math.max(0, activeIndex - 1));
                })
                .with(Pattern.string.regex(/[0-9a-zA-Z]/).maxLength(1), () => {
                    e.preventDefault();
                    setCodeList(codeList.map((code, index) => (index === activeIndex ? e.key.toUpperCase() : code)));
                    setFocusedIndex(Math.min(CODE_LENGTH - 1, activeIndex + 1));
                });
        },
        [codeList, focusedIndex],
    );

    useEffect(() => {
        if (accountMe?.status !== 'WARD_SELECT_PENDING') navigate(ROUTE.REGISTER);
    }, [accountMe, navigate]);

    useEffect(() => {
        if (codeList.every((code) => code !== null)) {
            void handleGetWard(codeValue);
        } else {
            setError(false);
        }
    }, [codeList, codeValue, handleGetWard]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    return (
        <RegisterShell maxWidth="max-w-[560px]">
            <button
                type="button"
                className="mb-6 flex h-10 w-fit cursor-pointer items-center gap-2 rounded-[12px] bg-white px-3 text-sm font-medium text-gray-3 transition-colors hover:bg-gray-7"
                onClick={() => navigate(ROUTE.REGISTER)}
            >
                <ArrowLeft className="h-4 w-4" />
                병동 선택으로
            </button>

            <div>
                <h1 className="text-[32px] font-semibold text-sub-1">병동 코드를 입력해요</h1>
                <p className="mt-2 text-sm text-gray-3">관리자가 공유한 6자리 코드를 입력하면 병동을 확인할 수 있어요.</p>
            </div>

            <section className="mt-6 rounded-[24px] bg-white p-6">
                <div ref={clickAwayRef} className="grid grid-cols-6 gap-2" aria-label="병동 코드 입력">
                    {codeList.map((code, index) => (
                        <button
                            type="button"
                            onClick={() => setFocusedIndex(index)}
                            key={index}
                            aria-label={`병동 코드 ${index + 1}번째 자리`}
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

            {error ? (
                <p role="alert" className="mt-4 rounded-[16px] bg-[#FFF1F6] px-4 py-3 text-center text-sm font-medium text-red">
                    병동 코드를 다시 확인해 주세요.
                </p>
            ) : null}

            {open && modalRoot
                ? createPortal(
                      <div
                          onClick={() => setOpen(false)}
                          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(21,11,60,0.42)] px-4"
                      >
                          <section
                              onClick={(e) => e.stopPropagation()}
                              className="flex w-full max-w-[440px] flex-col rounded-[24px] bg-white p-6"
                              role="dialog"
                              aria-modal="true"
                              aria-labelledby="enter-ward-confirm-title"
                          >
                              <div className="flex items-start justify-between gap-4">
                                  <div>
                                      <p className="text-sm font-semibold text-sub-2.5">병동 확인</p>
                                      <h2 id="enter-ward-confirm-title" className="mt-2 text-[24px] font-semibold text-sub-1">
                                          {ward?.hospitalName} {ward?.name}
                                      </h2>
                                  </div>
                                  <button
                                      type="button"
                                      onClick={() => setOpen(false)}
                                      className="h-9 w-9 shrink-0 cursor-pointer rounded-full bg-gray-7 text-gray-3 transition-colors hover:bg-gray-6"
                                      aria-label="닫기"
                                  >
                                      <X className="h-4 w-4" />
                                  </button>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-gray-3">맞는 병동이면 입장 요청을 보낼게요.</p>
                              <div className="mt-8 grid grid-cols-2 gap-2">
                                  <button
                                      type="button"
                                      onClick={resetCode}
                                      className="h-11 cursor-pointer gap-2 rounded-[12px] bg-gray-7 px-4 text-sm font-semibold text-gray-3 transition-colors hover:bg-gray-6"
                                  >
                                      <RotateCcw className="h-4 w-4" />
                                      다시 입력
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() => ward && enterWard(ward.wardId)}
                                      className="h-11 cursor-pointer gap-2 rounded-[12px] bg-main-1 px-4 text-sm font-semibold text-white transition-colors hover:bg-[#5832E7]"
                                  >
                                      <Check className="h-4 w-4" />
                                      입장 요청
                                  </button>
                              </div>
                          </section>
                      </div>,
                      modalRoot,
                  )
                : null}
        </RegisterShell>
    );
}

export default EnterWard;
