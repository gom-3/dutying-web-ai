import {useQuery} from '@tanstack/react-query';
import {useEffect, useMemo, useRef} from 'react';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth/useAuth';
import {type TDutyDoc, useShiftEditorCommands, useShiftEditorKeyBindings, useShiftEditorStore} from '@/features/shift-editor';
import CountDutyByDay from '@/features/shift-editor/ui/complex-view/count-duty-by-day';
import ShiftCalendar from '@/features/shift-editor/ui/complex-view/shift-calendar';
import {canGoNext, canGoPrev, useMakeShiftStore} from '../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../model/make-shift-use-case';
import {buildWorkKeyMap, shiftToDoc} from '../../model/shift-editor-adapter';

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

export function FixedShifts() {
    const useCase = useMakeShiftUseCase();
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const canNext = useMakeShiftStore((s) => canGoNext(s));
    const editorDoc = useShiftEditorStore((s) => s.doc);
    const commands = useShiftEditorCommands();
    const editorRef = useRef<HTMLDivElement>(null);
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
    const workKeyMap = useMemo(() => buildWorkKeyMap(dutyQuery.data), [dutyQuery.data]);
    const {onKeyDown, onPaste} = useShiftEditorKeyBindings({workKeyMap});

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
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                    <p className="font-apple text-[32px] font-semibold text-sub-1">고정할 근무를 선택해 주세요</p>
                    <p className="mt-2 font-apple text-xl font-medium text-gray-3">고정 근무를 확인하고 반영해 주세요.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        className="h-[42px] rounded-[10px] bg-gray-6 px-5 font-apple text-base font-semibold text-gray-3 disabled:opacity-50"
                        onClick={() => useCase.prev()}
                        disabled={!canPrev}
                        type="button"
                    >
                        이전
                    </button>
                    <button
                        className="h-[42px] rounded-[10px] bg-main-1 px-5 font-apple text-base font-semibold text-white disabled:opacity-50"
                        onClick={() => useCase.next()}
                        disabled={!canNext}
                        type="button"
                    >
                        다음
                    </button>
                </div>
            </div>

            <div className="mt-8 flex min-h-0 flex-1 outline-none" onKeyDown={onKeyDown} onPaste={onPaste} ref={editorRef} tabIndex={0}>
                {dutyQuery.isLoading && (
                    <div className="flex flex-1 items-center justify-center rounded-[20px] bg-white shadow-banner">
                        <p className="font-apple text-base text-gray-3">근무표를 불러오는 중입니다...</p>
                    </div>
                )}
                {dutyQuery.isError && (
                    <div className="flex flex-1 items-center justify-center rounded-[20px] bg-white shadow-banner">
                        <p className="font-apple text-base text-gray-3">근무표를 불러오지 못했어요.</p>
                    </div>
                )}
                {!dutyQuery.isLoading && !dutyQuery.isError && dutyQuery.data && (
                    <div
                        className="flex min-h-0 flex-1"
                        onClick={() => {
                            editorRef.current?.focus();
                        }}
                    >
                        <div className={`mx-auto flex h-screen w-fit min-w-418.5 flex-col`}>
                            <ShiftCalendar
                                shift={dutyQuery.data}
                                doc={editorDoc}
                                onCellClick={() => editorRef.current?.focus()}
                                disableInitialSelection
                            />
                            <div
                                className="sticky bottom-0 z-20 flex items-stretch gap-5 bg-white py-5 pl-63.75"
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
