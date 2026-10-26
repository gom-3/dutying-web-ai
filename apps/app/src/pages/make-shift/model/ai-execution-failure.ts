import type {TAutofillResponse} from '@dutying/api/ward';
import i18n from '@/i18n';
import {aiConversationFailure, type TAiConversationFailure} from './ai-conversation-failure';
import {readScheduleConflicts} from './schedule-conflicts';
import type {TConversationOperation} from './schedule-conversation-api';

export function conversationOperationFailure(operation: TConversationOperation): TAiConversationFailure | null {
    return (
        (operation.result ? aiExecutionFailure(operation.result) : null) ??
        (operation.executionStatus === 'FAILED'
            ? aiConversationFailure({serverCode: operation.failureReason ?? undefined}, i18n.t('aiAdjust.executionFailure.unknown'))
            : null)
    );
}

/** Recognize historical review results for display only; never authorizes applying cells. */
export function isGenerateReviewDraft(response: TAutofillResponse): boolean {
    return (
        response.operationType === 'GENERATE' &&
        response.applicable === true &&
        response.validationTarget === 'RESULT' &&
        ['REJECTED', 'ACCEPTED', 'REPAIRED'].includes(response.engineResult?.status ?? '') &&
        response.approvable === false &&
        response.engineResult?.candidateVisible === true &&
        response.engineResult?.reviewRequired === true &&
        response.changedCells.length > 0 &&
        response.changedCells.every((cell) => cell.wardShiftTypeId != null)
    );
}

/** Explain a rejected result without treating an unverified result as proven infeasibility. */
export function aiExecutionFailure(response: TAutofillResponse): TAiConversationFailure | null {
    const conflicts =
        response.engineResult?.status === 'INFEASIBLE' && response.applicable === false
            ? readScheduleConflicts(response.failure?.conflicts)
            : [];

    if (conflicts.length) {
        const first = conflicts[0];

        return {
            message: i18n.t('aiAdjust.executionFailure.propagatedCapacity', {
                date: first.date,
                required: first.required,
                available: first.available,
            }),
            blocked: false,
            conditionConflict: true,
            recovery: 'review',
            conflicts,
            sourceRevision: response.draftRevision,
            sourceRulesHash: response.validation?.rulesHash ?? undefined,
            ...(response.observation ? {observation: response.observation} : {}),
        };
    }

    if (
        response.confirmedConstraintException === true &&
        response.applicable === true &&
        response.approvable === true &&
        response.engineResult?.status === 'ACCEPTED' &&
        response.engineResult.reviewRequired !== true
    )
        return null;

    const capacityEvidence =
        response.conflictReview && Array.isArray(response.engineResult?.solver?.conflictEvidence)
            ? (response.engineResult.solver.conflictEvidence as Record<string, unknown>[])
            : response.engineResult?.violations;
    const monthlyCapacities = ['INFEASIBLE', 'CONFLICT_REVIEW'].includes(response.engineResult?.status ?? '')
        ? capacityEvidence?.filter(
              (issue) =>
                  issue != null &&
                  typeof issue === 'object' &&
                  issue.type === 'MONTHLY_STAFFING_CAPACITY_CONFLICT' &&
                  Array.isArray(issue.shiftCodes) &&
                  issue.shiftCodes.length > 0 &&
                  issue.shiftCodes.length <= 6 &&
                  issue.shiftCodes.every(
                      (code: unknown) =>
                          typeof code === 'string' &&
                          code.length > 0 &&
                          code.length <= 32 &&
                          [...code].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127),
                  ) &&
                  typeof issue.minimumAssignments === 'number' &&
                  Number.isInteger(issue.minimumAssignments) &&
                  issue.minimumAssignments <= 100000 &&
                  typeof issue.maximumAssignments === 'number' &&
                  Number.isInteger(issue.maximumAssignments) &&
                  issue.maximumAssignments >= 0 &&
                  issue.minimumAssignments > issue.maximumAssignments &&
                  issue.excessAssignments === issue.minimumAssignments - issue.maximumAssignments,
          )
        : [];
    const explanations = (monthlyCapacities ?? []).map((monthlyCapacity) =>
        i18n.t('aiAdjust.executionFailure.monthlyCapacity', {
            shifts: (monthlyCapacity.shiftCodes as string[]).join('·'),
            minimum: monthlyCapacity.minimumAssignments,
            maximum: monthlyCapacity.maximumAssignments,
            difference: monthlyCapacity.excessAssignments,
        }),
    );
    const validCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100000;
    const validDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

    if (['INFEASIBLE', 'CONFLICT_REVIEW'].includes(response.engineResult?.status ?? '')) {
        for (const issue of capacityEvidence ?? []) {
            const name =
                typeof issue.nurseName === 'string' && issue.nurseName.trim()
                    ? issue.nurseName.trim().slice(0, 80)
                    : i18n.t('aiAdjust.executionFailure.affectedNurse');

            if (
                issue.type === 'PERSONAL_MONTHLY_REST_CAPACITY_CONFLICT' &&
                validCount(issue.expected) &&
                validCount(issue.minimumAssignments) &&
                validCount(issue.maximumAssignments) &&
                issue.minimumAssignments <= issue.maximumAssignments &&
                (issue.expected < issue.minimumAssignments || issue.expected > issue.maximumAssignments) &&
                Array.isArray(issue.shiftCodes) &&
                issue.shiftCodes.length > 0 &&
                issue.shiftCodes.length <= 6 &&
                issue.shiftCodes.every(
                    (code: unknown) =>
                        typeof code === 'string' &&
                        code.length > 0 &&
                        code.length <= 32 &&
                        [...code].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127),
                )
            ) {
                explanations.push(
                    i18n.t('aiAdjust.executionFailure.personalRestEvidence', {
                        name,
                        shifts: issue.shiftCodes.join('·'),
                        target: issue.expected,
                        minimum: issue.minimumAssignments,
                        maximum: issue.maximumAssignments,
                    }),
                );
            }

            if (
                issue.type === 'WORK_REST_AVAILABILITY_CONFLICT' &&
                validCount(issue.forcedWorkDays) &&
                validCount(issue.maximum) &&
                issue.forcedWorkDays > issue.maximum &&
                validDate(issue.startDate) &&
                validDate(issue.endDate)
            ) {
                explanations.push(
                    i18n.t('aiAdjust.executionFailure.workRestEvidence', {
                        name,
                        start: issue.startDate,
                        end: issue.endDate,
                        days: issue.forcedWorkDays,
                        maximum: issue.maximum,
                    }),
                );
            }

            if (
                issue.type === 'MONTHLY_ASSIGNMENT_CAPACITY_CONFLICT' &&
                validCount(issue.minimumAssignments) &&
                validCount(issue.maximumAssignments) &&
                issue.minimumAssignments > issue.maximumAssignments
            ) {
                explanations.push(
                    i18n.t('aiAdjust.executionFailure.monthlyAssignmentEvidence', {
                        name,
                        minimum: issue.minimumAssignments,
                        maximum: issue.maximumAssignments,
                    }),
                );
            }

            if (
                issue.type === 'STAFF_COUNT_BOUNDS_CONFLICT' &&
                validDate(issue.date) &&
                typeof issue.shiftCode === 'string' &&
                issue.shiftCode.length <= 40 &&
                validCount(issue.minimum) &&
                validCount(issue.maximum) &&
                issue.minimum > issue.maximum
            ) {
                explanations.push(
                    i18n.t('aiAdjust.executionFailure.staffingConflict', {
                        date: issue.date,
                        shift: issue.shiftCode,
                        minimum: issue.minimum,
                        maximum: issue.maximum,
                    }),
                );
            }
        }
    }

    if (explanations.length) {
        const review = Boolean(response.conflictReview);

        return {
            message:
                [...new Set(explanations)].join('\n\n') +
                '\n\n' +
                i18n.t(review ? 'aiAdjust.executionFailure.monthlyCapacityReview' : 'aiAdjust.executionFailure.combinedConflictNext'),
            blocked: false,
            recovery: review ? 'review' : 'revise',
            ...(review ? {confirmationRequired: true} : {conditionConflict: true}),
            ...(response.observation ? {observation: response.observation} : {}),
        };
    }

    if (response.conflictReview)
        return {
            message: i18n.t('aiAdjust.executionFailure.conflictMessage'),
            blocked: false,
            recovery: 'review',
            confirmationRequired: true,
            ...(response.observation ? {observation: response.observation} : {}),
        };

    const status = response.engineResult?.status?.toUpperCase();
    const hardInvalid = (response.validation?.summary?.hardCount ?? 0) > 0;
    const reason = (
        response.failure?.reasonCode ??
        response.engineResult?.solver?.reason ??
        (response.engineResult?.reviewRequired === true || hardInvalid ? 'SPRING_HARD_VALIDATION' : '')
    ).toUpperCase();

    if (
        response.applicable !== false &&
        !hardInvalid &&
        response.engineResult?.reviewRequired !== true &&
        !['REJECTED', 'ERROR', 'INFEASIBLE', 'TIME_LIMIT'].includes(status ?? '') &&
        reason !== 'TIME_LIMIT_NO_SOLUTION'
    )
        return null;

    const staffingConflicts =
        status === 'INFEASIBLE'
            ? (response.engineResult?.violations ?? []).filter(
                  (issue) =>
                      issue.type === 'STAFF_COUNT_BOUNDS_CONFLICT' &&
                      typeof issue.date === 'string' &&
                      /^\d{4}-\d{2}-\d{2}$/.test(issue.date) &&
                      typeof issue.shiftCode === 'string' &&
                      issue.shiftCode.length > 0 &&
                      issue.shiftCode.length <= 40 &&
                      typeof issue.minimum === 'number' &&
                      Number.isInteger(issue.minimum) &&
                      typeof issue.maximum === 'number' &&
                      Number.isInteger(issue.maximum) &&
                      issue.maximum >= 0 &&
                      issue.minimum > issue.maximum,
              )
            : [];

    if (staffingConflicts.length) {
        const groups = new Map<string, {issue: Record<string, unknown>; dates: Set<string>}>();

        for (const issue of staffingConflicts) {
            const key = JSON.stringify([issue.shiftCode, issue.minimum, issue.maximum, issue.ruleIds ?? []]);
            const group = groups.get(key) ?? {issue, dates: new Set<string>()};

            group.dates.add(String(issue.date));
            groups.set(key, group);
        }

        return {
            ...(response.observation ? {observation: response.observation} : {}),
            message:
                [...groups.values()]
                    .map(({issue, dates}) =>
                        i18n.t('aiAdjust.executionFailure.staffingConflict', {
                            date: [...dates].sort().join(', '),
                            shift: issue.shiftCode,
                            minimum: issue.minimum,
                            maximum: issue.maximum,
                        }),
                    )
                    .join('\n') +
                '\n\n' +
                i18n.t('aiAdjust.executionFailure.staffingConflictNext'),
            blocked: false,
            recovery: 'revise',
            conditionConflict: true,
        };
    }

    if (reason === 'WORK_REST_AVAILABILITY_CONFLICT' && response.failure?.message?.trim()) {
        return {
            ...(response.observation ? {observation: response.observation} : {}),
            message: response.failure.message,
            blocked: false,
            recovery: 'revise',
        };
    }

    const solverReason = response.engineResult?.solver?.reason?.toUpperCase();

    if (
        reason === 'NURSE_OFF_NOT_ALLOWED' ||
        ['NURSE_HAS_NO_ASSIGNABLE_OFF', 'CONTRACT_NURSE_OFF_NOT_ALLOWED'].includes(solverReason ?? '')
    ) {
        const names =
            response.failure?.affectedNurses
                ?.map((nurse) => (typeof nurse.name === 'string' ? nurse.name.trim().slice(0, 80) : ''))
                .filter(Boolean) ?? [];
        const uniqueNames = [...new Set(names)];
        const displayNames =
            uniqueNames.slice(0, 3).join(', ') +
            (uniqueNames.length > 3 ? i18n.t('aiAdjust.executionFailure.moreNurses', {count: uniqueNames.length - 3}) : '');

        return {
            ...(response.observation ? {observation: response.observation} : {}),
            message: uniqueNames.length
                ? i18n.t('aiAdjust.executionFailure.offNotAllowedNamed', {names: displayNames})
                : i18n.t('aiAdjust.executionFailure.offNotAllowed'),
            blocked: false,
            recovery: 'settings',
        };
    }

    if (reason === 'MONTHLY_REST_TARGET_CONFLICT') {
        const validDays = (value: unknown): value is number =>
            typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 31;
        const details = (response.failure?.restTargetConflicts ?? []).flatMap((item) => {
            if (!item.name?.trim() || !validDays(item.minimum) || !validDays(item.fixedRestDays) || !validDays(item.availableRestDays))
                return [];

            const name = item.name.trim().slice(0, 80);

            if (validDays(item.maximum) && item.fixedRestDays > item.maximum)
                return [i18n.t('aiAdjust.executionFailure.restTargetExcess', {name, fixed: item.fixedRestDays, target: item.maximum})];

            if (item.minimum > item.availableRestDays)
                return [
                    i18n.t('aiAdjust.executionFailure.restTargetShortage', {name, available: item.availableRestDays, target: item.minimum}),
                ];

            return [];
        });

        return {
            ...(response.observation ? {observation: response.observation} : {}),
            message: i18n.t('aiAdjust.executionFailure.restTargetConflict', {details: details.join('\n')}),
            blocked: false,
            recovery: 'review',
        };
    }

    const diagnosis = response.failure?.diagnosis;
    const diagnosedNurse = response.failure?.affectedNurses?.find((nurse) => nurse.shiftNurseId === diagnosis?.shiftNurseId);

    if (
        status === 'INFEASIBLE' &&
        diagnosis?.status === 'VERIFIED_ALTERNATIVE' &&
        diagnosedNurse?.name?.trim() &&
        Number.isInteger(diagnosis.currentMax) &&
        Number.isInteger(diagnosis.proposedMax) &&
        diagnosis.currentMax >= 0 &&
        diagnosis.proposedMax > diagnosis.currentMax &&
        diagnosis.proposedMax <= 31
    ) {
        return {
            ...(response.observation ? {observation: response.observation} : {}),
            message: i18n.t('aiAdjust.executionFailure.verifiedNightCap', {
                name: diagnosedNurse.name.trim().slice(0, 80),
                current: diagnosis.currentMax,
                proposed: diagnosis.proposedMax,
            }),
            blocked: false,
            recovery: 'revise',
        };
    }

    let key:
        | 'connection'
        | 'busy'
        | 'response'
        | 'timeout'
        | 'infeasible'
        | 'unavailable'
        | 'validation'
        | 'incomplete'
        | 'rules'
        | 'resultCheck'
        | 'unsupported'
        | 'lockedEmpty'
        | 'input'
        | 'unknown' = 'unknown';
    let recovery: NonNullable<TAiConversationFailure['recovery']> = 'retry';

    if (reason === 'ENGINE_CONNECTION_FAILED') {
        key = 'connection';
    } else if (reason === 'ENGINE_BUSY') {
        key = 'busy';
    } else if (reason === 'ENGINE_TIMEOUT') {
        key = 'timeout';
    } else if (['ENGINE_INVALID_RESPONSE', 'ENGINE_RESPONSE_ERROR'].includes(reason)) {
        key = 'response';
    } else if (reason.includes('UNSUPPORTED')) {
        key = 'unsupported';
        recovery = 'revise';
    } else if (reason === 'CONTRACT_LOCKED_EMPTY_CELL') {
        key = 'lockedEmpty';
        recovery = 'review';
    } else if (/^(CONTRACT_|INVALID_|MISSING_)/.test(reason)) {
        key = 'input';
        recovery = 'review';
    } else if (['SOLVER_RESULT_FAILED_FINAL_GATE', 'SPRING_HARD_VALIDATION', 'SEMANTIC_RESULT_UNSATISFIED'].includes(reason)) {
        key = 'resultCheck';
    } else if (status === 'INFEASIBLE' || reason === 'HARD_RULE_CONFLICT') {
        key = 'infeasible';
        recovery = 'revise';
    } else if (status === 'TIME_LIMIT' || reason.includes('TIME_LIMIT')) {
        key = 'unavailable';
    } else if (reason === 'SOLVER_RESULT_VALIDATION_UNAVAILABLE') {
        key = 'validation';
    } else if (reason === 'SOLVER_RESULT_INCOMPLETE') {
        key = 'incomplete';
    }

    return {
        ...(response.observation ? {observation: response.observation} : {}),
        message: i18n.t(`aiAdjust.executionFailure.${key}`),
        blocked: false,
        recovery,
    };
}
