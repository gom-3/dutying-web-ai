import type {TAutofillResponse} from '@dutying/api/ward';
import {useEffect, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TResultVersion} from '../../../model/schedule-conversation-api';
import {AiAuthoringCandidate} from './ai-authoring-candidate';

export function AiCandidateReview({
    result,
    currentVersionId,
    current,
    sourceChanged = false,
    disabled,
    loadVersion,
    nurseName,
    onApply,
    onKeep,
}: {
    result: TAutofillResponse;
    currentVersionId: string;
    current: boolean;
    sourceChanged?: boolean;
    disabled: boolean;
    loadVersion: (id: string) => Promise<TResultVersion>;
    nurseName: (id: number) => string;
    onApply: () => void;
    onKeep?: () => void;
}) {
    const {t} = useTypedTranslation();
    const sourceId = result.candidate?.sourceVersionId;
    const [source, setSource] = useState<{id: string; value: TResultVersion} | null>(null);
    const [failed, setFailed] = useState(false);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let active = true;

        setSource(null);
        setFailed(false);

        if (sourceId)
            void loadVersion(sourceId)
                .then((value) => {
                    if (active) {
                        if (value.versionId === sourceId) setSource({id: sourceId, value});
                        else setFailed(true);
                    }
                })
                .catch(() => {
                    if (active) setFailed(true);
                });

        return () => {
            active = false;
        };
    }, [sourceId, loadVersion, retry]);

    if (!sourceId || (!current && !sourceChanged)) return null;

    if (sourceChanged || sourceId !== currentVersionId)
        return (
            <p className="mt-3 text-sm" role="status">
                {t('aiConversationSidebar.authoring.candidateSourceChanged')}
            </p>
        );

    if (!Number.isFinite(Date.parse(result.candidate?.expiresAt ?? '')) || Date.parse(result.candidate?.expiresAt ?? '') <= Date.now())
        return (
            <p className="mt-3 text-sm" role="status">
                {t('aiConversationSidebar.authoring.candidateExpired')}
            </p>
        );

    if (source?.id !== sourceId)
        return (
            <div className="mt-3 text-sm" role="status">
                <p>
                    {t(
                        failed
                            ? 'aiConversationSidebar.authoring.candidateUnavailable'
                            : 'aiConversationSidebar.authoring.loadingComparison',
                    )}
                </p>
                {failed && (
                    <button
                        type="button"
                        className="min-h-11 rounded-lg px-3 py-2 text-main-1"
                        disabled={disabled}
                        onClick={() => setRetry((value) => value + 1)}
                    >
                        {t('aiConversationSidebar.checkOutcomeAgain')}
                    </button>
                )}
            </div>
        );

    return (
        <AiAuthoringCandidate
            result={result}
            sourceVersionId={currentVersionId}
            baseline={source.value.cells}
            current={current}
            disabled={disabled}
            nurseName={nurseName}
            onApply={onApply}
            onKeep={onKeep}
        />
    );
}
