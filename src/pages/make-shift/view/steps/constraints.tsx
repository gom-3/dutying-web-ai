import {DragDropContext, Draggable, Droppable, type DropResult} from '@hello-pangea/dnd';
import {ChevronDown} from 'lucide-react';
import {useMemo, useState} from 'react';
import {useShiftEditorCommands, useShiftEditorStore} from '@/features/shift-editor';
import {DUTY_RULE_META, type TDutyRuleMeta} from '@/features/shift-editor/model/duty-constraints';
import {InfoIcon, SixDotsIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Select from '@/shared/ui/Select';
import {cn} from '@/shared/util/style';

type TBucket = 'error' | 'warning' | 'excluded';
type TTypedT = ReturnType<typeof useTypedTranslation>['t'];

function renderRuleEditor(t: TTypedT, meta: TDutyRuleMeta, value: number | null, onChange: (next: number) => void) {
    if (!meta.valueField || !meta.valueOptions || meta.kind === 'noValue') return null;

    const options = meta.valueOptions.map((n) => ({value: n, label: n}));
    const select = (
        <Select
            value={value ?? ''}
            onChange={(e) => onChange(parseInt(e.target.value))}
            options={options}
            className="mx-[.3125rem] h-11 w-16.75"
            selectClassName="rounded-[5px] px-[15px] py-[7px] outline-[0.5px] outline-main-4 text-main-1"
        />
    );

    if (meta.kind === 'maxDays') {
        return (
            <div className="ml-2 flex items-center text-[1.25rem] text-main-1">
                {t('page.makeShift.constraints.phrase.max')}
                {select}
                {t('page.makeShift.constraints.phrase.day')}
            </div>
        );
    }

    if (meta.kind === 'minDays') {
        return (
            <div className="ml-2 flex items-center text-[1.25rem] text-main-1">
                {t('page.makeShift.constraints.phrase.min')}
                {select}
                {t('page.makeShift.constraints.phrase.day')}
            </div>
        );
    }

    if (meta.kind === 'daysOnly') {
        return (
            <div className="ml-2 flex items-center text-[1.25rem] text-main-1">
                {select}
                {t('page.makeShift.constraints.phrase.day')}
            </div>
        );
    }

    return null;
}

export function Constraints() {
    const {t} = useTypedTranslation();
    const editor = useShiftEditorCommands();
    const dutyValidationInput = useShiftEditorStore((s) => s.dutyValidationInput);
    const board = useShiftEditorStore((s) => s.dutyRuleBoard);
    const violations = useShiftEditorStore((s) => s.violations);
    const [open, setOpen] = useState<{error: boolean; warning: boolean}>({error: false, warning: true});
    const ruleViolationCount = useMemo(() => {
        const map = new Map<string, number>();

        for (const v of violations) map.set(v.ruleId, (map.get(v.ruleId) ?? 0) + 1);

        return map;
    }, [violations]);
    const onDragEnd = (result: DropResult) => {
        if (!board) return;

        if (!result.destination) return;

        const fromBucket = result.source.droppableId as TBucket;
        const toBucket = result.destination.droppableId as TBucket;
        const fromIndex = result.source.index;
        const toIndex = result.destination.index;

        if (fromBucket === toBucket && fromIndex === toIndex) return;

        const next = {
            error: board.error.slice(),
            warning: board.warning.slice(),
            excluded: board.excluded.slice(),
        };
        const sourceList = next[fromBucket];
        const [moved] = sourceList.splice(fromIndex, 1);

        if (!moved) return;

        const destList = next[toBucket];

        destList.splice(toIndex, 0, moved);

        editor.setDutyRuleBoard(next);
    };
    const wardConstraint = dutyValidationInput?.wardConstraint ?? null;
    const updateRuleValue = (meta: TDutyRuleMeta, nextValue: number) => {
        if (!wardConstraint) return;

        if (!meta.valueField) return;

        editor.setWardConstraint({...wardConstraint, [meta.valueField]: nextValue});
    };
    const renderBucket = (bucket: TBucket, isCollapsed: boolean) => {
        if (!board) {
            return (
                <div className="rounded-[10px] bg-white px-6 py-5 text-center font-apple text-sm text-gray-4">
                    {t('page.makeShift.constraints.empty')}
                </div>
            );
        }

        const keys = board[bucket];

        if (isCollapsed) return null;

        return (
            <Droppable droppableId={bucket} isDropDisabled={false} isCombineEnabled={false}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(bucket === 'excluded' && 'min-h-[10px]', snapshot.isDraggingOver && 'bg-[#f0ecff]')}
                    >
                        <div className="flex flex-col gap-3">
                            {keys.map((key, index) => {
                                const meta = DUTY_RULE_META[key];
                                const label = t(meta.labelKey);
                                const count = ruleViolationCount.get(`duty.${key}`) ?? 0;
                                const value =
                                    wardConstraint && meta.valueField ? (wardConstraint[meta.valueField] as unknown as number) : null;

                                return (
                                    <Draggable draggableId={key} index={index} key={key} isDragDisabled={false}>
                                        {(dragProvided, dragSnapshot) => (
                                            <div
                                                ref={dragProvided.innerRef}
                                                {...dragProvided.draggableProps}
                                                className={cn('flex items-center gap-5', dragSnapshot.isDragging && 'opacity-95')}
                                            >
                                                <div className="w-10 text-center font-apple text-[28px] text-gray-3">{index + 1}</div>
                                                <div className="flex h-[62px] flex-1 items-center rounded-[10px] bg-white px-5">
                                                    <button
                                                        type="button"
                                                        aria-label={t('page.makeShift.constraints.dragHandleAria')}
                                                        className="mr-4 cursor-grab active:cursor-grabbing"
                                                        {...dragProvided.dragHandleProps}
                                                    >
                                                        <SixDotsIcon className="h-6 w-6" />
                                                    </button>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-3">
                                                            <p className="truncate font-apple text-[20px] font-medium text-sub-1">
                                                                {label}
                                                            </p>
                                                            {count > 0 && (
                                                                <span className="rounded-full bg-main-light px-2 py-0.5 font-apple text-xs font-medium text-main-1">
                                                                    {t('page.makeShift.constraints.violationCount', {count})}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0">
                                                        {wardConstraint &&
                                                            renderRuleEditor(t, meta, value, (v) => {
                                                                updateRuleValue(meta, v);
                                                            })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Draggable>
                                );
                            })}
                            {provided.placeholder}
                        </div>
                    </div>
                )}
            </Droppable>
        );
    };
    const strongCount = board?.error.length ?? 0;
    const weakCount = board?.warning.length ?? 0;
    const excludedCount = board?.excluded.length ?? 0;
    const disabled = dutyValidationInput === null || board === null;

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="w-full">
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        className="flex items-center gap-2 font-apple text-[24px] font-bold text-sub-2 disabled:opacity-50"
                        onClick={() => setOpen((s) => ({...s, error: !s.error}))}
                        disabled={disabled}
                    >
                        {t('page.makeShift.constraints.section.strong')}
                        <ChevronDown className={cn('h-6 w-6 transition-transform', open.error ? 'rotate-180' : 'rotate-0')} />
                    </button>
                    <p className="font-apple text-[20px] font-medium text-gray-4">
                        {t('page.makeShift.constraints.count', {count: strongCount})}
                    </p>
                </div>

                {open.error && (
                    <div className="mt-4 rounded-[15px] bg-gray-7 p-[30px] pt-[20px]">
                        <div className="mb-[18px] flex items-center gap-2">
                            <InfoIcon className="h-6 w-6" />
                            <p className="font-apple text-base font-semibold text-main-1">{t('page.makeShift.constraints.info')}</p>
                        </div>
                        {renderBucket('error', !open.error)}
                    </div>
                )}

                <div className="mt-6 flex items-center justify-between">
                    <button
                        type="button"
                        className="flex items-center gap-2 font-apple text-[24px] font-bold text-sub-2 disabled:opacity-50"
                        onClick={() => setOpen((s) => ({...s, warning: !s.warning}))}
                        disabled={disabled}
                    >
                        {t('page.makeShift.constraints.section.weak')}
                        <ChevronDown className={cn('h-6 w-6 transition-transform', open.warning ? 'rotate-180' : 'rotate-0')} />
                    </button>
                    <p className="font-apple text-[20px] font-medium text-gray-4">
                        {t('page.makeShift.constraints.count', {count: weakCount})}
                    </p>
                </div>

                {open.warning && (
                    <div className="mt-4 rounded-[15px] bg-gray-7 p-[30px]">
                        <div className="mb-[18px] flex items-center gap-2">
                            <InfoIcon className="h-6 w-6" />
                            <p className="font-apple text-base font-semibold text-main-1">{t('page.makeShift.constraints.info')}</p>
                        </div>
                        {renderBucket('warning', !open.warning)}
                    </div>
                )}

                <div className="mt-8 flex items-center justify-between">
                    <p className="font-apple text-[24px] font-bold text-gray-4">{t('page.makeShift.constraints.section.excluded')}</p>
                    <p className="font-apple text-[20px] font-medium text-gray-4">
                        {t('page.makeShift.constraints.count', {count: excludedCount})}
                    </p>
                </div>

                <div className="mt-4 rounded-[15px] bg-gray-7 p-[30px]">{renderBucket('excluded', false)}</div>
            </div>
        </DragDropContext>
    );
}
