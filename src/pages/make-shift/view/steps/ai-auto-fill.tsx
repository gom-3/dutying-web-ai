import {useQuery} from '@tanstack/react-query';
import {useEffect, useMemo, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth/useAuth';
import {
    buildWorkKeyMap,
    buildViolationMap,
    docToWardShiftsDTO,
    type TDutyDoc,
    shiftToDoc,
    useShiftEditorCommands,
    useShiftEditorKeyBindings,
    useShiftEditorStore,
} from '@/features/shift-editor';
import CountDutyByDay from '@/features/shift-editor/ui/complex-view/count-duty-by-day';
import ShiftCalendar from '@/features/shift-editor/ui/complex-view/shift-calendar';
import WardAPI from '@/shared/api/ward';
import {HistoryBackIcon, HistoryNextIcon, InfoIcon, PlusIcon, SaveCompleteIcon, SavingIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
import {renderMultilineText} from '@/shared/util/string';
import {cn} from '@/shared/util/style';
import {
    canConfirmAiAutofill,
    getAiAutofillActionLabel,
    getAiAutofillStatusDescription,
    getAiAutofillStatusTone,
    type TAiAutofillStatus,
} from '../../model/ai-autofill-state';
import {requestAiSchedule} from '../../model/ai-schedule-provider';
import {canGoPrev, useMakeShiftStore} from '../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../model/make-shift-use-case';

function isSameDocShape(a: TDutyDoc, b: TDutyDoc): boolean {
    if (a.columns.length !== b.columns.length || a.rows.length !== b.rows.length) return false;

    for (let i = 0; i < a.columns.length; i += 1) {
        if (a.columns[i] !== b.columns[i]) return false;
    }

    for (let i = 0; i < a.rows.length; i += 1) {
        if (a.rows[i]?.workerId !== b.rows[i]?.workerId) return false;
    }

    return true;
}

export function AiAutofill() {
    const {t} = useTypedTranslation();
    const {
        state: {wardId},
    } = useAuth();
    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const enabled = wardId !== null && currentShiftTeamId !== null;
    const dutyQuery = useQuery({
        ...wardQueryOptions.duty(wardId ?? -1, currentShiftTeamId ?? -1, year, month),
        enabled,
    });
    const editorDoc = useShiftEditorStore((s) => s.doc);
    const violations = useShiftEditorStore((s) => s.violations);
    const history = useShiftEditorStore((s) => s.history);
    const commands = useShiftEditorCommands();
    const useCase = useMakeShiftUseCase();
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const workKeyMap = useMemo(() => buildWorkKeyMap(dutyQuery.data), [dutyQuery.data]);
    const {onKeyDown, onPaste} = useShiftEditorKeyBindings({workKeyMap});
    const editorRef = useRef<HTMLDivElement>(null);
    const [autoFillEnabled, setAutoFillEnabled] = useState(false);
    const [showFaults, setShowFaults] = useState(true);
    const violationMap = useMemo(() => buildViolationMap(violations, editorDoc), [violations, editorDoc]);
    const [isWorking, setIsWorking] = useState(false);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiStatus, setAiStatus] = useState<TAiAutofillStatus>('idle');
    const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);
    const aiRequestSeqRef = useRef(0);
    const currentAiContextRef = useRef({wardId, shiftTeamId: currentShiftTeamId, year, month});
    const hydratedContextKeyRef = useRef<string | null>(null);

    currentAiContextRef.current = {wardId, shiftTeamId: currentShiftTeamId, year, month};

    const savingLabel = isWorking ? '저장 중' : '저장 완료';
    const SavingStatusIcon = isWorking ? SavingIcon : SaveCompleteIcon;
    const canConfirm =
        !isWorking &&
        !isAiGenerating &&
        !dutyQuery.isLoading &&
        !dutyQuery.isError &&
        Boolean(dutyQuery.data) &&
        canConfirmAiAutofill(aiStatus);
    const hasDraftChanges = history.past.length > 0;
    const statusTone = getAiAutofillStatusTone(aiStatus);
    const statusDescription = getAiAutofillStatusDescription(aiStatus, hasDraftChanges);
    const aiActionLabel = getAiAutofillActionLabel(aiStatus);
    const statusTitle = t(`page.makeShift.aiRefill.title.${aiStatus}`);
    const currentContextKey = `${wardId ?? 'none'}:${currentShiftTeamId ?? 'none'}:${year}:${month}`;
    const handleConfirm = async () => {
        if (!wardId || !dutyQuery.data || !canConfirm) return;

        setIsWorking(true);

        try {
            const dto = docToWardShiftsDTO(editorDoc, dutyQuery.data);

            await WardAPI.updateShifts(wardId, dto);
            useCase.complete();
        } catch {
            toast.error(t('page.makeShift.aiRefill.saveFailed'));
        } finally {
            setIsWorking(false);
        }
    };
    const handleAiFill = async () => {
        if (wardId == null || currentShiftTeamId == null || isAiGenerating) return;

        const requestSeq = aiRequestSeqRef.current + 1;
        const requestContext = {wardId, shiftTeamId: currentShiftTeamId, year, month};

        aiRequestSeqRef.current = requestSeq;
        setIsAiGenerating(true);
        setAiStatus('loading');
        setLastErrorMessage(null);

        try {
            const result = await requestAiSchedule({
                wardId: requestContext.wardId,
                shiftTeamId: requestContext.shiftTeamId,
                year: requestContext.year,
                month: requestContext.month,
                doc: editorDoc,
            });

            if (aiRequestSeqRef.current !== requestSeq) return;

            const currentContext = currentAiContextRef.current;

            if (
                currentContext.wardId !== requestContext.wardId ||
                currentContext.shiftTeamId !== requestContext.shiftTeamId ||
                currentContext.year !== requestContext.year ||
                currentContext.month !== requestContext.month
            ) {
                setAiStatus('idle');
                setLastErrorMessage(null);

                return;
            }

            if (!result.ok) {
                setAiStatus('error');
                setLastErrorMessage(result.message);

                return;
            }

            commands.applySchedule(result.response.schedule, 'ai');
            setAiStatus('success');
        } finally {
            if (aiRequestSeqRef.current === requestSeq) {
                setIsAiGenerating(false);
            }
        }
    };

    useEffect(() => {
        if (!dutyQuery.data) return;

        const nextDoc = shiftToDoc(dutyQuery.data, year, month);
        const persisted = commands.getPersisted();
        const hasContextChanged = hydratedContextKeyRef.current !== currentContextKey;

        if (persisted && isSameDocShape(persisted.doc, nextDoc)) {
            commands.hydrate(persisted);

            if (hasContextChanged) {
                setAiStatus('idle');
                setLastErrorMessage(null);
            }

            hydratedContextKeyRef.current = currentContextKey;

            return;
        }

        commands.init(nextDoc);

        if (hasContextChanged) {
            setAiStatus('idle');
            setLastErrorMessage(null);
        }

        hydratedContextKeyRef.current = currentContextKey;
    }, [commands, currentContextKey, dutyQuery.data, month, year]);

    return (
        <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-scroll">
            <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                    <h1 className="font-apple text-[32px] font-semibold text-sub-1">AI가 채운 근무표를 수정해 보세요</h1>
                    <p className="mt-3 font-apple text-lg text-gray-3">{renderMultilineText(t('page.makeShift.aiRefill.intro'))}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <div className="flex items-center gap-4">
                        <button
                            className={`flex h-[27px] items-center rounded-[5px] border px-[10px] py-[5px] font-apple text-[14px] text-sub-2.5 ${
                                autoFillEnabled ? 'border-[#BFC7D4] bg-white' : 'border-[#BFC7D4] bg-[#E0E5EB] opacity-80'
                            }`}
                            onClick={() => setAutoFillEnabled((prev) => !prev)}
                            type="button"
                        >
                            자동 채우기 {autoFillEnabled ? 'ON' : 'OFF'}
                        </button>
                        <button
                            className={`flex h-[27px] items-center gap-2 rounded-[5px] border px-[10px] py-[5px] font-apple text-[14px] text-sub-2.5 ${
                                showFaults ? 'border-[#BFC7D4] bg-white' : 'border-[#BFC7D4] bg-[#E0E5EB] opacity-80'
                            }`}
                            onClick={() => setShowFaults((prev) => !prev)}
                            type="button"
                        >
                            <div className={`flex items-center gap-[2px] ${showFaults ? '' : 'opacity-0'}`}>
                                <span className="h-4 w-4 rounded-[3px] border border-[#F00] bg-[#FF000080]" />
                                <span className="h-4 w-4 rounded-[3px] border border-[#F80] bg-[#FF88004D]" />
                                <span className="h-4 w-4 rounded-[3px] border border-[#FFD900] bg-[#EEFF004D]" />
                            </div>
                            잘못된 근무 {showFaults ? 'ON' : 'OFF'}
                        </button>
                        <InfoIcon className="h-[26px] w-[26px] text-sub-2.5" />
                    </div>
                    <div className="flex items-center gap-1 text-[12px] text-sub-2.5">
                        <SavingStatusIcon className="h-5 w-5" />
                        <span className="font-apple">{savingLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => commands.undo()} type="button">
                            <HistoryBackIcon className="h-[26px] w-[26px] text-sub-2.5" />
                        </button>
                        <button onClick={() => commands.redo()} type="button">
                            <HistoryNextIcon className="h-[26px] w-[26px] text-sub-2.5" />
                        </button>
                    </div>
                    <button
                        className="flex h-[42px] items-center rounded-[10px] bg-gray-6 px-5 font-apple text-base font-semibold text-gray-3 disabled:opacity-50"
                        disabled={!canPrev || isAiGenerating || isWorking}
                        onClick={() => useCase.prev()}
                        type="button"
                    >
                        {t('page.makeShift.aiRefill.previous')}
                    </button>
                    <button
                        className="ml-2 flex h-[42px] w-[208px] items-center justify-center gap-[6px] rounded-[10px] font-apple text-[24px] font-semibold text-white"
                        disabled={isAiGenerating}
                        style={{backgroundImage: 'linear-gradient(105deg, #B53DFA 0%, #663DFA 100%)'}}
                        onClick={handleAiFill}
                        type="button"
                    >
                        <PlusIcon className="h-6 w-6 stroke-white" />
                        {t(`page.makeShift.aiRefill.${aiActionLabel}`)}
                    </button>
                    <button
                        className="flex h-[42px] items-center rounded-[10px] bg-[#0A0F15] px-[20px] py-[8px] font-apple text-[24px] font-semibold text-white disabled:opacity-50"
                        disabled={!canConfirm}
                        onClick={handleConfirm}
                        type="button"
                    >
                        {t('page.makeShift.aiRefill.confirm')}
                    </button>
                </div>
            </div>

            <div
                aria-atomic="true"
                aria-live={aiStatus === 'error' ? 'assertive' : 'polite'}
                role={aiStatus === 'error' ? 'alert' : 'status'}
                className={cn(
                    'mt-6 rounded-[20px] border px-6 py-5 shadow-banner',
                    statusTone === 'neutral' && 'border-sub-4.5 bg-[#F7F9FC]',
                    statusTone === 'progress' && 'border-main-light bg-[#F2F7FF]',
                    statusTone === 'success' && 'border-[#C8E8D2] bg-[#F3FFF7]',
                    statusTone === 'danger' && 'border-[#FFD3D3] bg-[#FFF6F6]',
                )}
            >
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="font-apple text-xl font-semibold text-sub-1">{statusTitle}</p>
                        <div className="mt-2 space-y-1 font-apple text-base text-gray-3">
                            <p>{renderMultilineText(t(statusDescription.primaryKey))}</p>
                            <p>{renderMultilineText(t(statusDescription.draftKey))}</p>
                        </div>
                        {lastErrorMessage ? <p className="mt-3 font-apple text-sm font-medium text-red">{lastErrorMessage}</p> : null}
                    </div>
                    {aiStatus === 'error' ? (
                        <button
                            className="rounded-[10px] border border-sub-4.5 bg-white px-4 py-2 font-apple text-base font-semibold text-sub-1"
                            disabled={isAiGenerating}
                            onClick={handleAiFill}
                            type="button"
                        >
                            {t('page.makeShift.aiRefill.retry')}
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="mt-8 flex min-h-0 flex-1 outline-none" onKeyDown={onKeyDown} onPaste={onPaste} ref={editorRef} tabIndex={0}>
                {dutyQuery.isLoading && (
                    <PageState tone="loading" title="근무표를 불러오는 중이에요" description={t('page.state.loadingDescription')} />
                )}
                {dutyQuery.isError && (
                    <PageState
                        tone="error"
                        title="근무표를 불러오지 못했어요"
                        description={t('page.state.errorDescription')}
                        action={{label: t('page.state.retry'), onClick: () => void dutyQuery.refetch()}}
                    />
                )}
                {!dutyQuery.isLoading && !dutyQuery.isError && dutyQuery.data && (
                    <div
                        className="flex min-h-0 flex-1"
                        onClick={() => {
                            editorRef.current?.focus();
                        }}
                    >
                        <div className="mx-auto flex w-fit min-w-418.5 flex-col">
                            <ShiftCalendar
                                shift={dutyQuery.data}
                                doc={editorDoc}
                                onCellClick={() => editorRef.current?.focus()}
                                disableInitialSelection
                                violations={violationMap}
                                showLayer={{fault: showFaults, check: false, slash: false}}
                            />
                            <div
                                className="sticky bottom-0 z-20 flex items-stretch gap-5 py-5 pl-55.25"
                                style={{
                                    height: dutyQuery.data
                                        ? `${dutyQuery.data.wardShiftTypes.filter((x) => x.isCounted).length * 2.5 + 2.5}rem`
                                        : '0',
                                }}
                            >
                                <CountDutyByDay shift={dutyQuery.data} doc={editorDoc} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
