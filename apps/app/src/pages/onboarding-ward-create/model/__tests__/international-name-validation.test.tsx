import {cleanup, fireEvent, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {registerWardSchema} from '@/features/register-ward/model/schema';
import i18n from '@/i18n';
import {WEB_LANGUAGES, type TWebLanguage} from '@/shared/i18n/locale';
import {isValidAccountName} from '@/shared/lib/account-name';
import {isValidOnboardingNurseName, normalizeRosterNurseNameForRequest} from '@/shared/lib/nurse-name';
import {render} from '@/shared/util/test-utils';
import WardIdentityStep from '../../ui/steps/ward-identity-step';
import {buildCreateWardPayload} from '../adapter';
import {
    canComplete,
    createInitialDraft,
    getStepValidation,
    updateRotationModeDraft,
    updateTwoShiftNightRecoveryDisplayDraft,
    type TOnboardingDraftLabels,
} from '../draft';
import {localizeOnboardingShiftNames} from '../shift-type-labels';
import {createOnboardingWardCreateExecutor} from '../submission';
import {buildOnboardingWardIdentityPayload} from '../ward-identity';

vi.mock('../use-hospital-search', () => ({useHospitalSearch: () => ({results: [], isLoading: false, hasError: false})}));

const examples = [
    {language: 'ko', region: 'KR', hospital: '서울성모병원（본관）', ward: '내과·외과 3병동', nurse: '김 민서'},
    {language: 'ja', region: 'JP', hospital: '𠮷野・髙橋病院（本院）', ward: '第１病棟／東館', nurse: '佐々木・𠮷野'},
    {
        language: 'en',
        region: 'EN',
        hospital: "St. Mary's University Hospital",
        ward: 'Intensive Care Unit (West)',
        nurse: 'Anne-Marie O’Neill',
    },
    {language: 'zh', region: 'CN', hospital: '中国医学科学院北京协和医院（东院）', ward: '心内科／重症监护病区', nurse: '欧阳娜娜·王'},
    {language: 'zh-TW', region: 'TW', hospital: '臺北榮民總醫院（中正樓）', ward: '內科／加護病房', nurse: '陳怡君'},
    {language: 'th', region: 'TH', hospital: 'โรงพยาบาลศิริราช ปิยมหาราชการุณย์', ward: 'หอผู้ป่วยอายุรกรรม (ชั้น ๓)', nurse: 'น้ำฝน ใจดี'},
    {
        language: 'vi',
        region: 'VN',
        hospital: 'Bệnh viện Đại học Y Dược TP. Hồ Chí Minh',
        ward: 'Khoa Hồi sức tích cực (Tầng 3)',
        nurse: 'Nguyễn Thị Hồng Ánh',
    },
] as const;
const labelsFor = (language: TWebLanguage): TOnboardingDraftLabels => {
    const t = i18n.getFixedT(language);

    return {
        teamName: (index) => t('feature.registerWard.shiftTeams.teamName', {index}),
        newNurseName: (index) => t('page.onboardingWardCreate.defaults.newNurseName', {index}),
        sampleNurseNames: {
            first: t('page.onboardingWardCreate.defaults.sampleNurse.first'),
            second: t('page.onboardingWardCreate.defaults.sampleNurse.second'),
            skilled: t('page.onboardingWardCreate.defaults.sampleNurse.skilled'),
            off: t('page.onboardingWardCreate.defaults.sampleNurse.off'),
        },
        shiftNames: {
            day: t('feature.registerWard.defaultShiftType.day'),
            evening: t('feature.registerWard.defaultShiftType.evening'),
            night: t('feature.registerWard.defaultShiftType.night'),
            off: t('feature.registerWard.defaultShiftType.off'),
            annualLeave: t('page.onboardingWardCreate.defaults.annualLeave'),
            twoDay: t('page.onboardingWardCreate.defaults.twoDay'),
            twoNight: t('page.onboardingWardCreate.defaults.twoNight'),
            twoNightContinuation: t('page.onboardingWardCreate.defaults.twoNightContinuation'),
        },
    };
};
const readyDraft = (example: (typeof examples)[number]) => {
    const draft = createInitialDraft(labelsFor(example.language));

    return {
        ...draft,
        currentStep: 5 as const,
        hospitalName: example.hospital,
        wardName: example.ward,
        teams: draft.teams.slice(0, 1),
        nurses: draft.nurses.slice(0, 1).map((nurse) => ({...nurse, name: example.nurse})),
    };
};

describe('supported-language onboarding name contracts', () => {
    afterEach(async () => {
        cleanup();
        await i18n.changeLanguage('ko');
    });

    it('covers every supported web language', () => {
        expect(examples.map((example) => example.language)).toEqual(WEB_LANGUAGES);
    });

    it.each(examples)(
        'preserves hospital, ward and nurse names from $language through validation and request serialization',
        async (example) => {
            const draft = readyDraft(example);

            expect(getStepValidation(draft, 1).issues).toEqual([]);
            expect(getStepValidation(draft, 5).issues).toEqual([]);
            expect(canComplete(draft)).toBe(true);
            expect(isValidAccountName(example.nurse)).toBe(true);
            expect(await registerWardSchema.isValid({hospitalName: example.hospital, name: example.ward})).toBe(true);

            const payload = JSON.parse(JSON.stringify(buildCreateWardPayload(draft)));

            expect(payload).toMatchObject({hospitalName: example.hospital, name: example.ward});
            expect(payload.shiftTeams[0].nurses[0].name).toBe(example.nurse);
        },
    );

    it.each(examples)('renders usable identity fields and localized validation feedback in $language', async (example) => {
        await i18n.changeLanguage(example.language);

        const onHospitalChange = vi.fn();
        const onWardChange = vi.fn();

        render(
            <WardIdentityStep
                serviceRegion={example.region}
                hospitalName=""
                wardName=""
                onHospitalChange={onHospitalChange}
                onWardNameChange={onWardChange}
                onIdentityNameEnter={vi.fn()}
            />,
        );

        const hospital = screen.getByLabelText(i18n.t('page.onboardingWardCreate.identity.hospitalName'));
        const ward = screen.getByLabelText(i18n.t('page.onboardingWardCreate.identity.wardName'));

        expect(hospital).toHaveAttribute('maxlength', '100');
        expect(ward).toHaveAttribute('maxlength', '50');
        fireEvent.change(hospital, {target: {value: example.hospital}});
        fireEvent.change(ward, {target: {value: example.ward}});
        expect(onHospitalChange).toHaveBeenCalledWith({hospitalId: undefined, hospitalName: example.hospital});
        expect(onWardChange).toHaveBeenCalledWith(example.ward);

        const identityError = i18n.t('page.onboardingWardCreate.blocked.invalidWardIdentity');
        const nurseError = i18n.t('page.onboardingWardCreate.blocked.invalidNurseNameDetail', {
            name: example.nurse,
            reason: i18n.t('page.onboardingWardCreate.blocked.invalidNurseName'),
        });

        expect(identityError).toContain('100');
        expect(identityError).toContain('50');
        expect(nurseError).toContain(example.nurse);
        expect(nurseError).not.toMatch(/{{|page\.onboarding/);

        if (example.language !== 'ko') {
            expect(identityError).not.toMatch(/[가-힣]/);
            expect(nurseError).not.toMatch(/[가-힣]/);
        }
    });

    it.each(examples)('uses a valid localized ward name for long hospital names in $language', async (example) => {
        const draft = {...readyDraft(example), hospitalName: example.hospital.padEnd(80, 'A'), wardName: ''};
        const fallback = i18n.getFixedT(example.language)('page.onboardingWardCreate.fallback.wardName');
        const createWard = vi.fn().mockResolvedValue(undefined);

        expect(canComplete(draft)).toBe(true);
        expect(await registerWardSchema.isValid({hospitalName: draft.hospitalName, name: example.ward})).toBe(true);
        expect(buildOnboardingWardIdentityPayload(draft, fallback)).toMatchObject({hospitalName: draft.hospitalName, name: fallback});
        await createOnboardingWardCreateExecutor(createWard, undefined, undefined, fallback)(draft);

        const payload = createWard.mock.calls[0]![0];

        expect(payload.hospitalName).toBe(draft.hospitalName);
        expect(payload.name).toBe(fallback);
        expect(payload.name.length).toBeLessThanOrEqual(50);

        if (example.language !== 'ko') expect(payload.name).not.toMatch(/[가-힣]/);
    });

    it.each(
        examples.flatMap((example) => (['THREE', 'MIXED', 'TWO_OFF', 'TWO_CONTINUATION'] as const).map((mode) => ({...example, mode}))),
    )('can submit $mode default shifts in $language without violating a name limit', (example) => {
        const labels = labelsFor(example.language);
        const mode = example.mode.startsWith('TWO') ? 'TWO' : example.mode === 'MIXED' ? 'MIXED' : 'THREE';

        let draft = updateRotationModeDraft(readyDraft(example), mode, labels);

        if (mode === 'TWO')
            draft = updateTwoShiftNightRecoveryDisplayDraft(
                draft,
                example.mode === 'TWO_CONTINUATION' ? 'NIGHT_CONTINUATION' : 'OFF',
                labels,
            );

        expect(getStepValidation(draft, 2).issues).toEqual([]);
        expect(getStepValidation(draft, 4).issues).toEqual([]);
        expect(canComplete(draft)).toBe(true);

        for (const shift of buildCreateWardPayload(draft).wardShiftTypes) {
            expect(shift.name.trim().length).toBeGreaterThan(0);
            expect(shift.name.length, `${example.language}: ${shift.name}`).toBeLessThanOrEqual(12);
        }
    });

    it.each(examples.flatMap((from) => examples.map((to) => ({from, to, label: `${from.language} → ${to.language}`}))))(
        'keeps personal names and valid default shifts when switching $label',
        ({from, to}) => {
            const initial = updateRotationModeDraft(readyDraft(from), 'MIXED', labelsFor(from.language));
            const localized = localizeOnboardingShiftNames(initial, labelsFor(to.language));

            expect(localized.hospitalName).toBe(from.hospital);
            expect(localized.wardName).toBe(from.ward);
            expect(localized.nurses[0]!.name).toBe(from.nurse);
            expect(localized.shiftTypes.find((shift) => shift.id === 'shift-two-day')?.name).toBe(labelsFor(to.language).shiftNames.twoDay);
            expect(canComplete(localized)).toBe(true);
        },
    );

    it.each(['Nguyễn Thị Hồng Ánh', 'Đặng Thị Mỹ Duyên', 'น้ำฝน ใจดี', 'สมหญิง จันทร์แสง', 'Élodie O’Neill'])(
        'preserves combining marks and accents in %s',
        (name) => {
            const decomposed = name.normalize('NFD');

            expect(isValidOnboardingNurseName(decomposed)).toBe(true);
            expect(normalizeRosterNurseNameForRequest(decomposed)).toBe(name.normalize('NFC'));
        },
    );
});
