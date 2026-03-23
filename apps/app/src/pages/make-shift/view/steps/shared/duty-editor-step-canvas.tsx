import {type ClipboardEventHandler, type ComponentProps, type KeyboardEventHandler, type RefObject} from 'react';
import {type TShift} from '@/entities';
import CountDutyByDay from '@/features/shift-editor/ui/complex-view/count-duty-by-day';
import ShiftCalendar from '@/features/shift-editor/ui/complex-view/shift-calendar';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';

type TShiftCalendarViolations = ComponentProps<typeof ShiftCalendar>['violations'];

type TDutyEditorStepCanvasProps = {
    duty: TShift | undefined;
    isLoading: boolean;
    isError: boolean;
    onRetry: () => void;
    loadingTitle: string;
    errorTitle: string;
    editorDoc: ComponentProps<typeof ShiftCalendar>['doc'];
    violationMap: TShiftCalendarViolations;
    editorRef: RefObject<HTMLDivElement | null>;
    onKeyDown: KeyboardEventHandler<HTMLDivElement>;
    onPaste: ClipboardEventHandler<HTMLDivElement>;
    onFocusEditor: () => void;
    showFaults: boolean;
};

export function DutyEditorStepCanvas({
    duty,
    isLoading,
    isError,
    onRetry,
    loadingTitle,
    errorTitle,
    editorDoc,
    violationMap,
    editorRef,
    onKeyDown,
    onPaste,
    onFocusEditor,
    showFaults,
}: TDutyEditorStepCanvasProps) {
    const {t} = useTypedTranslation();

    return (
        <div className="mt-8 flex min-h-0 flex-1 outline-none" onKeyDown={onKeyDown} onPaste={onPaste} ref={editorRef} tabIndex={0}>
            {isLoading && <PageState tone="loading" title={loadingTitle} description={t('page.state.loadingDescription')} />}
            {isError && (
                <PageState
                    tone="error"
                    title={errorTitle}
                    description={t('page.state.errorDescription')}
                    action={{label: t('page.state.retry'), onClick: () => void onRetry()}}
                />
            )}
            {!isLoading && !isError && duty && (
                <div className="flex min-h-0 flex-1" onClick={onFocusEditor}>
                    <div className="mx-auto flex w-fit min-w-418.5 flex-col">
                        <ShiftCalendar
                            shift={duty}
                            doc={editorDoc}
                            onCellClick={onFocusEditor}
                            disableInitialSelection
                            violations={violationMap}
                            showLayer={{fault: showFaults, check: false, slash: false}}
                        />
                        <div
                            className="sticky bottom-0 z-20 flex items-stretch gap-5 py-5 pl-55.25"
                            style={{
                                height: `${duty.wardShiftTypes.filter((shiftType) => shiftType.isCounted).length * 2.5 + 2.5}rem`,
                            }}
                        >
                            <CountDutyByDay shift={duty} doc={editorDoc} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
