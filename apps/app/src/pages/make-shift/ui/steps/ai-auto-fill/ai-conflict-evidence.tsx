import type {TScheduleConflict} from '@dutying/api/ward';
import {useShiftEditorStore} from '@/features/shift-editor/model/store';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TAiConversationFailure} from '../../../model/ai-conversation-failure';
import {conflictCellPosition} from '../../../model/schedule-conflicts';

/** Inspect only: existing table commands remain the sole path to manual edits. */
export function AiConflictEvidence({
    failure,
    active,
    disabled,
    onInspect,
}: {
    failure: TAiConversationFailure;
    active: boolean;
    disabled: boolean;
    onInspect?: () => void;
}) {
    const {t} = useTypedTranslation();
    const doc = useShiftEditorStore((state) => state.doc);
    const revision = useShiftEditorStore((state) => state.draftRevision);
    const rulesHash = useShiftEditorStore((state) => state.rulesHash);
    const current = revision === failure.sourceRevision && (!failure.sourceRulesHash || failure.sourceRulesHash === rulesHash);
    const actionClass =
        'min-h-[44px] rounded-lg px-2 py-2 text-left text-main-1 underline underline-offset-2 hover:bg-main-light focus-visible:outline-2 focus-visible:outline-offset-2 disabled:text-sub-3 disabled:no-underline';

    function inspect(nurse: number, day: string, code?: string) {
        const state = useShiftEditorStore.getState();
        const position = conflictCellPosition(state.doc, nurse, day, code);

        if (
            !active ||
            disabled ||
            !current ||
            state.draftRevision !== failure.sourceRevision ||
            (failure.sourceRulesHash && failure.sourceRulesHash !== state.rulesHash) ||
            !position
        )
            return;

        state.setSelection({type: 'single', anchor: position});
        onInspect?.();
        requestAnimationFrame(() => {
            const target = document.getElementById(`schedule-cell-${nurse}-${day}`);

            target?.scrollIntoView?.({block: 'center', inline: 'center', behavior: 'instant'});
            target?.focus({preventScroll: true});
        });
    }

    function assignment(cell: TScheduleConflict['fixedAssignments'][number]) {
        const previous = !doc.columns.includes(cell.date);
        const position = conflictCellPosition(doc, cell.shiftNurseId, cell.date, cell.shiftCode);

        return (
            <li
                key={`${cell.shiftNurseId}:${cell.date}`}
                className="flex flex-wrap items-center justify-between gap-x-2 border-b border-sub-4 py-1 last:border-0"
            >
                <span>
                    {cell.date} · {cell.name} · {cell.shiftCode}
                    {cell.readOnly
                        ? ` · ${t(previous ? 'aiAdjust.executionFailure.priorReadOnly' : 'aiAdjust.executionFailure.acceptedReadOnly')}`
                        : ''}
                </span>
                {!previous && (
                    <button
                        type="button"
                        className={actionClass}
                        disabled={!active || disabled || !current || !position}
                        onClick={() => inspect(cell.shiftNurseId, cell.date, cell.shiftCode)}
                    >
                        {t('aiAdjust.executionFailure.inspectCell')}
                    </button>
                )}
            </li>
        );
    }

    return (
        <div className="space-y-4 text-[13px] leading-6">
            {!current && <p role="status">{t('aiAdjust.executionFailure.conflictStale')}</p>}
            {failure.conflicts?.map((conflict, index) => (
                <section key={`${conflict.date}:${index}`} aria-label={t('aiAdjust.executionFailure.conflictDate', {date: conflict.date})}>
                    <h4 className="font-semibold">{t('aiAdjust.executionFailure.conflictDate', {date: conflict.date})}</h4>
                    <p>
                        {t('aiAdjust.executionFailure.conflictCounts', {
                            shifts: conflict.shiftCodes.join('·'),
                            required: conflict.required,
                            available: conflict.available,
                        })}
                    </p>
                    <ul className="mt-2 space-y-1">
                        {conflict.nurses.map((nurse) => (
                            <li key={nurse.shiftNurseId}>
                                <button
                                    type="button"
                                    className={actionClass}
                                    disabled={
                                        !active || disabled || !current || !conflictCellPosition(doc, nurse.shiftNurseId, conflict.date)
                                    }
                                    onClick={() => inspect(nurse.shiftNurseId, conflict.date)}
                                >
                                    {nurse.name} ·{' '}
                                    {t(`aiAdjust.executionFailure.conflictReason${nurse.reason}`, {count: nurse.maximumWorkDays ?? 0})}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {!!conflict.fixedAssignments.length && (
                        <details className="mt-2 rounded-lg border border-sub-4 px-3 py-2" open>
                            <summary className="cursor-pointer font-medium focus-visible:outline-2">
                                {t('aiAdjust.executionFailure.fixedEvidence')}
                            </summary>
                            <ul className="mt-2">{conflict.fixedAssignments.map(assignment)}</ul>
                        </details>
                    )}
                </section>
            ))}
            <p>{t('aiAdjust.executionFailure.conflictEditHelp')}</p>
        </div>
    );
}
