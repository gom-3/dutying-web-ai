import {type ComponentProps, useRef} from 'react';
import {type TShift} from '@/entities';
import {type TDutyDoc, useShiftImageExport} from '@/features/shift-editor/model';
import NurseEditModal from './nurse-edit-modal';
import {ShiftEditorCanvas} from './shift-editor-canvas';
import ShiftCalendar from './shift-calendar';
import Toolbar from './toolbar';

interface IMakeShiftEditorViewProps {
    shift: TShift;
    doc: TDutyDoc;
    readonly?: boolean;
    showToolbar?: boolean;
    showCalendar?: boolean;
    showCountByDay?: boolean;
    showPanel?: boolean;
    showNurseEditModal?: boolean;
    stickyBottom?: boolean;
    className?: string;
    calendarProps?: Omit<ComponentProps<typeof ShiftCalendar>, 'shift' | 'doc'>;
    toolbarProps?: Omit<ComponentProps<typeof Toolbar>, 'shift' | 'onDownloadImage' | 'isDownloadingImage'>;
}

export const MakeShiftEditorView = ({
    shift,
    doc,
    showToolbar = true,
    showCalendar = true,
    showCountByDay = true,
    showNurseEditModal = true,
    stickyBottom = true,
    className,
    calendarProps,
    toolbarProps,
}: IMakeShiftEditorViewProps) => {
    const exportRef = useRef<HTMLDivElement>(null);
    const {isExporting, downloadImage} = useShiftImageExport({
        targetRef: exportRef,
        year: toolbarProps?.year ?? new Date().getFullYear(),
        month: toolbarProps?.month ?? 1,
        teamName: toolbarProps?.currentShiftTeam?.name ?? null,
        disabled: !shift,
    });

    return (
        <div className={`mx-auto flex w-fit flex-col ${className ?? ''}`}>
            {showToolbar && toolbarProps && (
                <Toolbar
                    shift={shift}
                    isDownloadingImage={isExporting}
                    onDownloadImage={() => void downloadImage()}
                    {...toolbarProps}
                />
            )}
            {showCalendar && (
                <ShiftEditorCanvas
                    shift={shift}
                    doc={doc}
                    showCountByDay={showCountByDay}
                    stickyBottom={stickyBottom}
                    exportMode={isExporting}
                    exportRef={exportRef}
                    calendarProps={calendarProps}
                />
            )}
            {showNurseEditModal && <NurseEditModal />}
        </div>
    );
};
