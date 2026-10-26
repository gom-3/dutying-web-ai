import type {TResolvedRestConflict} from '@/features/personal-rest-policy/rest-conflict';
import i18n from '@/i18n';
import type {TAiConversationFailure} from './ai-conversation-failure';

export type {TResolvedRestConflict} from '@/features/personal-rest-policy/rest-conflict';

/** Only evidence tied to an unambiguous nurse in the current roster opens an editor. */
export function resolveRestConflicts(
    failure: TAiConversationFailure | null | undefined,
    nurses: {nurseId: number; name: string}[],
): TResolvedRestConflict[] {
    const resolved = new Map<number, TResolvedRestConflict>();

    if (failure?.blocked || failure?.settingsTarget !== 'rest' || !Array.isArray(failure.restConflicts)) return [];

    for (const conflict of failure.restConflicts) {
        if (
            !conflict ||
            ![conflict.expected, conflict.minimumAssignments, conflict.maximumAssignments].every(
                (value) => Number.isInteger(value) && value >= 0 && value <= 31,
            ) ||
            conflict.minimumAssignments > conflict.maximumAssignments ||
            (conflict.expected >= conflict.minimumAssignments && conflict.expected <= conflict.maximumAssignments) ||
            !Array.isArray(conflict.shiftCodes) ||
            conflict.shiftCodes.length === 0 ||
            conflict.shiftCodes.length > 6 ||
            !conflict.shiftCodes.every(
                (code) =>
                    typeof code === 'string' &&
                    code.length > 0 &&
                    code.length <= 32 &&
                    [...code].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127),
            )
        )
            continue;

        const matches = nurses.filter((nurse) =>
            conflict.nurseId != null ? nurse.nurseId === conflict.nurseId : nurse.name === conflict.nurseName,
        );

        if (matches.length !== 1) continue;

        const nurse = matches[0];
        const current = resolved.get(nurse.nurseId) ?? {...nurse, explanations: []};
        const explanation = i18n.t('aiAdjust.executionFailure.personalRestEvidence', {
            name: nurse.name,
            shifts: conflict.shiftCodes.join('·'),
            target: conflict.expected,
            minimum: conflict.minimumAssignments,
            maximum: conflict.maximumAssignments,
        });

        if (!current.explanations.includes(explanation)) current.explanations.push(explanation);

        resolved.set(nurse.nurseId, current);
    }

    return [...resolved.values()];
}
