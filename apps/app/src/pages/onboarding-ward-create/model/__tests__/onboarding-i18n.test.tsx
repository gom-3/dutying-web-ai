import {render, screen, cleanup} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {registerWardSchema} from '@/features/register-ward/model/schema';
import {createDefaultWardShiftTypes} from '@/features/register-ward/model/ward';
import i18n from '@/i18n';
import {resources} from '@/shared/i18n/resources.generated';
import {ShiftTypeStep} from '../../ui/steps/shift-type-step';
import {
    createInitialDraft,
    DEFAULT_ONBOARDING_DRAFT_LABELS,
    type TOnboardingDraftLabels,
    updateRotationModeDraft,
    updateShiftTypeDraft,
    updateTwoShiftNightRecoveryDisplayDraft,
} from '../draft';
import {localizeOnboardingShiftNames} from '../shift-type-labels';

const languages = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'th', 'vi'] as const;
const labelsFor = (language: (typeof languages)[number]): TOnboardingDraftLabels => {
    const {translation} = resources[language];
    const {defaults} = translation.page.onboardingWardCreate;

    return {
        ...DEFAULT_ONBOARDING_DRAFT_LABELS,
        shiftNames: {
            ...translation.feature.registerWard.defaultShiftType,
            annualLeave: defaults.annualLeave,
            twoDay: defaults.twoDay,
            twoNight: defaults.twoNight,
            twoNightContinuation: defaults.twoNightContinuation,
        },
    };
};
const leaves = (value: unknown, prefix = ''): Record<string, string> => {
    if (typeof value === 'string') return {[prefix]: value};

    if (!value || typeof value !== 'object') return {};

    return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => Object.entries(leaves(child, `${prefix}.${key}`))));
};
const placeholders = (value: string) => Array.from(new Set([...value.matchAll(/{{\s*([^}]+?)\s*}}/g)].map((match) => match[1]))).sort();

describe('onboarding internationalization', () => {
    afterEach(async () => {
        cleanup();
        await i18n.changeLanguage('ko');
    });

    it.each(languages)('provides all onboarding and group messages in %s with consistent interpolation', (language) => {
        const source = resources.ko.translation;
        const translated = resources[language].translation;
        const scopes = (copy: typeof source) => ({
            onboarding: copy.page.onboardingWardCreate,
            joinWard: copy.page.onboardingJoinWard,
            register: copy.page.register,
            registerWard: copy.feature.registerWard,
            login: copy.page.login,
            groups: copy.shared.division,
            phone: copy.shared.contactPhone,
        });
        const original = leaves(scopes(source));
        const messages = leaves(scopes(translated));

        expect(Object.keys(messages)).toEqual(Object.keys(original));

        for (const [key, message] of Object.entries(messages)) {
            expect(placeholders(message), key).toEqual(placeholders(original[key]!));

            if (original[key]?.trim()) expect(message.trim(), key).not.toBe('');

            // This key is a backend compatibility token, never display copy.
            if (language !== 'ko' && key !== '.login.feedback.legacyInvalidCredentialsServerText') {
                expect(message, key).not.toMatch(/[가-힣]/);
            }
        }

        if (language !== 'ko' && language !== 'en') {
            const shiftType = translated.page.onboardingWardCreate.shiftType;
            const english = resources.en.translation.page.onboardingWardCreate.shiftType;

            for (const key of [
                'rotation',
                'rotationAria',
                'rotationThree',
                'rotationTwo',
                'rotationNone',
                'twoDayLabel',
                'twoNightLabel',
            ] as const) {
                expect(shiftType[key], key).not.toBe(english[key]);
            }
        }
    });

    it.each(languages)('keeps default shift names within the 12-character API limit in %s', (language) => {
        const labels = labelsFor(language);
        const initial = createInitialDraft(labels);
        const mixed = updateRotationModeDraft(initial, 'MIXED', labels);
        const two = updateTwoShiftNightRecoveryDisplayDraft(updateRotationModeDraft(initial, 'TWO', labels), 'NIGHT_CONTINUATION', labels);

        for (const draft of [initial, mixed, two]) {
            for (const shiftType of draft.shiftTypes) {
                expect(shiftType.name.length, `${language}: ${shiftType.name}`).toBeLessThanOrEqual(12);
                expect(shiftType.name.trim()).not.toBe('');
            }
        }
    });

    it.each(languages)('localizes annual leave in the alternate registration form in %s', (language) => {
        const t: Parameters<typeof createDefaultWardShiftTypes>[0] = (key, values) => String(i18n.getFixedT(language)(key, values));
        const annualLeave = createDefaultWardShiftTypes(t).find((shift) => shift.classification === 'ANNUAL_LEAVE');

        expect(annualLeave?.name).toBe(resources[language].translation.page.onboardingWardCreate.defaults.annualLeave);
    });

    it.each(['ศิริราช', 'Bệnh viện Chợ Rẫy', "St. Mary's", '𠮷田記念病院'])(
        'accepts the international name %s in the alternate ward registration form',
        async (hospitalName) => {
            expect(await registerWardSchema.isValid({hospitalName, name: 'ICU-1'})).toBe(true);
        },
    );

    it.each(languages)('renders the mixed-rotation settings and default names in %s', async (language) => {
        await i18n.changeLanguage(language);

        const labels = labelsFor(language);
        const draft = updateRotationModeDraft(createInitialDraft(labels), 'MIXED', labels);
        const copy = resources[language].translation.page.onboardingWardCreate.shiftType;

        render(
            <ShiftTypeStep
                shiftTypes={draft.shiftTypes}
                rotationMode="MIXED"
                onChange={vi.fn()}
                onDragEnd={vi.fn()}
                onAdd={vi.fn()}
                onDelete={vi.fn()}
            />,
        );

        expect(screen.getAllByText(copy.rotation).length).toBeGreaterThan(0);
        expect(screen.getAllByText(copy.rotationThree).length).toBeGreaterThan(0);
        expect(screen.getAllByText(copy.rotationTwo).length).toBeGreaterThan(0);
        expect(screen.getAllByText(copy.rotationNone).length).toBeGreaterThan(0);
        expect(screen.getByDisplayValue(labels.shiftNames.twoDay)).toBeInTheDocument();
        expect(screen.getByDisplayValue(labels.shiftNames.twoNight)).toBeInTheDocument();
    });

    it('repairs saved English fallback names and updates automatic names when the language changes, preserving edits and imported names', () => {
        const english = labelsFor('en');
        const japanese = labelsFor('ja');

        let draft = updateRotationModeDraft(createInitialDraft(english), 'MIXED', english);

        draft = {
            ...draft,
            shiftTypes: draft.shiftTypes.map((shiftType) =>
                shiftType.id === 'shift-two-day' ? {...shiftType, name: 'Two-shift day'} : shiftType,
            ),
        };
        draft = updateShiftTypeDraft(draft, 'shift-two-night', {name: 'Custom night'});

        const imported = {...draft.shiftTypes[0]!, id: 'imported', source: 'schedule-input' as const, name: 'Day'};

        draft = {...draft, shiftTypes: [...draft.shiftTypes, imported]};

        const localized = localizeOnboardingShiftNames(draft, japanese);

        expect(localized.shiftTypes.find((shiftType) => shiftType.id === 'shift-two-day')?.name).toBe('2交代・日勤');
        expect(localized.shiftTypes.find((shiftType) => shiftType.id === 'shift-two-night')?.name).toBe('Custom night');
        expect(localized.shiftTypes.find((shiftType) => shiftType.id === 'imported')).toBe(imported);
        expect(localized.shiftTypes[0]!.name).toBe('日勤');
        expect(localizeOnboardingShiftNames(localized, japanese)).toBe(localized);
        expect(localizeOnboardingShiftNames(localized, english).shiftTypes[0]!.name).toBe('Day');
    });

    it('repairs overlong legacy defaults after time and color edits without discarding those edits', () => {
        const english = labelsFor('en');
        const japanese = labelsFor('ja');
        const mixed = updateRotationModeDraft(createInitialDraft(english), 'MIXED', english);
        const legacy = {
            ...mixed,
            shiftTypes: mixed.shiftTypes.map((shift) =>
                shift.id === 'shift-two-day'
                    ? {...shift, name: 'Two-shift day'}
                    : shift.id === 'shift-two-night'
                      ? {...shift, name: 'Two-shift night'}
                      : shift,
            ),
        };
        const edited = updateShiftTypeDraft(updateShiftTypeDraft(legacy, 'shift-two-day', {startTime: '09:15'}), 'shift-two-night', {
            color: '#123456',
        });

        const restored = localizeOnboardingShiftNames(edited, japanese);

        expect(restored.shiftTypes.find((shift) => shift.id === 'shift-two-day')).toMatchObject({
            name: japanese.shiftNames.twoDay,
            startTime: '09:15',
            autoSeeded: false,
        });
        expect(restored.shiftTypes.find((shift) => shift.id === 'shift-two-night')).toMatchObject({
            name: japanese.shiftNames.twoNight,
            color: '#123456',
            autoSeeded: false,
        });
    });
});
