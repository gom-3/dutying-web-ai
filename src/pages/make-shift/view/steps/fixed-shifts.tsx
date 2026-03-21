import {useQuery} from '@tanstack/react-query';
import {useEffect, useMemo, useRef} from 'react';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth/useAuth';
import {
    buildWorkKeyMap,
    buildViolationMap,
    shiftToDoc,
    type TDutyDoc,
    useShiftEditorCommands,
    useShiftEditorKeyBindings,
    useShiftEditorStore,
} from '@/features/shift-editor';
import CountDutyByDay from '@/features/shift-editor/ui/complex-view/count-duty-by-day';
import ShiftCalendar from '@/features/shift-editor/ui/complex-view/shift-calendar';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
import {ManagementActionButton} from '@/widgets/duty-management/ui';
import {canGoNext, canGoPrev, useMakeShiftStore} from '../../model/make-shift-store';
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

export function FixedShifts() {
    const useCase = useMakeShiftUseCase();
    const {t} = useTypedTranslation();
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
    const violations = useShiftEditorStore((s) => s.violations);
    const violationMap = useMemo(() => buildViolationMap(violations, editorDoc), [violations, editorDoc]);

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
                <div>
                    <p className="font-apple text-[32px] font-semibold text-sub-1">고정할 근무를 선택해 주세요</p>
                </div>

                <div className="flex items-center gap-3">
                    <ManagementActionButton variant="neutral" size="sm" onClick={() => useCase.prev()} disabled={!canPrev}>
                        이전
                    </ManagementActionButton>
                    <ManagementActionButton size="sm" onClick={() => useCase.next()} disabled={!canNext}>
                        다음
                    </ManagementActionButton>
                </div>
            </div>

            <div className="mt-8 flex min-h-0 flex-1 outline-none" onKeyDown={onKeyDown} onPaste={onPaste} ref={editorRef} tabIndex={0}>
                {dutyQuery.isLoading && (
                    <PageState tone="loading" title="근무표를 불러오는 중이에요" description={t('page.state.loadingDescription')} />
                )}
                {dutyQuery.isError && (
                    <PageState
                        tone="error"
                        title="고정 근무 데이터를 불러오지 못했어요"
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
                                showLayer={{fault: true, check: false, slash: false}}
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
