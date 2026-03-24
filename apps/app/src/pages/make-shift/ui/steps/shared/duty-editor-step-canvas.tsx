import {type ClipboardEventHandler, type ComponentProps, type KeyboardEventHandler, type RefObject} from 'react';
import {type TShift} from '@/entities';
import {type TDutyDoc} from '@/features/shift-editor';
import type ShiftCalendar from '@/features/shift-editor/ui/complex-view/shift-calendar';
import {ShiftEditorCanvas} from '@/features/shift-editor/ui/complex-view/shift-editor-canvas';
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
    editorDoc: TDutyDoc;
    violationMap: TShiftCalendarViolations;
    editorRef: RefObject<HTMLDivElement | null>;
    onKeyDown: KeyboardEventHandler<HTMLDivElement>;
    onPaste: ClipboardEventHandler<HTMLDivElement>;
    onFocusEditor: () => void;
    showFaults: boolean;
    exportRef?: RefObject<HTMLDivElement | null>;
    exportMode?: boolean;
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
    exportRef,
    exportMode = false,
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
                    <ShiftEditorCanvas
                        shift={duty}
                        doc={editorDoc}
                        className="min-w-418.5"
                        exportRef={exportRef}
                        exportMode={exportMode}
                        calendarProps={{
                            onCellClick: onFocusEditor,
                            disableInitialSelection: true,
                            violations: violationMap,
                            showLayer: {fault: showFaults, check: false, slash: false},
                        }}
                    />
                </div>
            )}
        </div>
    );
}
