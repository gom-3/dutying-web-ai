import {describe, expect, it} from 'vitest';
import {applyParsedWardData, buildCreateWardPayload, buildMockCreateWardPayload} from './adapter';
import {createInitialDraft} from './model';

describe('OnboardingWardCreatePage adapter', () => {
    it('builds create ward payload outside the UI draft layer', () => {
        const draft = createInitialDraft();
        const payload = buildCreateWardPayload(draft);

        expect(payload).toEqual({
            name: draft.wardName,
            hospitalName: draft.hospitalName,
            wardShiftTypes: draft.shiftTypes.map(({id: _id, ...shiftType}) => shiftType),
            shiftTeams: draft.teams.map((team) => ({
                nurseNames: draft.nurses.filter((nurse) => nurse.teamId === team.id).map((nurse) => nurse.name),
            })),
        });
    });

    it('applies parsed response data as draft bootstrap values', () => {
        const draft = createInitialDraft();
        const nextDraft = applyParsedWardData(draft, {
            fileName: 'ward.xlsx',
            wardName: '중환자실',
            hospitalName: '듀팅병원',
            shiftTypes: [
                {name: '데이', shortName: 'D', color: '#111111', classification: 'DAY'},
                {name: '오프', shortName: 'O', color: '#222222', isOff: true, classification: 'OFF'},
            ],
            nurses: [
                {
                    name: '신규 간호사',
                    teamName: 'A팀',
                    possibleShiftShortNames: ['D'],
                    employmentDate: '2025-01-01',
                    level: 2,
                },
            ],
        });

        expect(nextDraft.uploadedFileName).toBe('ward.xlsx');
        expect(nextDraft.wardName).toBe('중환자실');
        expect(nextDraft.hospitalName).toBe('듀팅병원');
        expect(nextDraft.teams).toHaveLength(1);
        expect(nextDraft.teams[0]?.name).toBe('A팀');
        expect(nextDraft.nurses[0]?.teamId).toBe(nextDraft.teams[0]?.id);
        expect(nextDraft.nurses[0]?.possibleShiftTypeIds).toEqual([nextDraft.shiftTypes[0]?.id]);
    });

    it('infers standard shift classifications from parsed short names', () => {
        const draft = createInitialDraft();
        const nextDraft = applyParsedWardData(draft, {
            shiftTypes: [
                {name: '데이', shortName: 'D'},
                {name: '이브닝', shortName: 'E'},
                {name: '나이트', shortName: 'N'},
                {name: '오프', shortName: 'O', isOff: true},
            ],
        });

        expect(nextDraft.shiftTypes.map((shiftType) => shiftType.classification)).toEqual(['DAY', 'EVENING', 'NIGHT', 'OFF']);
    });

    it('falls back to default possible shifts when parsed shift mappings are empty', () => {
        const draft = createInitialDraft();
        const nextDraft = applyParsedWardData(draft, {
            nurses: [
                {
                    name: '신규 간호사',
                    teamName: draft.teams[0]?.name,
                    possibleShiftShortNames: [],
                },
                {
                    name: '다른 간호사',
                    teamName: draft.teams[0]?.name,
                    possibleShiftShortNames: ['UNKNOWN'],
                },
            ],
        });
        const defaultShiftTypeIds = nextDraft.shiftTypes.filter((shiftType) => !shiftType.isOff).map((shiftType) => shiftType.id);

        expect(nextDraft.nurses[0]?.possibleShiftTypeIds).toEqual(defaultShiftTypeIds);
        expect(nextDraft.nurses[1]?.possibleShiftTypeIds).toEqual(defaultShiftTypeIds);
    });

    it('builds a mock preview payload with parse-friendly nurse metadata', () => {
        const draft = createInitialDraft();
        const payload = buildMockCreateWardPayload(draft);

        expect(payload.nurses[0]).toMatchObject({
            name: draft.nurses[0]?.name,
            teamName: draft.teams[0]?.name,
        });
        expect(payload.skillLevelConfig.palette).toHaveLength(draft.skillLevelConfig.levelCount);
    });
});
