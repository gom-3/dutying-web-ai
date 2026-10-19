import {useId, useMemo, useRef, useState, type ReactNode} from 'react';
import type {TShift} from '@/entities/shift';
import type {TDutyDoc} from '@/features/shift-editor/model/types';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {localScheduleSnapshot} from '../../../model/local-schedule-snapshot';
import {AiConversationImage} from './ai-conversation-image';
import {AiScheduleResultCard} from './ai-schedule-result-card';
import {AiScheduleSnapshotViewer, type TScheduleSnapshot} from './ai-schedule-snapshot-viewer';

const capturedSnapshot = (snapshot: TScheduleSnapshot) => snapshot;

/** Captured data only: opening a result never reads or writes the live editor. */
export function AiResultSnapshot({
    doc,
    shift,
    before,
    beforeShift,
    title,
    reviewRequired = false,
    description,
    attempt,
    changedCount,
    outcome,
    headerAction,
    actions,
    children,
}: {
    doc: TDutyDoc;
    shift?: TShift;
    before?: TDutyDoc;
    beforeShift?: TShift;
    title?: string;
    reviewRequired?: boolean;
    description?: ReactNode;
    attempt?: number;
    changedCount?: number;
    outcome?: 'success' | 'review' | 'neutral';
    headerAction?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const id = useId();
    const trigger = useRef<HTMLButtonElement | null>(null);
    const {t} = useTypedTranslation();
    const snapshot = useMemo(() => localScheduleSnapshot(doc, shift), [doc, shift]);
    const comparisonBefore = useMemo(() => (before ? localScheduleSnapshot(before, beforeShift) : undefined), [before, beforeShift]);
    const [year, month] = doc.columns[0]?.split('-').map(Number) ?? [];
    const resultOutcome = outcome ?? (reviewRequired ? 'review' : 'success');
    const preview = (
        <AiConversationImage
            cacheKey={`local-result:${id}`}
            versionId="captured"
            snapshot={snapshot}
            onOpen={(control) => {
                trigger.current = control;
                setOpen(true);
            }}
        />
    );

    return (
        <>
            {title ? (
                <AiScheduleResultCard
                    title={title}
                    attempt={attempt}
                    outcome={resultOutcome}
                    outcomeLabel={t(resultOutcome === 'review' ? 'aiAdjust.snapshot.review' : 'aiAdjust.snapshot.success')}
                    description={description}
                    changedCount={changedCount}
                    headerAction={headerAction}
                    preview={preview}
                    actions={actions}
                >
                    {children}
                </AiScheduleResultCard>
            ) : (
                preview
            )}
            {open && (
                <AiScheduleSnapshotViewer
                    after={snapshot}
                    before={comparisonBefore}
                    toSnapshot={capturedSnapshot}
                    year={year}
                    month={month}
                    returnFocusTo={trigger.current}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}
