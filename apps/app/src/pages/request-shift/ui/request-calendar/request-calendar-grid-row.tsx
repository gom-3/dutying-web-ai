import {cn} from '@dutying/utils/style';
import {type DraggableProvided} from '@hello-pangea/dnd';
import {type RefObject} from 'react';
import {type TDutyRequest, type TRequestShift} from '@/entities/shift';
import {type TWardShiftType} from '@/entities/ward';
import {type TFocus} from '@/features/request-shift/model/types';
import {type TSkillLevelConfig} from '@/features/ward-skill/model/skill-level';
import SkillBadge from '@/features/ward-skill/ui/skill-badge';
import {LinkedIcon, SixDotsIcon, UnlinkedIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {formatAnnualLeaveDays} from '@/shared/lib/annual-leave';
import RequestCalendarGridCell from './request-calendar-grid-cell';
import {
    REQUEST_CALENDAR_ANNUAL_LEAVE_COLUMN_CLASS,
    REQUEST_CALENDAR_NAME_COLUMN_CLASS,
    REQUEST_CALENDAR_NURSE_NAME_TEXT_CLASS,
    REQUEST_CALENDAR_REORDER_COLUMN_CLASS,
} from './request-calendar-layout';
import {getDutyRequestLookupKey, getRequestCalendarRowClassName} from './utils';

type TRequestShiftRow = TRequestShift['divisionShiftNurses'][number][number];

type TRequestCalendarGridRowProps = {
    row: TRequestShiftRow;
    rowIndex: number;
    focus: TFocus | null;
    readonly: boolean;
    canReorder: boolean;
    rowReorderDisabled: boolean;
    separateWeekendColor: boolean;
    requestShift: TRequestShift;
    wardShiftTypeMap: Map<number, TWardShiftType>;
    dutyRequestLookup: Map<string, TDutyRequest>;
    connectedNurseIds: Set<number>;
    skillConfig: TSkillLevelConfig;
    skillLevel: number | null | undefined;
    showSkillColumn: boolean;
    focusedCellRef: RefObject<HTMLDivElement | null>;
    draggableProvided: DraggableProvided;
    onSelectCell: (focus: TFocus) => void;
};

export default function RequestCalendarGridRow({
    row,
    rowIndex,
    focus,
    readonly,
    canReorder,
    rowReorderDisabled,
    separateWeekendColor,
    requestShift,
    wardShiftTypeMap,
    dutyRequestLookup,
    connectedNurseIds,
    skillConfig,
    skillLevel,
    showSkillColumn,
    focusedCellRef,
    draggableProvided,
    onSelectCell,
}: TRequestCalendarGridRowProps) {
    const {t} = useTypedTranslation();
    const isFocusedRow = focus?.shiftNurseId === row.shiftNurse.shiftNurseId;
    const effectiveDragHandleProps = canReorder && !rowReorderDisabled ? draggableProvided.dragHandleProps : undefined;
    const annualLeaveLabel = formatAnnualLeaveDays(row.shiftNurse.remainingAnnualLeaveDays);

    return (
        <div
            className={getRequestCalendarRowClassName({isFocusedRow})}
            ref={draggableProvided.innerRef}
            {...draggableProvided.draggableProps}
        >
            {canReorder ? (
                <button
                    type="button"
                    disabled={rowReorderDisabled}
                    className={cn(
                        'request-calendar__row-drag-handle grid cursor-grab place-items-center self-center rounded-[8px] border-0 bg-transparent p-0 leading-none text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-2 focus-visible:ring-2 focus-visible:ring-main-1/25 focus-visible:outline-none active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-55',
                        REQUEST_CALENDAR_REORDER_COLUMN_CLASS,
                    )}
                    {...(effectiveDragHandleProps ?? {})}
                    aria-label={t('page.request.calendar.reorderAria', {name: row.shiftNurse.name})}
                    title={t('page.request.calendar.reorderAria', {name: row.shiftNurse.name})}
                >
                    <SixDotsIcon className="block size-[clamp(13px,1.1vw,16px)]" aria-hidden="true" />
                </button>
            ) : null}
            <div
                className={cn(
                    REQUEST_CALENDAR_NAME_COLUMN_CLASS,
                    REQUEST_CALENDAR_NURSE_NAME_TEXT_CLASS,
                    isFocusedRow && 'font-semibold text-main-1',
                )}
            >
                {row.shiftNurse.name}
            </div>
            <div
                className={cn(
                    'request-calendar__annual-leave-column text-center font-poppins text-[clamp(11px,0.9cqw,14px)] font-semibold text-sub-2 tabular-nums',
                    REQUEST_CALENDAR_ANNUAL_LEAVE_COLUMN_CLASS,
                    isFocusedRow && 'text-main-1',
                )}
                title={t('page.request.calendar.annualLeaveTitle', {count: annualLeaveLabel})}
            >
                {annualLeaveLabel}
            </div>
            {showSkillColumn ? (
                <div className="flex w-11 shrink-0 justify-center">
                    <SkillBadge level={skillLevel} config={skillConfig} className="min-h-[18px] min-w-10 px-1.5 text-[10px]" />
                </div>
            ) : null}
            <div className="flex w-6 shrink-0 items-center justify-center text-center font-apple text-[13px] text-sub-1">
                {connectedNurseIds.has(row.shiftNurse.nurseId) ? (
                    <LinkedIcon className="h-[17px] w-[17px]" />
                ) : (
                    <UnlinkedIcon className="h-[17px] w-[17px]" />
                )}
            </div>
            <div className="flex h-full flex-1 px-1">
                {row.wardReqShiftList.map((currentShiftTypeId, day) => {
                    const requestDutyRequest = dutyRequestLookup.get(getDutyRequestLookupKey(row.shiftNurse.nurseId, day)) ?? null;

                    return (
                        <RequestCalendarGridCell
                            key={day}
                            day={day}
                            isSampleCell={rowIndex === 0 && day === 0}
                            dayType={requestShift.days[day].dayType}
                            shiftNurseId={row.shiftNurse.shiftNurseId}
                            shiftNurseName={row.shiftNurse.name}
                            currentShiftTypeId={currentShiftTypeId}
                            requestDutyRequest={requestDutyRequest}
                            focus={focus}
                            readonly={readonly}
                            separateWeekendColor={separateWeekendColor}
                            wardShiftTypeMap={wardShiftTypeMap}
                            focusedCellRef={focusedCellRef}
                            onSelectCell={onSelectCell}
                        />
                    );
                })}
            </div>
        </div>
    );
}
