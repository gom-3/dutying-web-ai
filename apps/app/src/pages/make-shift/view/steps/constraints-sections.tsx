import {cn} from '@dutying/utils/style';
import {Draggable, Droppable} from '@hello-pangea/dnd';
import {ChevronDown} from 'lucide-react';
import {type ReactNode} from 'react';
import {type TDutyRuleMeta, DUTY_RULE_META} from '@/features/shift-editor/model/duty-constraints';
import {type TDutyRuleKey} from '@/features/shift-editor/model/types';
import {InfoIcon, SixDotsIcon} from '@/shared/assets/svg';
import {type useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Select from '@/shared/ui/form-controls/Select';

type TBucket = 'error' | 'warning' | 'excluded';
type TTypedT = ReturnType<typeof useTypedTranslation>['t'];

type TConstraintSectionProps = {
    title: string;
    countLabel: string;
    isOpen?: boolean;
    onToggle?: () => void;
    disabled?: boolean;
    infoLabel?: string;
    children: ReactNode;
};

export function ConstraintSection({title, countLabel, isOpen, onToggle, disabled = false, infoLabel, children}: TConstraintSectionProps) {
    const collapsible = typeof isOpen === 'boolean' && onToggle;

    return (
        <>
            <div className="flex items-center justify-between">
                {collapsible ? (
                    <button
                        type="button"
                        className="flex items-center gap-2 font-apple text-[24px] font-bold text-sub-2 disabled:opacity-50"
                        onClick={onToggle}
                        disabled={disabled}
                    >
                        {title}
                        <ChevronDown className={cn('h-6 w-6 transition-transform', isOpen ? 'rotate-180' : 'rotate-0')} />
                    </button>
                ) : (
                    <p className="font-apple text-[24px] font-bold text-gray-4">{title}</p>
                )}
                <p className="font-apple text-[20px] font-medium text-gray-4">{countLabel}</p>
            </div>

            {collapsible && !isOpen ? null : (
                <div className="mt-4 rounded-[15px] bg-gray-7 p-[30px]">
                    {infoLabel ? (
                        <div className="mb-[18px] flex items-center gap-2">
                            <InfoIcon className="h-6 w-6" />
                            <p className="font-apple text-base font-semibold text-main-1">{infoLabel}</p>
                        </div>
                    ) : null}
                    {children}
                </div>
            )}
        </>
    );
}

export function renderRuleEditor(t: TTypedT, meta: TDutyRuleMeta, value: number | null, onChange: (next: number) => void) {
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

type TConstraintBucketListProps = {
    t: TTypedT;
    bucket: TBucket;
    ruleKeys: TDutyRuleKey[];
    ruleViolationCount: Map<string, number>;
    wardConstraint: Record<string, unknown> | null;
    onUpdateRuleValue: (meta: TDutyRuleMeta, nextValue: number) => void;
};

export function ConstraintBucketList({
    t,
    bucket,
    ruleKeys,
    ruleViolationCount,
    wardConstraint,
    onUpdateRuleValue,
}: TConstraintBucketListProps) {
    if (ruleKeys.length === 0) {
        return (
            <div className="rounded-[10px] bg-white px-6 py-5 text-center font-apple text-sm text-gray-4">
                {t('page.makeShift.constraints.empty')}
            </div>
        );
    }

    return (
        <Droppable droppableId={bucket}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(bucket === 'excluded' && 'min-h-[10px]', snapshot.isDraggingOver && 'bg-[#f0ecff]')}
                >
                    <div className="flex flex-col gap-3">
                        {ruleKeys.map((key, index) => {
                            const meta = DUTY_RULE_META[key];
                            const label = t(meta.labelKey);
                            const count = ruleViolationCount.get(`duty.${key}`) ?? 0;
                            const value = wardConstraint && meta.valueField ? (wardConstraint[meta.valueField] as number) : null;

                            return (
                                <Draggable draggableId={key} index={index} key={key}>
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
                                                        <p className="truncate font-apple text-[20px] font-medium text-sub-1">{label}</p>
                                                        {count > 0 ? (
                                                            <span className="rounded-full bg-main-light px-2 py-0.5 font-apple text-xs font-medium text-main-1">
                                                                {t('page.makeShift.constraints.violationCount', {count})}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div className="shrink-0">
                                                    {wardConstraint
                                                        ? renderRuleEditor(t, meta, value, (nextValue) =>
                                                              onUpdateRuleValue(meta, nextValue),
                                                          )
                                                        : null}
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
}
