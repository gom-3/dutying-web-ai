import {fireEvent, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {isValidOnboardingNurseName} from '@/shared/lib/nurse-name';
import {HOSPITAL_NAME_MAX_LENGTH, isValidWardIdentityName, WARD_NAME_MAX_LENGTH} from '@/shared/lib/ward-name';
import {render} from '@/shared/util/test-utils';
import WardIdentityStep from '../../ui/steps/ward-identity-step';
import {buildCreateWardPayload} from '../adapter';
import {canComplete, createInitialDraft, getStepValidation} from '../draft';
import {createOnboardingWardCreateExecutor} from '../submission';
import {buildOnboardingWardIdentityPayload} from '../ward-identity';

describe('Japanese onboarding names', () => {
    afterEach(async () => {
        await i18n.changeLanguage('ko');
    });

    it.each([
        ['医療法人社団さくら会（本院）・東京総合病院', '第１病棟（東館）'],
        ['独立行政法人国立病院機構東京医療センター', '循環器・呼吸器内科'],
        ['社会福祉法人聖フランシスコ会', '東５階／消化器・外科'],
        ['ｻｸﾗ総合病院', 'ｶﾝｺﾞ病棟Ａ'],
        ['𠮷野・髙橋病院', '第１病棟－本館'],
        ['聖マリア＆セント・ジョセフ病院', 'ICU／CCU（３階）'],
    ])('accepts hospital %s and ward %s', (hospitalName, wardName) => {
        expect(getStepValidation({...createInitialDraft(), hospitalName, wardName}, 1).issues).toEqual([]);
    });

    it('matches server lengths without removing the full hospital name when the optional ward name is omitted', async () => {
        const hospitalName = '医療法人'.repeat(20);
        const initial = createInitialDraft();
        const draft = {...initial, teams: initial.teams.slice(0, 1), hospitalName, wardName: '', currentStep: 5 as const};
        const createWard = vi.fn().mockResolvedValue(undefined);
        const identity = buildOnboardingWardIdentityPayload(draft, '新しい病棟');

        expect(getStepValidation(draft, 1).isValid).toBe(true);
        expect(canComplete(draft)).toBe(true);
        expect(identity).toMatchObject({hospitalName, name: '新しい病棟'});
        expect(buildCreateWardPayload(draft, '新しい病棟')).toMatchObject(identity);
        await createOnboardingWardCreateExecutor(createWard, undefined, undefined, '新しい病棟')(draft);
        expect(createWard).toHaveBeenCalledWith(expect.objectContaining({hospitalName, name: '新しい病棟'}), {navigateOnLinked: false});
    });

    it('enforces separate hospital and ward limits, rejects invisible controls, and counts supplementary kanji like the API', () => {
        const initial = createInitialDraft();

        expect(getStepValidation({...initial, hospitalName: '院'.repeat(100), wardName: '棟'.repeat(50)}, 1).issues).toEqual([]);
        expect(getStepValidation({...initial, hospitalName: '院'.repeat(101)}, 1).issues).toEqual([
            {code: 'invalid-hospital-name', step: 1},
        ]);
        expect(getStepValidation({...initial, hospitalName: '病院', wardName: '棟'.repeat(51)}, 1).issues).toEqual([
            {code: 'invalid-ward-name', step: 1},
        ]);
        expect(isValidWardIdentityName('𠮷'.repeat(25), WARD_NAME_MAX_LENGTH)).toBe(true);
        expect(isValidWardIdentityName('𠮷'.repeat(26), WARD_NAME_MAX_LENGTH)).toBe(false);

        for (const value of ['病\n院', '病\t院', '病\u0000院', '\u200b', '  ', '・・・']) {
            expect(isValidWardIdentityName(value, HOSPITAL_NAME_MAX_LENGTH), value).toBe(false);
        }
    });

    it.each(['山田　花子', '佐々木・𠮷野', 'ｻｸﾗ ﾕｳｷ', 'ジョン・スミス', '髙橋 渡邊'])('accepts Japanese nurse name %s', (name) => {
        expect(isValidOnboardingNurseName(name)).toBe(true);

        const initial = createInitialDraft();
        const draft = {
            ...initial,
            teams: initial.teams.slice(0, 1),
            nurses: initial.nurses.map((nurse, index) => (index ? nurse : {...nurse, name})),
        };

        expect(getStepValidation(draft, 5).issues).toEqual([]);
        expect(buildCreateWardPayload(draft).shiftTeams[0]!.nurses?.[0]?.name).not.toContain('　');
    });

    it('catches any saved shift name over the 12-character API limit before completion', () => {
        const draft = createInitialDraft();

        draft.shiftTypes[0] = {...draft.shiftTypes[0]!, name: '非常に長い名前の勤務区分です', importedCode: undefined};
        expect(getStepValidation(draft, 4).issues).toContainEqual({code: 'invalid-shift-name', step: 4, targetId: draft.shiftTypes[0].id});
    });

    it('lets Japanese users enter server-supported lengths and does not advance while IME confirms a name', async () => {
        await i18n.changeLanguage('ja');

        const onEnter = vi.fn();
        const onHospitalChange = vi.fn();
        const onWardChange = vi.fn();

        render(
            <WardIdentityStep
                serviceRegion="JP"
                hospitalName=""
                wardName=""
                onHospitalChange={onHospitalChange}
                onWardNameChange={onWardChange}
                onIdentityNameEnter={onEnter}
            />,
        );

        const hospital = screen.getByRole('textbox', {name: i18n.t('page.onboardingWardCreate.identity.hospitalName')});
        const ward = screen.getByRole('textbox', {name: i18n.t('page.onboardingWardCreate.identity.wardName')});

        expect(hospital).toHaveAttribute('maxlength', '100');
        expect(ward).toHaveAttribute('maxlength', '50');
        fireEvent.change(hospital, {target: {value: '医療法人'.repeat(20)}});
        expect(onHospitalChange).toHaveBeenCalledWith({hospitalId: undefined, hospitalName: '医療法人'.repeat(20)});
        fireEvent.change(ward, {target: {value: '第１病棟（東館）'}});
        expect(onWardChange).toHaveBeenCalledWith('第１病棟（東館）');
        fireEvent.keyDown(ward, {key: 'Enter', isComposing: true});
        expect(onEnter).not.toHaveBeenCalled();
        fireEvent.keyDown(ward, {key: 'Enter', isComposing: false});
        expect(onEnter).toHaveBeenCalledOnce();
    });
});
