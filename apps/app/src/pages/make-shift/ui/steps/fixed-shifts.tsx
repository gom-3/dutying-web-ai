import {useEffect, useMemo, useRef} from 'react';
import {useShiftEditorStore, useShiftImageExport} from '@/features/shift-editor';
import {CameraIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {ManagementActionButton} from '@/widgets/duty-management/ui';
import {canGoNext, canGoPrev, useMakeShiftStore} from '../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../model/make-shift-use-case';
import {DutyEditorStepCanvas} from './shared/duty-editor-step-canvas';
import {useDutyEditorStep} from './shared/use-duty-editor-step';

export function FixedShifts() {
    const {t} = useTypedTranslation();
    const useCase = useMakeShiftUseCase();
    const setEditorMode = useShiftEditorStore((s) => s.setEditorMode);
    const editorMode = useShiftEditorStore((s) => s.editorMode);

    useEffect(() => {
        if (editorMode !== 'fixed') {
            setEditorMode('fixed');
        }
    }, [editorMode, setEditorMode]);

    useEffect(() => {
        return () => setEditorMode('normal');
    }, [setEditorMode]);

    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const canNext = useMakeShiftStore((s) => canGoNext(s));
    const currentShiftTeamName = useMakeShiftStore(
        (s) => s.shiftTeams.find((team) => team.shiftTeamId === s.currentShiftTeamId)?.name ?? null,
    );
    const {dutyQuery, editorDoc, violationMap, editorRef, onKeyDown, onPaste, focusEditor} = useDutyEditorStep();
    const fixedOnlyDoc = useMemo(
        () => ({
            ...editorDoc,
            rows: editorDoc.rows.map((row) => ({
                ...row,
                cells: row.cells.map((cell, colIdx) => {
                    const date = editorDoc.columns[colIdx];

                    if (!date) return null;

                    const key = `${row.workerId}|${date}`;

                    return editorDoc.fixedCells[key] || editorDoc.requestCells[key] ? cell : null;
                }),
            })),
        }),
        [editorDoc],
    );
    const canExportImage = Boolean(dutyQuery.data) && !dutyQuery.isLoading && !dutyQuery.isError;
    const exportRef = useRef<HTMLDivElement>(null);
    const {isExporting, downloadImage} = useShiftImageExport({
        targetRef: exportRef,
        year,
        month,
        teamName: currentShiftTeamName,
        disabled: !canExportImage,
    });

    return (
        <div id="make_fixed_shifts_step" className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-scroll">
            <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                    <p className="font-apple text-[32px] font-semibold text-sub-1">고정할 근무를 선택해 주세요</p>
                </div>

                <div className="flex items-center gap-3">
                    <ManagementActionButton
                        variant="outline"
                        size="sm"
                        onClick={() => void downloadImage()}
                        disabled={!canExportImage || isExporting}
                    >
                        <span className="flex items-center gap-2">
                            <CameraIcon className="h-5 w-5 stroke-main-1" />
                            {isExporting ? '이미지 저장 중' : '이미지 저장'}
                        </span>
                    </ManagementActionButton>
                    <ManagementActionButton variant="neutral" size="sm" onClick={() => useCase.prev()} disabled={!canPrev}>
                        이전
                    </ManagementActionButton>
                    <ManagementActionButton size="sm" onClick={() => useCase.next()} disabled={!canNext}>
                        다음
                    </ManagementActionButton>
                </div>
            </div>
            <DutyEditorStepCanvas
                duty={dutyQuery.data}
                isLoading={dutyQuery.isLoading}
                isError={dutyQuery.isError}
                onRetry={dutyQuery.refetch}
                loadingTitle={t('page.makeShift.fixedShifts.loading')}
                errorTitle={t('page.makeShift.fixedShifts.error')}
                editorDoc={fixedOnlyDoc}
                violationMap={violationMap}
                editorRef={editorRef}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onFocusEditor={focusEditor}
                showFaults
                exportRef={exportRef}
                exportMode={isExporting}
            />
        </div>
    );
}
