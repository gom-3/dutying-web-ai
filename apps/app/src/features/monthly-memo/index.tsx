import {cn} from '@dutying/utils/style';
import * as Dialog from '@radix-ui/react-dialog';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Check, Loader2, RotateCcw, X} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {AdminAPI} from '@/shared/api';
import type {TUpsertAdminMonthlyMemoDTO} from '@/shared/api/admin';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Button} from '@/shared/ui/primitives/button';

const MONTHLY_MEMO_MAX_LENGTH = 1000;
const MONTHLY_MEMO_SAVE_DELAY_MS = 600;
const monthlyMemoQueryKeys = {
    detail: (wardId: number, year: number, month: number) => ['admin-monthly-memo', wardId, year, month] as const,
};

type TMonthlyMemoButtonProps = {
    wardId: number | null;
    year: number;
    month: number;
};

export function MonthlyMemoButton({wardId, year, month}: TMonthlyMemoButtonProps) {
    const {t} = useTypedTranslation();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const activeWardId = wardId ?? 0;
    const contextKey = `${wardId ?? 'none'}:${year}:${month}`;
    const initializedContextRef = useRef<string | null>(null);
    const queryKey = useMemo(() => monthlyMemoQueryKeys.detail(activeWardId, year, month), [activeWardId, month, year]);
    const memoQuery = useQuery({
        queryKey,
        queryFn: () => AdminAPI.getMonthlyMemo(wardId!, year, month),
        enabled: wardId !== null,
        staleTime: 30_000,
    });
    const memoContent = memoQuery.data?.content ?? '';
    const hasMemo = memoContent.trim().length > 0;
    const saveMutation = useMutation({
        mutationFn: (memo: TUpsertAdminMonthlyMemoDTO) => AdminAPI.upsertMonthlyMemo(memo),
        onSuccess: (savedMemo) => {
            queryClient.setQueryData(monthlyMemoQueryKeys.detail(savedMemo.wardId, savedMemo.year, savedMemo.month), savedMemo);
        },
    });
    const isInitialized = initializedContextRef.current === contextKey;
    const isDirty = isInitialized && draft !== memoContent;

    useEffect(() => {
        if (!memoQuery.isSuccess) return;

        if (!open || initializedContextRef.current !== contextKey) {
            initializedContextRef.current = contextKey;
            setDraft(memoContent);
        }
    }, [contextKey, memoContent, memoQuery.isSuccess, open]);

    useEffect(() => {
        if (wardId === null || !memoQuery.isSuccess || !isDirty || saveMutation.isPending) return;

        const saveTimer = window.setTimeout(() => {
            saveMutation.mutate({wardId, year, month, content: draft});
        }, MONTHLY_MEMO_SAVE_DELAY_MS);

        return () => window.clearTimeout(saveTimer);
    }, [draft, isDirty, memoQuery.isSuccess, month, saveMutation, wardId, year]);

    const portalContainer = typeof document === 'undefined' ? undefined : (document.getElementById('modal-root') ?? document.body);
    const saveStatus = saveMutation.isPending
        ? t('page.makeShift.monthlyMemo.saving')
        : saveMutation.isError
          ? t('page.makeShift.monthlyMemo.saveFailed')
          : memoQuery.isSuccess && !isDirty
            ? t('page.makeShift.monthlyMemo.saved')
            : '';

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <button
                    type="button"
                    disabled={wardId === null}
                    title={t('page.makeShift.monthlyMemo.button')}
                    aria-label={t(hasMemo ? 'page.makeShift.monthlyMemo.buttonWithMemoAria' : 'page.makeShift.monthlyMemo.buttonAria', {
                        year,
                        month,
                    })}
                    className={cn(
                        'relative inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-[10px] bg-white px-3.5 font-apple text-[14px] font-semibold text-sub-2 shadow-[0_1px_0_rgba(15,23,42,0.06)] ring-1 ring-gray-6 transition hover:bg-gray-7 hover:text-sub-1 focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                        open && 'bg-main-light text-main-1 ring-main-3',
                    )}
                >
                    <img src="/img/memo.png" alt="" className="size-6 shrink-0 object-contain" aria-hidden="true" />
                    <span>{t('page.makeShift.monthlyMemo.button')}</span>
                    {hasMemo ? (
                        <span
                            className="absolute -top-1 -right-1 size-2.5 rounded-full bg-[#F6C343] ring-2 ring-white"
                            aria-hidden="true"
                        />
                    ) : null}
                </button>
            </Dialog.Trigger>

            <Dialog.Portal container={portalContainer}>
                <Dialog.Overlay className="fixed inset-0 z-[1100] bg-[#121726]/35" />
                <Dialog.Content className="fixed top-1/2 left-1/2 z-[1101] w-[calc(100vw-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] bg-white p-5 shadow-[0_24px_80px_rgba(18,23,38,0.2)]">
                    <div className="flex min-w-0 items-start justify-between gap-4">
                        <div className="min-w-0">
                            <Dialog.Title className="truncate font-apple text-[20px] leading-7 font-semibold text-sub-1">
                                {t('page.makeShift.monthlyMemo.title', {year, month})}
                            </Dialog.Title>
                        </div>
                        <Dialog.Close asChild>
                            <button
                                type="button"
                                className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-[8px] text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1"
                                aria-label={t('page.makeShift.monthlyMemo.closeAria')}
                            >
                                <X className="size-4" strokeWidth={2.2} aria-hidden="true" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="mt-4">
                        {memoQuery.isPending ? (
                            <div className="flex min-h-[168px] items-center justify-center rounded-[10px] bg-gray-7 text-[13px] font-semibold text-gray-3">
                                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                                {t('page.makeShift.monthlyMemo.loading')}
                            </div>
                        ) : memoQuery.isError ? (
                            <div className="flex min-h-[168px] flex-col items-center justify-center rounded-[10px] bg-gray-7 px-4 text-center">
                                <p className="text-[14px] font-semibold text-gray-3">{t('page.makeShift.monthlyMemo.loadFailed')}</p>
                                <Button
                                    type="button"
                                    variant="soft"
                                    className="mt-3 h-9 rounded-[10px] px-3 text-[13px]"
                                    onClick={() => void memoQuery.refetch()}
                                >
                                    <RotateCcw className="size-3.5" aria-hidden="true" />
                                    {t('page.makeShift.monthlyMemo.retry')}
                                </Button>
                            </div>
                        ) : (
                            <textarea
                                value={draft}
                                maxLength={MONTHLY_MEMO_MAX_LENGTH}
                                aria-label={t('page.makeShift.monthlyMemo.textareaAria', {year, month})}
                                placeholder={t('page.makeShift.monthlyMemo.placeholder')}
                                className="min-h-[168px] w-full resize-none rounded-[10px] border border-gray-6 bg-gray-7 px-3.5 py-3 font-apple text-[14px] leading-5 text-sub-1 transition outline-none focus:border-main-3 focus:bg-white focus:ring-2 focus:ring-main-4"
                                onChange={(event) => setDraft(event.target.value)}
                            />
                        )}
                    </div>

                    <div className="mt-3 flex min-h-5 items-center justify-between gap-3 text-[12px] font-semibold">
                        <span className={cn('inline-flex items-center gap-1.5', saveMutation.isError ? 'text-red' : 'text-gray-3')}>
                            {saveMutation.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                            {!saveMutation.isPending && saveStatus && !saveMutation.isError ? (
                                <Check className="size-3.5 text-main-1" aria-hidden="true" />
                            ) : null}
                            {saveStatus}
                        </span>
                        <span className="shrink-0 text-gray-4">
                            {draft.length}/{MONTHLY_MEMO_MAX_LENGTH}
                        </span>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
