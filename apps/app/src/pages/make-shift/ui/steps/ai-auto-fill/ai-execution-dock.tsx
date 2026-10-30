import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {conversationOperationStatusKey} from './ai-conversation-operation-status';
import type {TConversationExecution} from './ai-conversation-sidebar';
import {AiExecutionCancelButton} from './ai-execution-cancel-button';

/** A reachable entry to the same operation, including its terminal result, after hiding the loader. */
export function AiExecutionDock({
    execution,
    onOpen,
    isAdjusting = false,
}: {
    execution: TConversationExecution | null;
    onOpen: () => void;
    isAdjusting?: boolean;
}) {
    const {t} = useTypedTranslation();
    const {operation, cancel, cancelling} = execution ?? {};
    const pending = !operation || ['RUNNING', 'RESULT_READY', 'UNKNOWN'].includes(operation.executionStatus);
    const label = !operation
        ? t('aiAutofillUi.executionPresentation.submitting')
        : operation.executionStatus === 'SUCCEEDED'
          ? operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED'
              ? t('aiAutofillUi.executionPresentation.sourceChanged')
              : t(
                    operation.operationType === 'ADJUST'
                        ? 'aiAutofillUi.executionPresentation.adjustmentResultReady'
                        : 'aiAutofillUi.executionPresentation.resultReady',
                )
          : operation.executionStatus === 'FAILED'
            ? t(
                  operation.operationType === 'ADJUST'
                      ? 'aiAutofillUi.executionPresentation.adjustmentFailed'
                      : 'aiAutofillUi.executionPresentation.failed',
              )
            : t(`aiAutofillUi.conversationOperationStatus.${conversationOperationStatusKey(operation)}`);

    return (
        <section
            aria-label={t(
                operation?.operationType === 'ADJUST' || (!operation && isAdjusting)
                    ? 'aiAutofillUi.executionPresentation.adjustmentTaskLabel'
                    : 'aiAutofillUi.executionPresentation.taskLabel',
            )}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-gray-6 py-3"
        >
            <div className="min-w-0 text-sm text-sub-1">
                <p role="status" className="font-medium">
                    {label}
                </p>
                {pending && operation?.progress && (
                    <p aria-hidden="true" className="mt-1 text-xs text-gray-3 tabular-nums">
                        {t('aiAutofillUi.conversationOperationStatus.elapsed', {seconds: Math.floor(operation.progress.elapsedMs / 1000)})}
                    </p>
                )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
                <button
                    type="button"
                    onClick={onOpen}
                    className="min-h-11 rounded-lg px-3 text-sm font-medium text-main-1 hover:bg-main-light focus-visible:outline-2 focus-visible:outline-main-1"
                >
                    {t(pending ? 'aiAutofillUi.executionPresentation.viewProgress' : 'aiAutofillUi.executionPresentation.viewResult')}
                </button>
                {cancel && <AiExecutionCancelButton onCancel={cancel} disabled={cancelling} />}
            </div>
        </section>
    );
}
