import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {ManagementActionButton} from '@/widgets/duty-management/ui';
import {canGoNext, canGoPrev, useMakeShiftStore} from '../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../model/make-shift-use-case';
import {DutyEditorStepCanvas} from './shared/duty-editor-step-canvas';
import {useDutyEditorStep} from './shared/use-duty-editor-step';

export function FixedShifts() {
    const {t} = useTypedTranslation();
    const useCase = useMakeShiftUseCase();
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const canNext = useMakeShiftStore((s) => canGoNext(s));
    const {dutyQuery, editorDoc, violationMap, editorRef, onKeyDown, onPaste, focusEditor} = useDutyEditorStep();

    return (
        <div id="make_fixed_shifts_step" className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-scroll">
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
            <DutyEditorStepCanvas
                duty={dutyQuery.data}
                isLoading={dutyQuery.isLoading}
                isError={dutyQuery.isError}
                onRetry={dutyQuery.refetch}
                loadingTitle={t('page.makeShift.fixedShifts.loading')}
                errorTitle={t('page.makeShift.fixedShifts.error')}
                editorDoc={editorDoc}
                violationMap={violationMap}
                editorRef={editorRef}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onFocusEditor={focusEditor}
                showFaults
            />
        </div>
    );
}
