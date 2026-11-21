import {normalizeApiErrorResponse, resolveApiErrorMessage, type TApiClientError} from '@/shared/api/error';
import type {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {buildCreateWardPayload} from './adapter';
import type {TOnboardingWardDraft} from './draft';

type TTranslate = ReturnType<typeof useTypedTranslation>['t'];
type TSubmissionError = {message: string; step?: 1 | 4 | 5; teamId?: string; toastId?: string};

export function getOnboardingSubmissionError(error: unknown, draft: TOnboardingWardDraft, t: TTranslate): TSubmissionError {
    const apiError = error && typeof error === 'object' ? (error as Partial<TApiClientError>) : undefined;
    const response = normalizeApiErrorResponse(apiError?.responseBody);
    const fallback = t('page.onboardingWardCreate.toast.completeError');
    const toastId = typeof apiError?.toastId === 'string' ? apiError.toastId : undefined;

    if (!response) return {message: fallback, toastId};

    const payload = response.errors?.length ? buildCreateWardPayload(draft) : undefined;

    for (const error of response.errors ?? []) {
        const field = error.field ?? '';
        const shiftField = /^wardShiftTypes\[(\d+)]\.(name|shortName)$/.exec(field);
        const shift = shiftField && payload?.wardShiftTypes[Number(shiftField[1])];

        if (shift && shiftField) {
            const reason =
                shiftField[2] === 'name'
                    ? t(
                          shift.name.trim()
                              ? 'page.onboardingWardCreate.shiftType.validation.nameLength'
                              : 'page.onboardingWardCreate.shiftType.validation.nameRequired',
                      )
                    : t(
                          shift.shortName.trim()
                              ? 'page.onboardingWardCreate.shiftType.validation.shortNameLength'
                              : 'page.onboardingWardCreate.shiftType.validation.shortNameRequired',
                      );

            return {
                step: 4,
                toastId,
                message: t('page.onboardingWardCreate.shiftType.validation.shiftIssue', {
                    shift: `${shift.name} (${shift.shortName})`,
                    reason,
                }),
            };
        }

        if (field === 'name' || field === 'hospitalName') {
            return {step: 1, toastId, message: t('page.onboardingWardCreate.blocked.invalidWardIdentity')};
        }

        const nurseField = /^shiftTeams\[(\d+)]\.(?:nurses\[(\d+)]\.name|nurseNames\[(\d+)])(?:\.<list element>)?$/.exec(field);
        const teamIndex = nurseField ? Number(nurseField[1]) : -1;
        const nurseIndex = nurseField ? Number(nurseField[2] ?? nurseField[3]) : -1;
        const nurseName = payload?.shiftTeams[teamIndex]?.nurseNames[nurseIndex];

        if (nurseName) {
            return {
                step: 5,
                teamId: draft.teams[teamIndex]?.id,
                toastId,
                message: t('page.onboardingWardCreate.blocked.invalidNurseNameDetail', {
                    name: nurseName,
                    reason: t('page.onboardingWardCreate.blocked.invalidNurseName'),
                }),
            };
        }
    }

    return {message: resolveApiErrorMessage(response, fallback), toastId};
}
