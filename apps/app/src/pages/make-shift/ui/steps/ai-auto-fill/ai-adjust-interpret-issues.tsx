import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {hasNamedNurse, interpretIssueCode, readableIssueHint} from '../../../model/ai-interpret-issues';
import type {TAdjustCard} from './ai-adjust-interpret-card';

export function AiAdjustInterpretIssues({
    card,
    nurses,
    partial,
}: {
    card: TAdjustCard;
    nurses: {nurseId: number; name: string}[];
    partial: boolean;
}) {
    const {t} = useTypedTranslation();
    const issues = card.unmapped.length ? card.unmapped : [{text: card.requestText}];
    const messages = issues.map((issue) => {
        const code = interpretIssueCode(issue);
        const message =
            code === 'NURSE_NOT_RESOLVED'
                ? t(hasNamedNurse(card.requestText, nurses) ? 'aiAdjust.issue.nurseConnection' : 'aiAdjust.issue.nurse')
                : code === 'SHIFT_NOT_RESOLVED'
                  ? t('aiAdjust.issue.shift')
                  : code === 'INTERPRETATION_FAILED'
                    ? t('aiAdjust.issue.retry')
                    : code === 'UNSUPPORTED_REQUEST'
                      ? t('aiAdjust.issue.unsupported')
                      : (readableIssueHint(issue.hint) ??
                        t(
                            code === 'INVALID_DATE'
                                ? 'aiAdjust.issue.date'
                                : code === 'INVALID_VALUE'
                                  ? 'aiAdjust.issue.value'
                                  : 'aiAdjust.issue.clarify',
                        ));
        const text = partial ? issue.text.replace(/\s*\(기본값[^)]*\)/g, '').trim() : '';

        return {message, text: readableIssueHint(text) ?? ''};
    });
    const unique = messages.filter(
        (entry, index) => messages.findIndex((other) => other.message === entry.message && other.text === entry.text) === index,
    );

    return (
        <div className="min-w-0 space-y-3 [overflow-wrap:anywhere] break-keep">
            {partial && <p className="text-[13px] font-medium text-[#475467]">{t('aiAdjust.issue.excluded')}</p>}
            {unique.map(({message, text}, index) => (
                <div key={index} className="space-y-1">
                    {text && <p className="text-[13px] font-medium">{text}</p>}
                    <p className={`whitespace-pre-line ${partial ? 'text-[13px] text-[#475467]' : ''}`}>{message}</p>
                </div>
            ))}
        </div>
    );
}
