import {describe, expect, it} from 'vitest';
import {type TOnboardingWardParseApiResponse} from '@/shared/api/file/type';
import {
    applyParsedWardData,
    buildCreateWardPayload,
    buildOnboardingParseDraftInjection,
    getOnboardingUploadFailureMessage,
    isSupportedOnboardingUploadFile,
} from './adapter';
import {createInitialDraft} from './model';

describe('OnboardingWardCreatePage adapter', () => {
    it('builds create ward payload outside the UI draft layer', () => {
        const draft = createInitialDraft();
        const payload = buildCreateWardPayload(draft);

        expect(payload).toHaveProperty('name', draft.wardName);
        expect(payload).toHaveProperty('hospitalName', draft.hospitalName);
        expect(payload.wardShiftTypes).toHaveLength(draft.shiftTypes.length);
        expect(payload.wardShiftTypes[0]).not.toHaveProperty('id');
        expect(payload.shiftTeams).toHaveLength(draft.teams.length);
        expect(payload.shiftTeams[0]).toEqual({
            nurseNames: ['홍길동', '김하늘', '박연우', '이서윤'],
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

    it('fills missing parsed employmentDate with today', () => {
        const draft = createInitialDraft();
        const today = new Date().toISOString().slice(0, 10);
        const nextDraft = applyParsedWardData(draft, {
            nurses: [
                {
                    name: '신규 간호사',
                    teamName: draft.teams[0]?.name,
                },
            ],
        });

        expect(nextDraft.nurses[0]?.employmentDate).toBe(today);
    });

    it('normalizes parse api responses into draft injection data', () => {
        const response: TOnboardingWardParseApiResponse = {
            wardName: '중환자실',
            hospitalName: '듀팅병원',
            wardShiftTypes: [
                {name: '데이', shortName: 'd'},
                {name: '오프', shortName: 'o', isOff: true},
            ],
            shiftTeams: [{name: 'A팀'}],
            nurses: [
                {
                    name: '신규 간호사',
                    teamName: 'A팀',
                    possibleShiftShortNames: ['d', null],
                },
            ],
            warnings: ['근속 연수가 없는 간호사는 오늘 날짜로 반영되었어요.'],
        };
        const {parsedWardData, warnings} = buildOnboardingParseDraftInjection(response, 'ward.xlsx');

        expect(parsedWardData).toMatchObject({
            fileName: 'ward.xlsx',
            wardName: '중환자실',
            hospitalName: '듀팅병원',
        });
        expect(parsedWardData.shiftTypes?.map((shiftType) => shiftType.shortName)).toEqual(['D', 'O']);
        expect(parsedWardData.teams).toEqual([{name: 'A팀'}]);
        expect(parsedWardData.nurses?.[0]?.possibleShiftShortNames).toEqual(['D']);
        expect(warnings).toEqual(['근속 연수가 없는 간호사는 오늘 날짜로 반영되었어요.']);
    });

    it('detects supported upload file extensions', () => {
        expect(isSupportedOnboardingUploadFile('march-duty.xlsx')).toBe(true);
        expect(isSupportedOnboardingUploadFile('march-duty.csv')).toBe(true);
        expect(isSupportedOnboardingUploadFile('march-duty.pdf')).toBe(false);
    });

    it('maps network upload failures to a user guidance message', () => {
        expect(getOnboardingUploadFailureMessage(new Error('Network Error'))).toBe(
            '파싱 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
        );
    });
});
