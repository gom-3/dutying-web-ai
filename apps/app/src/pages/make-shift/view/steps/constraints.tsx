import {DragDropContext, type DropResult} from '@hello-pangea/dnd';
import {useMemo, useState} from 'react';
import {useShiftEditorCommands, useShiftEditorStore} from '@/features/shift-editor';
import {type TDutyRuleMeta} from '@/features/shift-editor/model/duty-constraints';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {ConstraintBucketList, ConstraintSection} from './constraints-sections';

type TBucket = 'error' | 'warning' | 'excluded';

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
    const strongCount = board?.error.length ?? 0;
    const weakCount = board?.warning.length ?? 0;
    const excludedCount = board?.excluded.length ?? 0;
    const disabled = dutyValidationInput === null || board === null;

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="w-full">
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
                    />
                </ConstraintSection>

                <div className="mt-6">
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
                        />
                    </ConstraintSection>
                </div>

                <div className="mt-8">
                    <ConstraintSection
                        title={t('page.makeShift.constraints.section.excluded')}
                        countLabel={t('page.makeShift.constraints.count', {count: excludedCount})}
                    >
                        <ConstraintBucketList
                            t={t}
                            bucket="excluded"
                            ruleKeys={board?.excluded ?? []}
                            ruleViolationCount={ruleViolationCount}
                            wardConstraint={wardConstraint}
                            onUpdateRuleValue={updateRuleValue}
                        />
                    </ConstraintSection>
                </div>
            </div>
        </DragDropContext>
    );
}
