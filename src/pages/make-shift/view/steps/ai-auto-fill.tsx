import {useQuery} from '@tanstack/react-query';
import {useEffect, useMemo, useRef, useState} from 'react';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth/useAuth';
import {
    type TDutyDoc,
    useShiftEditorCommands,
    useShiftEditorKeyBindings,
    useShiftEditorStore,
    buildViolationMap,
} from '@/features/shift-editor';
import CountDutyByDay from '@/features/shift-editor/ui/complex-view/count-duty-by-day';
import ShiftCalendar from '@/features/shift-editor/ui/complex-view/shift-calendar';
import WardAPI from '@/shared/api/ward';
import {HistoryBackIcon, HistoryNextIcon, InfoIcon, PlusIcon, SaveCompleteIcon, SavingIcon} from '@/shared/assets/svg';
import {DutyManagementStatusCard} from '@/widgets/duty-management/ui';
import {generateMockAiSchedule} from '../../model/ai-schedule-mock';
import {useMakeShiftStore} from '../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../model/make-shift-use-case';
import {buildWorkKeyMap, docToWardShiftsDTO, shiftToDoc} from '../../model/shift-editor-adapter';

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
    const commands = useShiftEditorCommands();
    const useCase = useMakeShiftUseCase();
    const workKeyMap = useMemo(() => buildWorkKeyMap(dutyQuery.data), [dutyQuery.data]);
    const {onKeyDown, onPaste} = useShiftEditorKeyBindings({workKeyMap});
    const editorRef = useRef<HTMLDivElement>(null);
    const [autoFillEnabled, setAutoFillEnabled] = useState(false);
    const [showFaults, setShowFaults] = useState(true);
    const violationMap = useMemo(() => buildViolationMap(violations, editorDoc), [violations, editorDoc]);
    const [isWorking, setIsWorking] = useState(false);
    const savingLabel = isWorking ? '저장 중' : '저장 완료';
    const SavingStatusIcon = isWorking ? SavingIcon : SaveCompleteIcon;
    const handleConfirm = async () => {
        if (!wardId || !dutyQuery.data) return;

        setIsWorking(true);

        try {
            const dto = docToWardShiftsDTO(editorDoc, dutyQuery.data);

            await WardAPI.updateShifts(wardId, dto);
            useCase.complete();
        } catch {
            alert('저장에 실패했습니다.');
        } finally {
            setIsWorking(false);
        }
    };
    const handleAiFill = () => {
        const response = generateMockAiSchedule(editorDoc);

        commands.applySchedule(response.schedule, 'ai');
    };

    useEffect(() => {
        if (!dutyQuery.data) return;

        const nextDoc = shiftToDoc(dutyQuery.data, year, month);
        const persisted = commands.getPersisted();

        if (persisted && isSameDocShape(persisted.doc, nextDoc)) {
            commands.hydrate(persisted);

            return;
        }

        commands.init(nextDoc);
    }, [commands, dutyQuery.data, month, year]);

    return (
        <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-scroll">
            <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex shrink-0 items-center gap-3">
                    <h1 className="font-apple text-[32px] font-semibold text-sub-1">AI가 채운 근무표를 수정해 보세요</h1>
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
                        className="ml-2 flex h-[42px] w-[208px] items-center justify-center gap-[6px] rounded-[10px] font-apple text-[24px] font-semibold text-white"
                        style={{backgroundImage: 'linear-gradient(105deg, #B53DFA 0%, #663DFA 100%)'}}
                        onClick={handleAiFill}
                        type="button"
                    >
                        <PlusIcon className="h-6 w-6 stroke-white" />
                        AI 다시 채우기
                    </button>
                    <button
                        className="flex h-[42px] items-center rounded-[10px] bg-[#0A0F15] px-[20px] py-[8px] font-apple text-[24px] font-semibold text-white"
                        onClick={handleConfirm}
                        type="button"
                    >
                        확정하기
                    </button>
                </div>
            </div>

            <div className="mt-8 flex min-h-0 flex-1 outline-none" onKeyDown={onKeyDown} onPaste={onPaste} ref={editorRef} tabIndex={0}>
                {dutyQuery.isLoading && <DutyManagementStatusCard title="근무표를 불러오는 중입니다..." className="w-full shadow-banner" />}
                {dutyQuery.isError && <DutyManagementStatusCard title="근무표를 불러오지 못했어요." className="w-full shadow-banner" />}
                {!dutyQuery.isLoading && !dutyQuery.isError && dutyQuery.data && (
                    <div
                        className="flex min-h-0 flex-1"
                        onClick={() => {
                            editorRef.current?.focus();
                        }}
                    >
                        <div className={`mx-auto flex w-fit min-w-418.5 flex-col`}>
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
