import {describe, expect, it} from 'vitest';
import {type TNurse, type TNurseShiftType, type TWardShiftType} from '@/entities';
import {buildShiftTypeBadges} from '../workers-sections';

const createNurseShiftType = (params: Partial<TNurseShiftType> & Pick<TNurseShiftType, 'nurseShiftTypeId'>): TNurseShiftType => ({
    nurseShiftTypeId: params.nurseShiftTypeId,
    wardShiftTypeId: params.wardShiftTypeId,
    name: params.name ?? `Shift ${params.nurseShiftTypeId}`,
    shortName: params.shortName ?? `S${params.nurseShiftTypeId}`,
    isPossible: params.isPossible ?? true,
    isPreferred: params.isPreferred ?? false,
});
const createNurse = (params: Partial<TNurse> & Pick<TNurse, 'nurseId' | 'nurseShiftTypes'>): TNurse => ({
    nurseId: params.nurseId,
    accountId: params.accountId ?? null,
    shiftTeamId: params.shiftTeamId ?? 10,
    wardId: params.wardId ?? 1,
    name: params.name ?? `Nurse ${params.nurseId}`,
    phoneNum: params.phoneNum ?? null,
    isConnected: params.isConnected ?? true,
    nurseShiftTypes: params.nurseShiftTypes,
    isWorker: params.isWorker ?? true,
    isDutyManager: params.isDutyManager ?? false,
    isWardManager: params.isWardManager ?? false,
    gender: params.gender ?? '',
    employmentDate: params.employmentDate ?? '',
    memo: params.memo ?? '',
    isDeleted: params.isDeleted ?? false,
    divisionNum: params.divisionNum ?? 1,
    priority: params.priority ?? 100,
});
const createWardShiftType = (params: Partial<TWardShiftType> & Pick<TWardShiftType, 'wardShiftTypeId'>): TWardShiftType => ({
    wardShiftTypeId: params.wardShiftTypeId,
    name: params.name ?? `Shift ${params.wardShiftTypeId}`,
    shortName: params.shortName ?? `S${params.wardShiftTypeId}`,
    startTime: params.startTime ?? '07:00',
    endTime: params.endTime ?? '15:00',
    color: params.color ?? '#94A3B8',
    isDefault: params.isDefault ?? false,
    isOff: params.isOff ?? false,
    isCounted: params.isCounted ?? true,
    classification: params.classification ?? 'OTHER_WORK',
});

describe('buildShiftTypeBadges', () => {
    it('uses ward shift type colors for custom possible shift chips', () => {
        const nurse = createNurse({
            nurseId: 1,
            nurseShiftTypes: [
                createNurseShiftType({
                    nurseShiftTypeId: 101,
                    wardShiftTypeId: 501,
                    name: 'Reserve',
                    shortName: 'R',
                }),
            ],
        });
        const wardShiftTypes = [
            createWardShiftType({
                wardShiftTypeId: 501,
                name: 'Reserve',
                shortName: 'R',
                color: '#E879F9',
            }),
        ];

        expect(buildShiftTypeBadges(nurse, wardShiftTypes)).toEqual([
            {
                key: 'ward-501',
                code: 'R',
                backgroundColor: '#E879F9',
                textColor: '#ffffff',
            },
        ]);
    });

    it('matches by ward shift type id before duplicated short names', () => {
        const nurse = createNurse({
            nurseId: 1,
            nurseShiftTypes: [
                createNurseShiftType({
                    nurseShiftTypeId: 101,
                    wardShiftTypeId: 20,
                    name: 'Orientation',
                    shortName: 'O',
                }),
            ],
        });
        const wardShiftTypes = [
            createWardShiftType({wardShiftTypeId: 10, name: 'On call', shortName: 'O', color: '#111111'}),
            createWardShiftType({wardShiftTypeId: 20, name: 'Orientation', shortName: 'O', color: '#222222'}),
        ];

        expect(buildShiftTypeBadges(nurse, wardShiftTypes)[0]?.backgroundColor).toBe('#222222');
    });

    it('keeps the built-in fallback color when ward shift types are unavailable', () => {
        const nurse = createNurse({
            nurseId: 1,
            nurseShiftTypes: [createNurseShiftType({nurseShiftTypeId: 101, name: 'Day', shortName: 'D'})],
        });

        expect(buildShiftTypeBadges(nurse, undefined)[0]?.backgroundColor).toBe('#4dc2ad');
    });
});
