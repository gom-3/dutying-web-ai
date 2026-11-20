import {describe, expect, it} from 'vitest';
import type {TOnboardingNurseDraft} from '../draft';
import {sortNursesByMode} from '../sort';

const createNurse = (params: Partial<TOnboardingNurseDraft>): TOnboardingNurseDraft => ({
    id: params.id ?? 'nurse',
    teamId: params.teamId ?? 'team-1',
    divisionNum: params.divisionNum ?? 1,
    name: params.name ?? '',
    memo: params.memo ?? '',
    isPreceptor: params.isPreceptor ?? false,
    isPreceptee: params.isPreceptee ?? false,
    isWorker: params.isWorker ?? true,
    employmentDate: params.employmentDate ?? '2024-01-01',
    possibleShiftTypeIds: params.possibleShiftTypeIds ?? [],
    initialShifts: params.initialShifts ?? [],
});

describe('sortNursesByMode', () => {
    it('keeps manual order inside on/off groups and always places off nurses below on nurses', () => {
        const nurses = [
            createNurse({id: 'n1', name: 'off-a', isWorker: false}),
            createNurse({id: 'n2', name: 'on-a', isWorker: true}),
            createNurse({id: 'n3', name: 'off-b', isWorker: false}),
            createNurse({id: 'n4', name: 'on-b', isWorker: true}),
            createNurse({id: 'n5', name: 'on-c', isWorker: true}),
        ];
        const sorted = sortNursesByMode(nurses, 'manual');

        expect(sorted.map((nurse) => nurse.name)).toEqual(['on-a', 'on-b', 'on-c', 'off-a', 'off-b']);
    });

    it('returns 가나다 순 when sort mode is name', () => {
        const nurses = [
            createNurse({id: 'n1', name: '홍길동'}),
            createNurse({id: 'n2', name: '김하늘'}),
            createNurse({id: 'n3', name: '박연우'}),
        ];
        const sorted = sortNursesByMode(nurses, 'name');

        expect(sorted.map((nurse) => nurse.name)).toEqual(['김하늘', '박연우', '홍길동']);
    });

    it('places off nurses at the bottom while keeping 가나다 순 inside each group', () => {
        const nurses = [
            createNurse({id: 'n1', name: '홍길동', isWorker: false}),
            createNurse({id: 'n2', name: '김하늘', isWorker: true}),
            createNurse({id: 'n3', name: '박연우', isWorker: false}),
            createNurse({id: 'n4', name: '이서윤', isWorker: true}),
        ];
        const sorted = sortNursesByMode(nurses, 'name');

        expect(sorted.map((nurse) => `${nurse.isWorker ? 'on' : 'off'}-${nurse.name}`)).toEqual([
            'on-김하늘',
            'on-이서윤',
            'off-박연우',
            'off-홍길동',
        ]);
    });

    it.each([
        {language: 'zh', names: ['张伟', '阿明', '李敏'], expected: ['阿明', '李敏', '张伟']},
        {language: 'ja', names: ['佐藤', '山田', '阿部'], expected: ['阿部', '佐藤', '山田']},
        {language: 'vi', names: ['Ân', 'Ăn', 'Anh', 'Đặng', 'Dương'], expected: ['Anh', 'Ăn', 'Ân', 'Dương', 'Đặng']},
    ])('sorts names according to the selected $language language', ({language, names, expected}) => {
        const nurses = names.map((name, index) => createNurse({id: String(index), name}));

        expect(sortNursesByMode(nurses, 'name', language).map((nurse) => nurse.name)).toEqual(expected);
    });
});
