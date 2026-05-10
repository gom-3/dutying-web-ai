import {DragDropContext, type DropResult} from '@hello-pangea/dnd';
import {useMemo, useState} from 'react';
import {useShiftEditorCommands, useShiftEditorStore} from '@/features/shift-editor';
import {type TDutyRuleMeta} from '@/features/shift-editor/model/duty-constraints';
import {type TDutyRuleKey} from '@/features/shift-editor/model/types';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {ConstraintBucketList, ConstraintSection} from './constraints-sections';

type TDragBucket = 'error' | 'warning';

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

        const fromBucket = result.source.droppableId as TDragBucket;
        const toBucket = result.destination.droppableId as TDragBucket;
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
    const excludeRule = (bucket: TDragBucket, ruleKey: TDutyRuleKey) => {
        if (!board) return;

        const inBucket = board[bucket].includes(ruleKey);

        if (!inBucket) return;

        const next = {
            error: bucket === 'error' ? board.error.filter((k) => k !== ruleKey) : board.error.slice(),
            warning: bucket === 'warning' ? board.warning.filter((k) => k !== ruleKey) : board.warning.slice(),
            excluded: board.excluded.includes(ruleKey) ? board.excluded.slice() : [...board.excluded, ruleKey],
        };

        editor.setDutyRuleBoard(next);
    };
    const strongCount = board?.error.length ?? 0;
    const weakCount = board?.warning.length ?? 0;
    const disabled = dutyValidationInput === null || board === null;

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div id="make_constraints_step" className="make-shift-constraints w-full">
                <ConstraintSection
                    title={t('page.makeShift.constraints.section.strong')}
                    countLabel={t('page.makeShift.constraints.count', {count: strongCount})}
                    isOpen={open.error}
                    onToggle={() => setOpen((state) => ({...state, error: !state.error}))}
                    disabled={disabled}
                    infoLabel={t('page.makeShift.constraints.info')}
                >
                    <ConstraintBucketList
                        t={t}
                        bucket="error"
                        ruleKeys={board?.error ?? []}
                        ruleViolationCount={ruleViolationCount}
                        wardConstraint={wardConstraint}
                        onUpdateRuleValue={updateRuleValue}
                        onExcludeRule={(key) => excludeRule('error', key)}
                        disabled={disabled}
                    />
                </ConstraintSection>

                <div className="make-shift-constraints__section-spacer mt-[clamp(14px,1.6vw,24px)]">
                    <ConstraintSection
                        title={t('page.makeShift.constraints.section.weak')}
                        countLabel={t('page.makeShift.constraints.count', {count: weakCount})}
                        isOpen={open.warning}
                        onToggle={() => setOpen((state) => ({...state, warning: !state.warning}))}
                        disabled={disabled}
                        infoLabel={t('page.makeShift.constraints.info')}
                    >
                        <ConstraintBucketList
                            t={t}
                            bucket="warning"
                            ruleKeys={board?.warning ?? []}
                            ruleViolationCount={ruleViolationCount}
                            wardConstraint={wardConstraint}
                            onUpdateRuleValue={updateRuleValue}
                            onExcludeRule={(key) => excludeRule('warning', key)}
                            disabled={disabled}
                        />
                    </ConstraintSection>
                </div>
            </div>
        </DragDropContext>
    );
}
