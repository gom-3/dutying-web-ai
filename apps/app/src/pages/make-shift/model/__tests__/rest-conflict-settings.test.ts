import {beforeEach, describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import type {TAiConversationFailure, TPersonalRestConflict} from '../ai-conversation-failure';
import {resolveRestConflicts} from '../rest-conflict-settings';

const nurses = [
    {nurseId: 1, name: '김간호'},
    {nurseId: 2, name: '이간호'},
    {nurseId: 3, name: '동명이인'},
    {nurseId: 4, name: '동명이인'},
];
const evidence: TPersonalRestConflict = {
    nurseId: 2,
    nurseName: '서버 이름',
    shiftCodes: ['O'],
    expected: 9,
    minimumAssignments: 0,
    maximumAssignments: 8,
};
const failure = (restConflicts = [evidence]): TAiConversationFailure => ({
    message: '충돌',
    blocked: false,
    recovery: 'revise',
    conditionConflict: true,
    settingsTarget: 'rest',
    restConflicts,
});

beforeEach(async () => {
    await i18n.changeLanguage('ko');
});

describe('contextual rest conflict settings', () => {
    it('uses the current roster identity and the proven target and capacity', () => {
        const result = resolveRestConflicts(failure(), nurses);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({nurseId: 2, name: '이간호'});
        expect(result[0].explanations[0]).toContain('이간호');

        for (const value of ['O', '9', '0', '8']) expect(result[0].explanations[0]).toContain(value);

        expect(result[0].explanations[0]).not.toContain('서버 이름');
    });
    it('groups separate OFF and annual evidence without repeating identical explanations', () => {
        const result = resolveRestConflicts(
            failure([evidence, evidence, {...evidence, shiftCodes: ['A'], expected: 2, maximumAssignments: 0}, {...evidence, nurseId: 1}]),
            nurses,
        );

        expect(result.map((nurse) => nurse.nurseId)).toEqual([2, 1]);
        expect(result[0].explanations).toHaveLength(2);
    });
    it('accepts a unique exact name only when the evidence has no nurse id', () => {
        expect(resolveRestConflicts(failure([{...evidence, nurseId: undefined, nurseName: '김간호'}]), nurses)[0].nurseId).toBe(1);
    });
    it.each([
        {...evidence, nurseId: 999, nurseName: '김간호'},
        {...evidence, nurseId: undefined, nurseName: '동명이인'},
        {...evidence, nurseId: undefined, nurseName: undefined},
        {...evidence, nurseId: undefined, nurseName: '없는 사람'},
        {...evidence, expected: 8},
        {...evidence, maximumAssignments: 35},
        {...evidence, minimumAssignments: 10},
        {...evidence, shiftCodes: ['O\n']},
    ])('does not guess a nurse or expose an editor for invalid evidence %j', (issue) => {
        expect(resolveRestConflicts(failure([issue]), nurses)).toEqual([]);
    });
    it('requires a current, unblocked rest conflict', () => {
        expect(resolveRestConflicts({...failure(), settingsTarget: 'member'}, nurses)).toEqual([]);
        expect(resolveRestConflicts({...failure(), blocked: true}, nurses)).toEqual([]);
        expect(resolveRestConflicts(undefined, nurses)).toEqual([]);
        expect(resolveRestConflicts(failure(), [])).toEqual([]);
    });
});
