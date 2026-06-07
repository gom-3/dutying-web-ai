import type {DropResult} from '@hello-pangea/dnd';
import {act} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type * as SharedApiModule from '@/shared/api';
import {renderHook} from '@/shared/util/test-utils';
import useOnboardingWardWizard from '../use-onboarding-ward-wizard';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const mockCreateWard = vi.fn();
const mockCreateOnboardingWardDraft = vi.fn();
const mockCompleteOnboardingWardDraft = vi.fn();
const mockParseOnboardingWardExcel = vi.fn();

vi.mock('react-hot-toast', () => ({
    default: {
        success: (...args: unknown[]) => toastSuccess(...args),
        error: (...args: unknown[]) => toastError(...args),
    },
}));

vi.mock('@/features/register', () => ({
    default: () => ({
        actions: {
            createWard: mockCreateWard,
            createOnboardingWardDraft: mockCreateOnboardingWardDraft,
            completeOnboardingWardDraft: mockCompleteOnboardingWardDraft,
        },
    }),
}));

vi.mock('@/shared/api', async () => {
    const actual = (await vi.importActual('@/shared/api')) as typeof SharedApiModule;

    return {
        ...actual,
        FileAPI: {
            ...actual.FileAPI,
            parseOnboardingWardExcel: (...args: unknown[]) => mockParseOnboardingWardExcel(...args),
        },
    };
});

const uploadFile = async (
    applyUploadedFile: (file: File, options?: {targetYear?: number; targetMonth?: number}) => Promise<void>,
    file: File,
    options?: {targetYear?: number; targetMonth?: number},
) => {
    await act(async () => {
        await applyUploadedFile(file, options);
    });
};

describe('useOnboardingWardWizard upload flow', () => {
    beforeEach(() => {
        mockCreateWard.mockReset();
        mockCreateOnboardingWardDraft.mockReset();
        mockCompleteOnboardingWardDraft.mockReset();
        mockCreateOnboardingWardDraft.mockResolvedValue({wardId: 10, setupStatus: 'SETUP_IN_PROGRESS', wardShiftTypes: [], shiftTeams: []});
        mockParseOnboardingWardExcel.mockReset();
        toastSuccess.mockReset();
        toastError.mockReset();
    });

    it('creates a draft ward before moving from identity to upload step', async () => {
        const {result} = renderHook(() => useOnboardingWardWizard());

        act(() => {
            result.current.updateWardIdentity({hospitalName: '듀팅병원', wardName: '중환자실'});
        });

        await act(async () => {
            await result.current.goNextStep();
        });

        expect(mockCreateOnboardingWardDraft).toHaveBeenCalledWith({hospitalName: '듀팅병원', name: '중환자실'});
        expect(result.current.draft.currentStep).toBe(2);
        expect(result.current.draftCreationStatus).toBe('created');
    });

    it('stores parsed draft data and success feedback when the upload succeeds without warnings', async () => {
        mockParseOnboardingWardExcel.mockResolvedValue({
            wardName: '중환자실',
            hospitalName: '듀팅병원',
            shiftTypes: [
                {name: '데이', shortName: 'D'},
                {name: '오프', shortName: 'O', isOff: true},
            ],
            teams: [{name: 'A팀'}],
            nurses: [
                {
                    name: '신규 간호사',
                    teamName: 'A팀',
                    possibleShiftShortNames: ['D'],
                    employmentDate: '2025-01-01',
                },
            ],
            constraint_candidates: [
                {
                    key: 'required_staff',
                    template_code: 'MIN_STAFF_BY_SHIFT',
                    params: {staffing: [{shift: 'D', count: 2}]},
                    severity_recommendation: 'HARD_AFTER_CONFIRM',
                    confidence: 0.9,
                    evidence_summary: 'D 근무 최소 2명을 관찰했어요.',
                },
            ],
        });

        const {result} = renderHook(() => useOnboardingWardWizard());

        await uploadFile(result.current.applyUploadedFile, new File(['mock'], 'march-duty.xlsx', {type: 'application/vnd.ms-excel'}));

        expect(result.current.uploadStatus).toBe('success');
        expect(result.current.uploadError).toBeNull();
        expect(result.current.uploadWarnings).toEqual([]);
        expect(result.current.draft.uploadedFileName).toBe('march-duty.xlsx');
        expect(result.current.draft.wardName).toBe('중환자실');
        expect(result.current.draft.hospitalName).toBe('듀팅병원');
        expect(result.current.draft.shiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['D', 'E', 'N', 'O']);
        expect(result.current.draft.shiftTypes.map((shiftType) => shiftType.name)).toEqual(['데이', '이브닝', '나이트', '오프']);
        expect(result.current.draft.teams.map((team) => team.name)).toEqual(['A팀']);
        expect(result.current.draft.nurses.map((nurse) => nurse.name)).toEqual(['신규 간호사']);
        expect(result.current.draft.constraintCandidates).toHaveLength(1);
        expect(result.current.draft.constraintCandidates[0]).toMatchObject({
            templateCode: 'MIN_STAFF_BY_SHIFT',
            severity: 'HARD',
            selected: true,
        });
        expect(toastSuccess).toHaveBeenCalledWith('엑셀 데이터를 불러왔어요.');
        expect(toastError).not.toHaveBeenCalled();
    });

    it('passes target month options to onboarding upload parsing', async () => {
        mockParseOnboardingWardExcel.mockResolvedValue({
            nurse_candidates: [],
            shift_type_candidates: [],
            constraint_candidates: [],
        });

        const {result} = renderHook(() => useOnboardingWardWizard());
        const file = new File(['mock'], 'no-month-duty.xls', {type: 'application/vnd.ms-excel'});

        await uploadFile(result.current.applyUploadedFile, file, {targetYear: 2026, targetMonth: 6});

        expect(mockParseOnboardingWardExcel).toHaveBeenCalledWith(file, {targetYear: 2026, targetMonth: 6});
    });

    it('updates uploaded constraint candidate selection and staffing counts', async () => {
        mockParseOnboardingWardExcel.mockResolvedValue({
            constraint_candidates: [
                {
                    key: 'required_staff',
                    template_code: 'MIN_STAFF_BY_SHIFT',
                    params: {staffing: [{shift: 'D', count: 2}]},
                    severity_recommendation: 'SOFT',
                    evidence_summary: 'D 근무 최소 2명을 관찰했어요.',
                },
                {
                    key: 'max_work',
                    template_code: 'MAX_CONSECUTIVE_WORK_DAYS',
                    params: {target: 'ALL', count: 5},
                    severity_recommendation: 'HARD_AFTER_CONFIRM',
                    evidence_summary: '최대 연속 근무 5일을 관찰했어요.',
                },
            ],
        });

        const {result} = renderHook(() => useOnboardingWardWizard());

        await uploadFile(result.current.applyUploadedFile, new File(['mock'], 'march-duty.xlsx', {type: 'application/vnd.ms-excel'}));

        const [staffingCandidate, maxWorkCandidate] = result.current.draft.constraintCandidates;

        act(() => {
            result.current.toggleConstraintCandidate(staffingCandidate?.id ?? '', false);
            result.current.updateConstraintCandidateSeverity(maxWorkCandidate?.id ?? '', 'SOFT');
            result.current.updateConstraintCandidateStaffingCount(staffingCandidate?.id ?? '', 0, 3);
            result.current.updateConstraintCandidateCount(maxWorkCandidate?.id ?? '', 6);
        });

        expect(result.current.draft.constraintCandidates[0]?.selected).toBe(false);
        expect(result.current.draft.constraintCandidates[0]?.params).toEqual({staffing: [{shift: 'D', count: 3}]});
        expect(result.current.draft.constraintCandidates[1]?.severity).toBe('SOFT');
        expect(result.current.draft.constraintCandidates[1]?.params).toEqual({target: 'ALL', count: 6});
    });

    it('stores partial draft data and warning feedback when the upload succeeds with warnings', async () => {
        mockParseOnboardingWardExcel.mockResolvedValue({
            nurses: [{name: '신규 간호사', teamName: 'A팀'}],
            warnings: ['2행 데이터를 해석하지 못했어요.'],
        });

        const {result} = renderHook(() => useOnboardingWardWizard());

        await uploadFile(result.current.applyUploadedFile, new File(['mock'], 'march-duty.xlsx', {type: 'application/vnd.ms-excel'}));

        expect(result.current.uploadStatus).toBe('warning');
        expect(result.current.uploadError).toBeNull();
        expect(result.current.uploadWarnings).toEqual(['2행 데이터를 해석하지 못했어요.']);
        expect(result.current.draft.uploadedFileName).toBe('march-duty.xlsx');
        expect(result.current.draft.teams.map((team) => team.name)).toEqual(['A팀']);
        expect(result.current.draft.nurses.map((nurse) => nurse.name)).toEqual(['신규 간호사']);
        expect(toastError).toHaveBeenCalledWith('일부 데이터만 반영했어요. 누락된 항목을 확인해 주세요.');
        expect(toastSuccess).not.toHaveBeenCalled();
    });

    it('clears sample nurses when users skip the optional upload step', async () => {
        const {result} = renderHook(() => useOnboardingWardWizard());

        act(() => {
            result.current.updateWardIdentity({hospitalName: '듀팅병원', wardName: '중환자실'});
        });

        await act(async () => {
            await result.current.goNextStep();
        });

        act(() => {
            result.current.skipOrComplete();
        });

        expect(result.current.draft.currentStep).toBe(3);
        expect(result.current.draft.teams.map((team) => team.name)).toEqual(['간호사 1팀']);
        expect(result.current.draft.nurses).toEqual([]);

        await act(async () => {
            await result.current.goNextStep();
        });

        expect(result.current.draft.currentStep).toBe(4);
        expect(result.current.canComplete).toBe(false);
    });

    it('preserves the draft and stores failure feedback when the parse request fails', async () => {
        mockParseOnboardingWardExcel.mockRejectedValue(new Error('업로드한 파일 형식이 올바르지 않습니다.'));

        const {result} = renderHook(() => useOnboardingWardWizard());
        const initialDraft = result.current.draft;

        await uploadFile(result.current.applyUploadedFile, new File(['mock'], 'march-duty.xlsx', {type: 'application/vnd.ms-excel'}));

        expect(result.current.uploadStatus).toBe('error');
        expect(result.current.uploadError).toBe('업로드한 파일 형식이 올바르지 않습니다.');
        expect(result.current.uploadWarnings).toEqual([]);
        expect(result.current.draft).toEqual(initialDraft);
        expect(toastError).toHaveBeenCalledWith('업로드한 파일 형식이 올바르지 않습니다.');
        expect(toastSuccess).not.toHaveBeenCalled();
    });

    it('short-circuits with the unsupported file message before calling the parse api', async () => {
        const {result} = renderHook(() => useOnboardingWardWizard());
        const initialDraft = result.current.draft;

        await uploadFile(result.current.applyUploadedFile, new File(['mock'], 'march-duty.txt', {type: 'text/plain'}));

        expect(mockParseOnboardingWardExcel).not.toHaveBeenCalled();
        expect(result.current.uploadStatus).toBe('error');
        expect(result.current.uploadError).toBe('엑셀 파일(.xlsx, .xls)만 업로드할 수 있어요.');
        expect(result.current.uploadWarnings).toEqual([]);
        expect(result.current.draft).toEqual(initialDraft);
        expect(toastError).toHaveBeenCalledWith('엑셀 파일(.xlsx, .xls)만 업로드할 수 있어요.');
        expect(toastSuccess).not.toHaveBeenCalled();
    });
});

describe('useOnboardingWardWizard sorting and drag behavior', () => {
    it('switches back to manual and keeps off nurses below on nurses when dragging during 가나다 순', () => {
        const {result} = renderHook(() => useOnboardingWardWizard());

        act(() => {
            result.current.setSortMode('name');
        });

        const activeTeamId = result.current.activeTeamId;

        act(() => {
            result.current.handleNurseDragEnd({
                source: {droppableId: activeTeamId, index: 0},
                destination: {droppableId: activeTeamId, index: 3},
            } as DropResult);
        });

        expect(result.current.sortMode).toBe('manual');
        expect(result.current.draft.nurses.filter((nurse) => nurse.teamId === activeTeamId).map((nurse) => nurse.name)).toEqual([
            '이서윤',
            '홍길동',
            '김하늘',
            '박연우',
        ]);
    });

    it('inserts nurse right below the last on nurse when isWorker is turned off in manual sort', () => {
        const {result} = renderHook(() => useOnboardingWardWizard());
        const activeTeamId = result.current.activeTeamId;
        const targetNurse = result.current.draft.nurses.find((nurse) => nurse.teamId === activeTeamId && nurse.name === '홍길동');

        expect(targetNurse).toBeDefined();

        act(() => {
            result.current.updateNurse(targetNurse?.id ?? '', {isWorker: false});
        });

        expect(result.current.draft.nurses.filter((nurse) => nurse.teamId === activeTeamId).map((nurse) => nurse.name)).toEqual([
            '김하늘',
            '이서윤',
            '홍길동',
            '박연우',
        ]);
    });

    it('keeps the moved nurse at the top of off group when multiple off nurses exist', () => {
        const {result} = renderHook(() => useOnboardingWardWizard());
        const activeTeamId = result.current.activeTeamId;
        const targetNurse = result.current.draft.nurses.find((nurse) => nurse.teamId === activeTeamId && nurse.name === '김하늘');

        expect(targetNurse).toBeDefined();

        act(() => {
            result.current.updateNurse(targetNurse?.id ?? '', {isWorker: false});
        });

        expect(result.current.draft.nurses.filter((nurse) => nurse.teamId === activeTeamId).map((nurse) => nurse.name)).toEqual([
            '홍길동',
            '이서윤',
            '김하늘',
            '박연우',
        ]);
    });

    it('inserts off nurse at the bottom of on group when isWorker is turned on in manual sort', () => {
        const {result} = renderHook(() => useOnboardingWardWizard());
        const activeTeamId = result.current.activeTeamId;
        const offNurse = result.current.draft.nurses.find((nurse) => nurse.teamId === activeTeamId && nurse.name === '박연우');
        const onToOffNurse = result.current.draft.nurses.find((nurse) => nurse.teamId === activeTeamId && nurse.name === '김하늘');

        expect(offNurse).toBeDefined();
        expect(onToOffNurse).toBeDefined();

        act(() => {
            result.current.updateNurse(onToOffNurse?.id ?? '', {isWorker: false});
        });

        act(() => {
            result.current.updateNurse(offNurse?.id ?? '', {isWorker: true});
        });

        expect(result.current.draft.nurses.filter((nurse) => nurse.teamId === activeTeamId).map((nurse) => nurse.name)).toEqual([
            '홍길동',
            '이서윤',
            '박연우',
            '김하늘',
        ]);
    });

    it('keeps order unchanged when manual drag tries to cross the on/off boundary', () => {
        const {result} = renderHook(() => useOnboardingWardWizard());
        const activeTeamId = result.current.activeTeamId;

        act(() => {
            result.current.handleNurseDragEnd({
                source: {droppableId: activeTeamId, index: 0},
                destination: {droppableId: activeTeamId, index: 3},
            } as DropResult);
        });

        expect(result.current.draft.nurses.filter((nurse) => nurse.teamId === activeTeamId).map((nurse) => nurse.name)).toEqual([
            '홍길동',
            '김하늘',
            '이서윤',
            '박연우',
        ]);
    });

    it('deletes nurse and shows delete toast', () => {
        const {result} = renderHook(() => useOnboardingWardWizard());
        const activeTeamId = result.current.activeTeamId;
        const targetNurse = result.current.draft.nurses.find((nurse) => nurse.teamId === activeTeamId && nurse.name === '김하늘');

        expect(targetNurse).toBeDefined();

        act(() => {
            result.current.deleteNurse(targetNurse?.id ?? '');
        });

        expect(result.current.draft.nurses.some((nurse) => nurse.id === targetNurse?.id)).toBe(false);
        expect(toastSuccess).toHaveBeenCalledWith('간호사를 삭제했어요.');
    });

    it('does not move nurse order when isWorker is turned off in non-manual sort', () => {
        const {result} = renderHook(() => useOnboardingWardWizard());
        const activeTeamId = result.current.activeTeamId;
        const targetNurse = result.current.draft.nurses.find((nurse) => nurse.teamId === activeTeamId && nurse.name === '홍길동');

        expect(targetNurse).toBeDefined();

        act(() => {
            result.current.setSortMode('name');
        });

        act(() => {
            result.current.updateNurse(targetNurse?.id ?? '', {isWorker: false});
        });

        expect(result.current.draft.nurses.filter((nurse) => nurse.teamId === activeTeamId).map((nurse) => nurse.name)).toEqual([
            '홍길동',
            '김하늘',
            '이서윤',
            '박연우',
        ]);
    });
});

describe('useOnboardingWardWizard skill config behavior', () => {
    beforeEach(() => {
        toastSuccess.mockReset();
        toastError.mockReset();
    });

    it('applies updated skill config to nurse list and shows 안내 toast', () => {
        const {result} = renderHook(() => useOnboardingWardWizard());

        act(() => {
            result.current.saveSkillConfig({
                enabled: true,
                levelCount: 3,
                paletteId: 'cool',
                autoAssign: false,
            });
        });

        expect(result.current.draft.skillLevelConfig).toEqual({
            enabled: true,
            levelCount: 3,
            paletteId: 'cool',
            autoAssign: false,
        });
        expect(result.current.draft.nurses.map((nurse) => nurse.level)).toEqual([3, 3, 1, 2]);
        expect(toastSuccess).toHaveBeenCalledWith('숙련도 설정이 간호사 목록에 반영됐어요.');
        expect(toastError).not.toHaveBeenCalled();
    });

    it('disables skill config and shows 안내 toast', () => {
        const {result} = renderHook(() => useOnboardingWardWizard());

        act(() => {
            result.current.saveSkillConfig({
                enabled: true,
                levelCount: 3,
                paletteId: 'cool',
                autoAssign: false,
            });
        });

        act(() => {
            result.current.disableSkillConfig();
        });

        expect(result.current.isSkillLevelEnabled).toBe(false);
        expect(toastSuccess).toHaveBeenCalledWith('숙련도 설정을 사용하지 않아요.');
        expect(toastError).not.toHaveBeenCalled();
    });
});

describe('useOnboardingWardWizard add nurse behavior', () => {
    beforeEach(() => {
        toastSuccess.mockReset();
        toastError.mockReset();
    });

    it('adds nurse to the active team and shows team-specific toast', () => {
        const {result} = renderHook(() => useOnboardingWardWizard());
        const activeTeamId = result.current.activeTeamId;
        const activeTeamName = result.current.draft.teams.find((team) => team.id === activeTeamId)?.name ?? '선택한 팀';
        const previousNurseCount = result.current.draft.nurses.filter((nurse) => nurse.teamId === activeTeamId).length;

        act(() => {
            result.current.addNurse();
        });

        const nextNurseCount = result.current.draft.nurses.filter((nurse) => nurse.teamId === activeTeamId).length;

        expect(nextNurseCount).toBe(previousNurseCount + 1);
        expect(toastSuccess).toHaveBeenCalledWith(`${activeTeamName}에 간호사를 추가했어요.`, {position: 'bottom-center'});
        expect(toastError).not.toHaveBeenCalled();
    });

    it('auto-creates a team and adds a nurse when no team exists', () => {
        const {result} = renderHook(() => useOnboardingWardWizard());

        act(() => {
            result.current.deleteActiveTeam();
        });
        act(() => {
            result.current.deleteActiveTeam();
        });
        act(() => {
            result.current.deleteActiveTeam();
        });

        expect(result.current.draft.teams).toHaveLength(0);
        expect(result.current.draft.nurses).toHaveLength(0);

        act(() => {
            result.current.addNurse();
        });

        expect(result.current.draft.teams).toHaveLength(1);
        expect(result.current.draft.nurses).toHaveLength(1);
        expect(result.current.draft.nurses[0]?.teamId).toBe(result.current.draft.teams[0]?.id);
        expect(toastSuccess).toHaveBeenCalledWith('간호사 1팀을 추가하고 간호사도 등록했어요.', {position: 'bottom-center'});
    });
});

describe('useOnboardingWardWizard add team behavior', () => {
    beforeEach(() => {
        toastSuccess.mockReset();
        toastError.mockReset();
    });

    it('adds a new team and shows bottom toast guidance', () => {
        const {result} = renderHook(() => useOnboardingWardWizard());
        const previousTeamCount = result.current.draft.teams.length;

        act(() => {
            result.current.addTeam();
        });

        expect(result.current.draft.teams).toHaveLength(previousTeamCount + 1);
        expect(toastSuccess).toHaveBeenCalledWith('간호사 4팀을 추가했어요.', {position: 'bottom-center'});
        expect(toastError).not.toHaveBeenCalled();
    });
});
