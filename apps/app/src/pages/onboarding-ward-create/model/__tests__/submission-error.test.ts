import {describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import {WEB_LANGUAGES} from '@/shared/i18n/locale';
import {buildCreateWardPayload} from '../adapter';
import {createInitialDraft} from '../draft';
import {getOnboardingSubmissionError} from '../submission-error';

const translate =
    (language: (typeof WEB_LANGUAGES)[number]): Parameters<typeof getOnboardingSubmissionError>[2] =>
    (key, values) =>
        String(i18n.getFixedT(language)(key, values));
const validationError = (field: string) => ({
    toastId: 'onboarding-validation',
    responseBody: {
        code: 'INVALID_TYPE_VALUE',
        messageKey: 'error.invalidTypeValue',
        displayPolicy: 'CLIENT_TRANSLATE',
        errors: [{field, messageKey: 'Size'}],
    },
});

describe('onboarding server validation feedback', () => {
    it.each(WEB_LANGUAGES)('identifies the rejected shift and its name limit in %s', (language) => {
        const initial = createInitialDraft();
        const draft = {...initial, hospitalName: '病院'};
        draft.shiftTypes[0] = {...draft.shiftTypes[0]!, name: 'Two-shift day'};

        const error = getOnboardingSubmissionError(validationError('wardShiftTypes[0].name'), draft, translate(language));

        expect(error).toMatchObject({step: 4, toastId: 'onboarding-validation'});
        expect(error.message).toContain('Two-shift day (D)');
        expect(error.message).toContain('12');
        expect(error.message).not.toContain('wardShiftTypes');
        if (language !== 'ko') expect(error.message).not.toMatch(/[가-힣]/);
    });

    it('resolves server indices against the serialized payload after unresolved rows are excluded', () => {
        const initial = createInitialDraft();
        const draft = {
            ...initial,
            hospitalName: '病院',
            shiftTypes: [
                {...initial.shiftTypes[0]!, id: 'unmapped', shortName: 'Q', mappingStatus: 'UNASSIGNED' as const},
                ...initial.shiftTypes,
            ],
        };
        expect(buildCreateWardPayload(draft).wardShiftTypes[0]!.shortName).toBe('D');

        const error = getOnboardingSubmissionError(validationError('wardShiftTypes[0].name'), draft, translate('ja'));
        expect(error.message).toContain('(D)');
        expect(error.message).not.toContain('(Q)');
    });

    it.each(['shiftTeams[0].nurses[0].name', 'shiftTeams[0].nurseNames[0].<list element>'])(
        'identifies the nurse without exposing API field syntax for %s',
        (field) => {
            const initial = createInitialDraft();
            const draft = {...initial, hospitalName: '病院'};
            draft.nurses[0] = {...draft.nurses[0]!, name: '𠮷野・花子'};

            const error = getOnboardingSubmissionError(validationError(field), draft, translate('ja'));

            expect(error).toMatchObject({step: 5, teamId: draft.teams[0]!.id, toastId: 'onboarding-validation'});
            expect(error.message).toContain('𠮷野・花子');
            expect(error.message).not.toMatch(/shiftTeams|[가-힣]/);
        },
    );

    it.each(['name', 'hospitalName'])('returns identity errors to the first step for %s', (field) => {
        const error = getOnboardingSubmissionError(validationError(field), createInitialDraft(), translate('ja'));

        expect(error.step).toBe(1);
        expect(error.message).toContain('50');
        expect(error.message).toContain('100');
    });

    it('preserves server-owned business messages and hides debug-only details', () => {
        const draft = createInitialDraft();
        expect(
            getOnboardingSubmissionError(
                {
                    responseBody: {
                        message: '病棟の設定を再読み込みしてください。',
                        displayPolicy: 'SERVER_TEXT',
                    },
                },
                draft,
                translate('ja'),
            ).message,
        ).toBe('病棟の設定を再読み込みしてください。');
        expect(
            getOnboardingSubmissionError(
                {
                    responseBody: {
                        message: 'private debug details',
                        displayPolicy: 'DEBUG_ONLY',
                    },
                },
                draft,
                translate('ja'),
            ).message,
        ).not.toContain('private debug details');
    });

    it('safely falls back for network failures and unknown validation fields', () => {
        const draft = createInitialDraft();
        expect(getOnboardingSubmissionError(new Error('network'), draft, translate('ja')).message).toBe(
            i18n.getFixedT('ja')('page.onboardingWardCreate.toast.completeError'),
        );
        expect(getOnboardingSubmissionError(validationError('wardShiftTypes[99999].name'), draft, translate('ja')).step).toBeUndefined();
        expect(() => getOnboardingSubmissionError({responseBody: {errors: {bad: true}}}, draft, translate('ja'))).not.toThrow();
    });
});
