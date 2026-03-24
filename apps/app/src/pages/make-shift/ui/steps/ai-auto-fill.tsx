import {cn} from '@dutying/utils/style';
import {useCallback, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import useAuth from '@/features/auth';
import {docToWardShiftsDTO, useShiftEditorCommands, useShiftEditorStore, useShiftImageExport} from '@/features/shift-editor';
import WardAPI from '@/shared/api/ward';
import {CameraIcon, HistoryBackIcon, HistoryNextIcon, InfoIcon, PlusIcon, SaveCompleteIcon, SavingIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {renderMultilineText} from '@/shared/util/string';
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
import {DutyEditorStepCanvas} from './shared/duty-editor-step-canvas';
import {useDutyEditorStep} from './shared/use-duty-editor-step';

export function AiAutofill() {
    const {t} = useTypedTranslation();
    const {
        state: {wardId},
    } = useAuth();
    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const currentShiftTeamName = useMakeShiftStore(
        (s) => s.shiftTeams.find((team) => team.shiftTeamId === s.currentShiftTeamId)?.name ?? null,
    );
    const commands = useShiftEditorCommands();
    const editorDoc = useShiftEditorStore((s) => s.doc);
    const history = useShiftEditorStore((s) => s.history);
    const useCase = useMakeShiftUseCase();
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const [autoFillEnabled, setAutoFillEnabled] = useState(false);
    const [showFaults, setShowFaults] = useState(true);
    const [isWorking, setIsWorking] = useState(false);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiStatus, setAiStatus] = useState<TAiAutofillStatus>('idle');
    const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);
    const resetAiStatus = useCallback(() => {
        setAiStatus('idle');
        setLastErrorMessage(null);
    }, []);
    const {
        dutyQuery,
        editorRef,
        editorDoc: hydratedDoc,
        onKeyDown,
        onPaste,
        violationMap,
        focusEditor,
    } = useDutyEditorStep({
        onContextChanged: resetAiStatus,
    });
    const exportRef = useRef<HTMLDivElement>(null);
    const aiRequestSeqRef = useRef(0);
    const currentAiContextRef = useRef({wardId, shiftTeamId: currentShiftTeamId, year, month});
    const {isExporting, downloadImage} = useShiftImageExport({
        targetRef: exportRef,
        year,
        month,
        teamName: currentShiftTeamName,
        disabled: !dutyQuery.data || dutyQuery.isLoading || dutyQuery.isError,
    });

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
                resetAiStatus();

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

    return (
        <div id="make_ai_autofill_step" className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-scroll">
            <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                    <h1 className="font-apple text-[32px] font-semibold text-sub-1">AI가 채운 근무표를 수정해 보세요</h1>
                    <p className="mt-3 font-apple text-lg text-gray-3">{renderMultilineText(t('page.makeShift.aiRefill.intro'))}</p>
                </div>
                <div id="make_ai_autofill_actions" className="flex shrink-0 flex-wrap items-center gap-3">
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
                        className="flex h-[42px] items-center gap-2 rounded-[10px] border border-sub-4.5 bg-white px-4 font-apple text-base font-semibold text-sub-1 disabled:opacity-50"
                        disabled={!dutyQuery.data || dutyQuery.isLoading || dutyQuery.isError || isExporting}
                        onClick={() => void downloadImage()}
                        type="button"
                    >
                        <CameraIcon className="h-5 w-5 stroke-sub-1" />
                        {isExporting ? '이미지 저장 중' : '이미지 저장'}
                    </button>
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
                id="make_ai_autofill_status"
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

            <DutyEditorStepCanvas
                duty={dutyQuery.data}
                isLoading={dutyQuery.isLoading}
                isError={dutyQuery.isError}
                onRetry={dutyQuery.refetch}
                loadingTitle={t('page.makeShift.aiRefill.loading')}
                errorTitle={t('page.makeShift.aiRefill.error')}
                editorDoc={hydratedDoc}
                violationMap={violationMap}
                editorRef={editorRef}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onFocusEditor={focusEditor}
                showFaults={showFaults}
                exportRef={exportRef}
                exportMode={isExporting}
            />
        </div>
    );
}
