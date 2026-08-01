import type {DropResult} from '@hello-pangea/dnd';
import {act} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import '@/i18n';
import type * as SharedApiModule from '@/shared/api';
import {renderHook, waitFor} from '@/shared/util/test-utils';
import {createInitialDraft, DEFAULT_SHIFT_TYPE_COLORS, getScheduleMonthKey} from '../draft';
import useOnboardingWardWizard from '../use-onboarding-ward-wizard';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const mockCreateWard = vi.fn();
const mockCreateOnboardingWardDraft = vi.fn();
const mockGetOnboardingWardDraft = vi.fn();
const mockSaveOnboardingWardDraft = vi.fn();
const mockPreviewOnboardingScheduleInput = vi.fn();
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
            getOnboardingWardDraft: mockGetOnboardingWardDraft,
            saveOnboardingWardDraft: mockSaveOnboardingWardDraft,
            previewOnboardingScheduleInput: mockPreviewOnboardingScheduleInput,
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
const createScheduleTemplateFile = async (
    rows: string[][] = [
        ['홍길동', 'A팀', 'D', 'E', 'N'],
        ['김철수', 'B팀', 'O', 'D', 'E'],
    ],
) => {
    const Excel = await import('exceljs');
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('근무표');

    worksheet.addRow(['간호사', '팀명', '1', '2', '3']);
    rows.forEach((row) => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();

    return new File([buffer as BlobPart], 'schedule-template.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
};
const draftWardResponse = {
    wardId: 10,
    name: '중환자실',
    hospitalName: '듀팅병원',
    setupStatus: 'SETUP_IN_PROGRESS',
    wardShiftTypes: [],
    shiftTeams: [],
};

describe('useOnboardingWardWizard upload flow', () => {
    beforeEach(() => {
        mockCreateWard.mockReset();
        mockCreateOnboardingWardDraft.mockReset();
        mockCompleteOnboardingWardDraft.mockReset();
        mockGetOnboardingWardDraft.mockReset();
        mockSaveOnboardingWardDraft.mockReset();
        mockPreviewOnboardingScheduleInput.mockReset();
        mockGetOnboardingWardDraft.mockResolvedValue(null);
        mockCreateOnboardingWardDraft.mockResolvedValue(draftWardResponse);
        mockSaveOnboardingWardDraft.mockResolvedValue({ward: draftWardResponse, draftPayload: null});
        mockParseOnboardingWardExcel.mockReset();
        toastSuccess.mockReset();
        toastError.mockReset();
        window.history.replaceState(null, '', window.location.pathname);
    });

    it('creates a draft ward before moving from identity to upload step', async () => {
        const {result} = renderHook(() => useOnboardingWardWizard());

        act(() => {
            result.current.updateWardIdentity({hospitalName: '듀팅병원', wardName: '중환자실'});
        });

        await act(async () => {
            await result.current.goNextStep();
        });

        expect(mockCreateOnboardingWardDraft).toHaveBeenCalledWith({
            hospitalName: '듀팅병원',
            name: '중환자실',
            draftPayload: expect.objectContaining({
                draft: expect.objectContaining({
                    hospitalName: '듀팅병원',
                    wardName: '중환자실',
                }),
            }),
        });
        expect(result.current.draft.currentStep).toBe(2);
        expect(result.current.draftCreationStatus).toBe('created');
    });

    it('previews manual schedule input on the server, saves it, and reloads before moving to shift types', async () => {
        let savedDraftPayload: unknown = null;

        mockGetOnboardingWardDraft.mockImplementation(() =>
            Promise.resolve(savedDraftPayload ? {ward: draftWardResponse, draftPayload: savedDraftPayload} : null),
        );
        mockSaveOnboardingWardDraft.mockImplementation((_wardId, draftDTO) => {
            savedDraftPayload = draftDTO.draftPayload;

            return Promise.resolve({ward: draftWardResponse, draftPayload: savedDraftPayload});
        });
        mockPreviewOnboardingScheduleInput.mockResolvedValue({
            targetYear: 2026,
            targetMonth: 5,
            nurses: [
                {
                    name: '김하늘',
                    displayOrder: 1,
                    initialShifts: [
                        {date: '2026-05-01', shiftShortName: 'R'},
                        {date: '2026-05-02', shiftShortName: 'Z'},
                        {date: '2026-05-03', shiftShortName: 'A'},
                        {date: '2026-05-04', shiftShortName: 'Y'},
                        {date: '2026-05-05', shiftShortName: 'O'},
                    ],
                },
            ],
            wardShiftTypes: [
                {name: '데이', shortName: 'D', color: '#4DC2AD', isOff: false, isDefault: true, classification: 'DAY'},
                {name: '이브닝', shortName: 'E', color: '#FF8BA5', isOff: false, isDefault: true, classification: 'EVENING'},
                {name: '나이트', shortName: 'N', color: '#3580FF', isOff: false, isDefault: true, classification: 'NIGHT'},
                {name: '오프', shortName: 'O', color: '#465B7A', isOff: true, isDefault: true, classification: 'OFF'},
                {name: 'R', shortName: 'R', color: '#94A3B8', isOff: false, isDefault: false, classification: 'OTHER_WORK'},
                {name: 'Z', shortName: 'Z', color: '#94A3B8', isOff: false, isDefault: false, classification: 'OTHER_WORK'},
                {name: 'A', shortName: 'A', color: '#94A3B8', isOff: false, isDefault: false, classification: 'OTHER_WORK'},
                {name: 'Y', shortName: 'Y', color: '#94A3B8', isOff: false, isDefault: false, classification: 'OTHER_WORK'},
            ],
            warnings: [],
            unresolvedCodes: [],
        });

        const {result} = renderHook(() => useOnboardingWardWizard());

        act(() => {
            result.current.updateWardIdentity({hospitalName: '듀팅병원', wardName: '중환자실'});
        });

        await act(async () => {
            await result.current.goNextStep();
        });

        const teamId = result.current.activeTeamId;

        act(() => {
            result.current.updateScheduleInput(teamId, {
                year: 2026,
                month: 5,
                rows: [
                    {
                        id: 'row-1',
                        nurseId: null,
                        name: '김하늘',
                        shifts: {
                            '1': 'R',
                            '2': 'Z',
                            '3': 'A',
                            '4': 'Y',
                            '5': '/',
                        },
                    },
                ],
            });
        });

        await act(async () => {
            await result.current.goNextStep();
        });

        const previewRequest = mockPreviewOnboardingScheduleInput.mock.calls[0]?.[0];
        const savedDraft =
            mockSaveOnboardingWardDraft.mock.calls[mockSaveOnboardingWardDraft.mock.calls.length - 1]?.[1]?.draftPayload?.draft;

        expect(mockPreviewOnboardingScheduleInput).toHaveBeenCalledTimes(1);
        expect(previewRequest).toEqual(
            expect.objectContaining({
                targetYear: 2026,
                targetMonth: 5,
                nurseNameBlock: '김하늘',
            }),
        );
        expect(previewRequest.dutyBlock.split('\t').slice(0, 5)).toEqual(['R', 'Z', 'A', 'Y', '/']);
        expect(mockSaveOnboardingWardDraft).toHaveBeenCalled();
        expect(mockGetOnboardingWardDraft).toHaveBeenCalledTimes(1);
        expect(savedDraft.currentStep).toBe(3);
        expect(result.current.draft.currentStep).toBe(3);
        expect(result.current.draft.shiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['D', 'E', 'N', '/', 'A', 'R', 'Y', 'Z']);
        expect(result.current.draft.shiftTypes.slice(3).every((shiftType) => shiftType.source === 'schedule-input')).toBe(true);

        const customShiftColors = result.current.draft.shiftTypes.slice(4).map((shiftType) => shiftType.color);

        expect(customShiftColors).not.toContain('#94A3B8');
        expect(new Set(customShiftColors).size).toBe(customShiftColors.length);

        const previewedNurse = result.current.draft.nurses.find((nurse) => nurse.name === '김하늘');

        expect(previewedNurse?.possibleShiftTypeIds).toEqual(
            expect.arrayContaining(result.current.draft.shiftTypes.map((shiftType) => shiftType.id)),
        );
        expect(previewedNurse?.possibleShiftTypeIds).toHaveLength(result.current.draft.shiftTypes.length);
        expect(previewedNurse?.initialShifts).toEqual([
            {date: '2026-05-01', shiftShortName: 'R'},
            {date: '2026-05-02', shiftShortName: 'Z'},
            {date: '2026-05-03', shiftShortName: 'A'},
            {date: '2026-05-04', shiftShortName: 'Y'},
            {date: '2026-05-05', shiftShortName: '/'},
        ]);
    });

    it('uses only the corrected schedule codes when moving to shift types', async () => {
        let savedDraftPayload: unknown = null;

        mockGetOnboardingWardDraft.mockImplementation(() =>
            Promise.resolve(savedDraftPayload ? {ward: draftWardResponse, draftPayload: savedDraftPayload} : null),
        );
        mockSaveOnboardingWardDraft.mockImplementation((_wardId, draftDTO) => {
            savedDraftPayload = draftDTO.draftPayload;

            return Promise.resolve({ward: draftWardResponse, draftPayload: savedDraftPayload});
        });
        mockPreviewOnboardingScheduleInput.mockImplementation((request) =>
            Promise.resolve({
                targetYear: request.targetYear,
                targetMonth: request.targetMonth,
                nurses: [
                    {
                        name: '김하늘',
                        displayOrder: 1,
                        initialShifts: [{date: '2026-05-01', shiftShortName: 'Y'}],
                    },
                ],
                wardShiftTypes: [
                    {name: '데이', shortName: 'D', color: '#4DC2AD', isOff: false, isDefault: true, classification: 'DAY'},
                    {name: '이브닝', shortName: 'E', color: '#FF8BA5', isOff: false, isDefault: true, classification: 'EVENING'},
                    {name: '나이트', shortName: 'N', color: '#3580FF', isOff: false, isDefault: true, classification: 'NIGHT'},
                    {name: '오프', shortName: 'O', color: '#465B7A', isOff: true, isDefault: true, classification: 'OFF'},
                    {name: 'Y', shortName: 'Y', color: '#94A3B8', isOff: false, isDefault: false, classification: 'OTHER_WORK'},
                ],
                warnings: [],
                unresolvedCodes: [],
            }),
        );

        const {result} = renderHook(() => useOnboardingWardWizard());

        act(() => {
            result.current.updateWardIdentity({hospitalName: '듀팅병원', wardName: '중환자실'});
        });

        await act(async () => {
            await result.current.goNextStep();
        });

        const teamId = result.current.activeTeamId;

        act(() => {
            result.current.updateScheduleInput(teamId, {
                year: 2026,
                month: 5,
                rows: [{id: 'row-1', nurseId: null, name: '김하늘', shifts: {'1': 'X'}}],
            });
        });

        const rowAfterWrongCode = result.current.draft.scheduleInputs[teamId]?.['2026-05']?.rows[0];

        act(() => {
            result.current.updateScheduleInput(teamId, {
                year: 2026,
                month: 5,
                rows: [{id: 'row-1', nurseId: rowAfterWrongCode?.nurseId ?? null, name: '김하늘', shifts: {'1': 'Y'}}],
            });
        });

        expect(result.current.draft.shiftTypes.some((shiftType) => shiftType.shortName === 'X')).toBe(false);
        expect(result.current.draft.shiftTypes.some((shiftType) => shiftType.shortName === 'Y')).toBe(true);

        await act(async () => {
            await result.current.goNextStep();
        });

        const previewRequest = mockPreviewOnboardingScheduleInput.mock.calls[0]?.[0];

        expect(previewRequest.dutyBlock.split('\t')[0]).toBe('Y');
        expect(result.current.draft.currentStep).toBe(3);
        expect(result.current.draft.shiftTypes.some((shiftType) => shiftType.shortName === 'X')).toBe(false);
        expect(result.current.draft.shiftTypes.some((shiftType) => shiftType.shortName === 'Y')).toBe(true);
        expect(result.current.draft.nurses.find((nurse) => nurse.name === '김하늘')?.initialShifts).toEqual([
            {date: '2026-05-01', shiftShortName: 'Y'},
        ]);
    });

    it('resets shift types when returning from schedule input and entering shift types again', async () => {
        let savedDraftPayload: unknown = null;

        mockGetOnboardingWardDraft.mockImplementation(() =>
            Promise.resolve(savedDraftPayload ? {ward: draftWardResponse, draftPayload: savedDraftPayload} : null),
        );
        mockSaveOnboardingWardDraft.mockImplementation((_wardId, draftDTO) => {
            savedDraftPayload = draftDTO.draftPayload;

            return Promise.resolve({ward: draftWardResponse, draftPayload: savedDraftPayload});
        });
        mockPreviewOnboardingScheduleInput.mockResolvedValue({
            targetYear: 2026,
            targetMonth: 5,
            nurses: [
                {
                    name: '김하늘',
                    displayOrder: 1,
                    initialShifts: [{date: '2026-05-01', shiftShortName: 'R'}],
                },
            ],
            wardShiftTypes: [
                {name: '데이', shortName: 'D', color: '#4DC2AD', isOff: false, isDefault: true, classification: 'DAY'},
                {name: '이브닝', shortName: 'E', color: '#FF8BA5', isOff: false, isDefault: true, classification: 'EVENING'},
                {name: '나이트', shortName: 'N', color: '#3580FF', isOff: false, isDefault: true, classification: 'NIGHT'},
                {name: '오프', shortName: 'O', color: '#465B7A', isOff: true, isDefault: true, classification: 'OFF'},
                {name: 'R', shortName: 'R', color: '#94A3B8', isOff: false, isDefault: false, classification: 'OTHER_WORK'},
            ],
            warnings: [],
            unresolvedCodes: [],
        });

        const {result} = renderHook(() => useOnboardingWardWizard());

        act(() => {
            result.current.updateWardIdentity({hospitalName: '듀팅병원', wardName: '중환자실'});
        });

        await act(async () => {
            await result.current.goNextStep();
        });

        const teamId = result.current.activeTeamId;

        act(() => {
            result.current.updateScheduleInput(teamId, {
                year: 2026,
                month: 5,
                rows: [
                    {
                        id: 'row-1',
                        nurseId: null,
                        name: '김하늘',
                        shifts: {'1': 'R'},
                    },
                ],
            });
        });

        await act(async () => {
            await result.current.goNextStep();
        });

        const initialShiftTypes = result.current.draft.shiftTypes.map((shiftType) => ({...shiftType}));
        const rShiftType = result.current.draft.shiftTypes.find((shiftType) => shiftType.shortName === 'R');

        act(() => {
            result.current.updateShiftType(rShiftType?.id ?? '', {name: '사용자 수정 근무'});
            result.current.addShiftType();
        });

        expect(result.current.draft.shiftTypes).toHaveLength(initialShiftTypes.length + 1);

        act(() => {
            result.current.goPreviousStep();
        });

        expect(result.current.draft.currentStep).toBe(2);

        await act(async () => {
            await result.current.goNextStep();
        });

        expect(result.current.draft.currentStep).toBe(3);
        expect(result.current.draft.shiftTypes.map(({id: _id, ...shiftType}) => shiftType)).toEqual(
            initialShiftTypes.map(({id: _id, ...shiftType}) => shiftType),
        );
        expect(result.current.draft.shiftTypes.find((shiftType) => shiftType.shortName === 'R')?.name).toBe('R');
        expect(mockPreviewOnboardingScheduleInput).toHaveBeenCalledTimes(2);
    });

    it('does not leave schedule input when a row has shifts but no nurse name', async () => {
        const {result} = renderHook(() => useOnboardingWardWizard());

        act(() => {
            result.current.updateWardIdentity({hospitalName: '테스트 병원', wardName: '테스트 병동'});
        });

        await act(async () => {
            await result.current.goNextStep();
        });

        const teamId = result.current.activeTeamId;

        act(() => {
            result.current.updateScheduleInput(teamId, {
                year: 2026,
                month: 5,
                rows: [{id: 'row-1', nurseId: null, name: '', shifts: {'1': 'D'}}],
            });
        });

        mockSaveOnboardingWardDraft.mockClear();
        mockGetOnboardingWardDraft.mockClear();
        mockPreviewOnboardingScheduleInput.mockClear();

        await act(async () => {
            await result.current.goNextStep();
        });

        expect(result.current.canGoNext).toBe(false);
        expect(result.current.currentStepValidation.issues).toEqual([
            {code: 'schedule-row-missing-nurse-name', step: 2, targetId: 'row-1'},
        ]);
        expect(result.current.draft.currentStep).toBe(2);
        expect(mockPreviewOnboardingScheduleInput).not.toHaveBeenCalled();
        expect(mockSaveOnboardingWardDraft).not.toHaveBeenCalled();
        expect(mockGetOnboardingWardDraft).not.toHaveBeenCalled();
    });

    it('previews and persists every schedule month for a team', async () => {
        let savedDraftPayload: unknown = null;

        mockGetOnboardingWardDraft.mockImplementation(() =>
            Promise.resolve(savedDraftPayload ? {ward: draftWardResponse, draftPayload: savedDraftPayload} : null),
        );
        mockSaveOnboardingWardDraft.mockImplementation((_wardId, draftDTO) => {
            savedDraftPayload = draftDTO.draftPayload;

            return Promise.resolve({ward: draftWardResponse, draftPayload: savedDraftPayload});
        });
        mockPreviewOnboardingScheduleInput.mockImplementation((request) =>
            Promise.resolve({
                targetYear: request.targetYear,
                targetMonth: request.targetMonth,
                nurses: [
                    {
                        name: '김하늘',
                        displayOrder: 1,
                        initialShifts: [
                            {
                                date: `${request.targetYear}-${String(request.targetMonth).padStart(2, '0')}-01`,
                                shiftShortName: request.targetMonth === 5 ? 'D' : 'E',
                            },
                        ],
                    },
                ],
                wardShiftTypes: [
                    {name: '데이', shortName: 'D', color: '#4DC2AD', isOff: false, isDefault: true, classification: 'DAY'},
                    {name: '이브닝', shortName: 'E', color: '#FF8BA5', isOff: false, isDefault: true, classification: 'EVENING'},
                    {name: '나이트', shortName: 'N', color: '#3580FF', isOff: false, isDefault: true, classification: 'NIGHT'},
                    {name: '오프', shortName: 'O', color: '#465B7A', isOff: true, isDefault: true, classification: 'OFF'},
                ],
                warnings: [],
                unresolvedCodes: [],
            }),
        );

        const {result} = renderHook(() => useOnboardingWardWizard());

        act(() => {
            result.current.updateWardIdentity({hospitalName: '듀팅병원', wardName: '중환자실'});
        });

        await act(async () => {
            await result.current.goNextStep();
        });

        const teamId = result.current.activeTeamId;

        act(() => {
            result.current.updateScheduleInput(teamId, {
                year: 2026,
                month: 5,
                rows: [{id: 'may-row', nurseId: null, name: '김하늘', shifts: {'1': 'D'}}],
            });
            result.current.updateScheduleInput(teamId, {
                year: 2026,
                month: 6,
                rows: [{id: 'june-row', nurseId: null, name: '김하늘', shifts: {'1': 'E'}}],
            });
        });

        await act(async () => {
            await result.current.goNextStep();
        });

        expect(mockPreviewOnboardingScheduleInput).toHaveBeenCalledTimes(2);
        expect(mockPreviewOnboardingScheduleInput.mock.calls.map(([request]) => request.targetMonth)).toEqual([5, 6]);
        expect(result.current.draft.scheduleInputs[teamId]?.['2026-05']).toBeDefined();
        expect(result.current.draft.scheduleInputs[teamId]?.['2026-06']).toBeDefined();
        expect(result.current.draft.nurses.find((nurse) => nurse.name === '김하늘')?.initialShifts).toEqual([
            {date: '2026-05-01', shiftShortName: 'D'},
            {date: '2026-06-01', shiftShortName: 'E'},
        ]);
    });

    it('restores the current ward draft from the server when mounting the wizard', async () => {
        const savedDraft = {
            ...createInitialDraft(),
            currentStep: 2 as const,
            hospitalName: '듀팅병원',
            wardName: '중환자실',
        };

        mockGetOnboardingWardDraft.mockResolvedValueOnce({
            ward: draftWardResponse,
            draftPayload: {
                draft: savedDraft,
                draftWardId: 10,
                selectedTeamId: savedDraft.teams[0]?.id ?? '',
                sortMode: 'manual',
            },
        });

        const {result} = renderHook(() => useOnboardingWardWizard());

        await waitFor(() => expect(result.current.draft.currentStep).toBe(2));

        expect(result.current.draft.hospitalName).toBe('듀팅병원');
        expect(result.current.draft.wardName).toBe('중환자실');
        expect(result.current.draftCreationStatus).toBe('created');
    });

    it('starts from identity when entering create flow with reset state even if a later draft exists', async () => {
        const savedDraft = {
            ...createInitialDraft(),
            currentStep: 2 as const,
            hospitalName: 'Hospital',
            wardName: 'Ward',
        };

        window.history.replaceState({usr: {resetOnboardingWardCreateStep: true}}, '', window.location.pathname);
        mockGetOnboardingWardDraft.mockResolvedValueOnce({
            ward: draftWardResponse,
            draftPayload: {
                draft: savedDraft,
                draftWardId: 10,
                selectedTeamId: savedDraft.teams[1]?.id ?? '',
                sortMode: 'manual',
            },
        });

        const {result} = renderHook(() => useOnboardingWardWizard());

        await waitFor(() => expect(result.current.draftCreationStatus).toBe('created'));

        expect(result.current.draft.currentStep).toBe(1);
        expect(result.current.draft.hospitalName).toBe('Hospital');
        expect(result.current.draft.wardName).toBe('Ward');
        expect(result.current.activeTeamId).toBe(savedDraft.teams[1]?.id);
    });

    it('saves changed draft payload to the existing server draft', async () => {
        const savedDraft = {
            ...createInitialDraft(),
            hospitalName: '듀팅병원',
            wardName: '중환자실',
        };

        mockGetOnboardingWardDraft.mockResolvedValueOnce({
            ward: draftWardResponse,
            draftPayload: {
                draft: savedDraft,
                draftWardId: 10,
                selectedTeamId: savedDraft.teams[0]?.id ?? '',
                sortMode: 'manual',
            },
        });

        const {result, unmount} = renderHook(() => useOnboardingWardWizard());

        await waitFor(() => expect(result.current.draftCreationStatus).toBe('created'));

        act(() => {
            result.current.updateWardIdentity({wardName: '응급실'});
        });

        await waitFor(() =>
            expect(mockSaveOnboardingWardDraft).toHaveBeenCalledWith(
                10,
                expect.objectContaining({
                    name: '응급실',
                    hospitalName: '듀팅병원',
                    draftPayload: expect.objectContaining({
                        draft: expect.objectContaining({
                            wardName: '응급실',
                        }),
                    }),
                }),
            ),
        );

        unmount();
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
                    assignments: {'2025-03-01': 'D'},
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
        expect(result.current.draft.shiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['D', 'O']);
        expect(result.current.draft.shiftTypes.map((shiftType) => shiftType.name)).toEqual(['데이', '오프']);
        expect(result.current.draft.shiftTypes.map((shiftType) => shiftType.color)).toEqual([
            DEFAULT_SHIFT_TYPE_COLORS[0],
            DEFAULT_SHIFT_TYPE_COLORS[3],
        ]);
        expect(result.current.draft.teams.map((team) => team.name)).toEqual(['A팀']);
        expect(result.current.draft.nurses.map((nurse) => nurse.name)).toEqual(['신규 간호사']);
        expect(result.current.draft.nurses[0]?.initialShifts).toEqual([{date: '2025-03-01', shiftShortName: 'D'}]);
        expect(result.current.draft.constraintCandidates).toHaveLength(1);
        expect(result.current.draft.constraintCandidates[0]).toMatchObject({
            templateCode: 'MIN_STAFF_BY_SHIFT',
            severity: 'HARD',
            selected: true,
        });
        expect(toastSuccess).toHaveBeenCalledWith('근무표 파일을 반영했어요.');
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

    it('fills teams, nurses, and schedule cells from the uploaded schedule template', async () => {
        mockParseOnboardingWardExcel.mockResolvedValue({
            nurse_candidates: [],
            shift_type_candidates: [],
            constraint_candidates: [],
        });

        const {result} = renderHook(() => useOnboardingWardWizard());
        const file = await createScheduleTemplateFile();
        const monthKey = getScheduleMonthKey(2026, 6);

        await uploadFile(result.current.applyUploadedFile, file, {targetYear: 2026, targetMonth: 6});

        expect(result.current.draft.uploadedFileName).toBe('schedule-template.xlsx');
        expect(result.current.draft.teams.map((team) => team.name)).toEqual(['A팀', 'B팀']);
        expect(result.current.draft.nurses.map((nurse) => nurse.name)).toEqual(['홍길동', '김철수']);

        const [firstTeam, secondTeam] = result.current.draft.teams;

        expect(result.current.activeTeamId).toBe(firstTeam?.id);
        expect(firstTeam ? result.current.draft.scheduleInputs[firstTeam.id]?.[monthKey]?.rows[0] : undefined).toMatchObject({
            name: '홍길동',
            shifts: {
                '1': 'D',
                '2': 'E',
                '3': 'N',
            },
        });
        expect(secondTeam ? result.current.draft.scheduleInputs[secondTeam.id]?.[monthKey]?.rows[0] : undefined).toMatchObject({
            name: '김철수',
            shifts: {
                '1': 'O',
                '2': 'D',
                '3': 'E',
            },
        });
    });

    it('applies the local schedule immediately without waiting for server analysis', async () => {
        mockParseOnboardingWardExcel.mockRejectedValue(new Error('분석 서버에서 파일을 읽지 못했어요.'));

        const {result} = renderHook(() => useOnboardingWardWizard());
        const file = await createScheduleTemplateFile();
        const monthKey = getScheduleMonthKey(2026, 6);

        await uploadFile(result.current.applyUploadedFile, file, {targetYear: 2026, targetMonth: 6});

        expect(result.current.uploadStatus).toBe('success');
        expect(result.current.uploadError).toBeNull();
        expect(mockParseOnboardingWardExcel).not.toHaveBeenCalled();
        expect(result.current.draft.uploadedFileName).toBe('schedule-template.xlsx');
        expect(result.current.draft.teams.map((team) => team.name)).toEqual(['A팀', 'B팀']);
        expect(result.current.draft.nurses.map((nurse) => nurse.name)).toEqual(['홍길동', '김철수']);
        expect(result.current.draft.scheduleInputs[result.current.draft.teams[0]!.id]?.[monthKey]?.rows[0]).toMatchObject({
            name: '홍길동',
            shifts: {'1': 'D', '2': 'E', '3': 'N'},
        });
        expect(toastSuccess).toHaveBeenCalledWith('근무표 파일을 반영했어요.');
        expect(toastError).not.toHaveBeenCalled();
    });

    it('keeps a cleared uploaded schedule nurse out of the next registration step', async () => {
        let savedDraftPayload: unknown = null;

        mockGetOnboardingWardDraft.mockImplementation(() =>
            Promise.resolve(savedDraftPayload ? {ward: draftWardResponse, draftPayload: savedDraftPayload} : null),
        );
        mockSaveOnboardingWardDraft.mockImplementation((_wardId, draftDTO) => {
            savedDraftPayload = draftDTO.draftPayload;

            return Promise.resolve({ward: draftWardResponse, draftPayload: savedDraftPayload});
        });
        mockParseOnboardingWardExcel.mockResolvedValue({
            nurse_candidates: [],
            shift_type_candidates: [],
            constraint_candidates: [],
        });
        mockPreviewOnboardingScheduleInput.mockImplementation((request) =>
            Promise.resolve({
                targetYear: request.targetYear,
                targetMonth: request.targetMonth,
                nurses: request.nurseNameBlock.split('\n').map((name: string, index: number) => ({
                    name,
                    displayOrder: index + 1,
                    initialShifts: [
                        {date: `${request.targetYear}-${String(request.targetMonth).padStart(2, '0')}-01`, shiftShortName: 'D'},
                    ],
                })),
                wardShiftTypes: [
                    {name: 'Day', shortName: 'D', color: '#4DC2AD', isOff: false, isDefault: true, classification: 'DAY'},
                    {name: 'Evening', shortName: 'E', color: '#FF8BA5', isOff: false, isDefault: true, classification: 'EVENING'},
                    {name: 'Night', shortName: 'N', color: '#3580FF', isOff: false, isDefault: true, classification: 'NIGHT'},
                    {name: 'Off', shortName: 'O', color: '#465B7A', isOff: true, isDefault: true, classification: 'OFF'},
                ],
                warnings: [],
                unresolvedCodes: [],
            }),
        );

        const {result} = renderHook(() => useOnboardingWardWizard());

        act(() => {
            result.current.updateWardIdentity({hospitalName: 'Test Hospital', wardName: 'Test Ward'});
        });

        await act(async () => {
            await result.current.goNextStep();
        });

        const file = await createScheduleTemplateFile([
            ['Nurse A', 'A Team', 'D', 'E', 'N'],
            ['Nurse B', 'A Team', 'E', 'N', 'O'],
        ]);
        const monthKey = getScheduleMonthKey(2026, 6);

        await uploadFile(result.current.applyUploadedFile, file, {targetYear: 2026, targetMonth: 6});

        const teamId = result.current.activeTeamId;
        const [nurseARow, nurseBRow] = result.current.draft.scheduleInputs[teamId]?.[monthKey]?.rows ?? [];

        act(() => {
            result.current.updateScheduleInput(teamId, {
                year: 2026,
                month: 6,
                rows: [{...nurseARow!, name: '', shifts: {}}, nurseBRow!],
            });
        });

        expect(result.current.draft.nurses.map((nurse) => nurse.name)).toEqual(['Nurse B']);

        await act(async () => {
            await result.current.goNextStep();
        });

        expect(mockPreviewOnboardingScheduleInput).toHaveBeenCalledTimes(1);
        expect(mockPreviewOnboardingScheduleInput.mock.calls[0]?.[0].nurseNameBlock).toBe('Nurse B');
        expect(result.current.draft.currentStep).toBe(3);
        expect(result.current.draft.nurses.map((nurse) => nurse.name)).toEqual(['Nurse B']);
    });

    it('uses the default nurse team when every uploaded team name is empty', async () => {
        mockParseOnboardingWardExcel.mockResolvedValue({
            nurse_candidates: [],
            shift_type_candidates: [],
            constraint_candidates: [],
        });

        const {result} = renderHook(() => useOnboardingWardWizard());
        const file = await createScheduleTemplateFile([
            ['홍길동', '', 'D', 'E', 'N'],
            ['김철수', '', 'O', 'D', 'E'],
        ]);
        const monthKey = getScheduleMonthKey(2026, 6);

        await uploadFile(result.current.applyUploadedFile, file, {targetYear: 2026, targetMonth: 6});

        expect(result.current.draft.teams.map((team) => team.name)).toEqual(['간호사 1팀']);
        expect(result.current.draft.nurses.map((nurse) => nurse.name)).toEqual(['홍길동', '김철수']);

        const [team] = result.current.draft.teams;

        expect(team ? result.current.draft.scheduleInputs[team.id]?.[monthKey]?.rows : undefined).toEqual([
            expect.objectContaining({
                name: '홍길동',
                shifts: {
                    '1': 'D',
                    '2': 'E',
                    '3': 'N',
                },
            }),
            expect.objectContaining({
                name: '김철수',
                shifts: {
                    '1': 'O',
                    '2': 'D',
                    '3': 'E',
                },
            }),
        ]);
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
        expect(toastSuccess).toHaveBeenCalledWith('근무표 파일을 반영했어요.');
        expect(toastError).not.toHaveBeenCalled();
    });

    it('clears sample nurses when users skip the optional upload step', async () => {
        let savedDraftPayload: unknown = null;

        mockGetOnboardingWardDraft.mockImplementation(() =>
            Promise.resolve(savedDraftPayload ? {ward: draftWardResponse, draftPayload: savedDraftPayload} : null),
        );
        mockSaveOnboardingWardDraft.mockImplementation((_wardId, draftDTO) => {
            savedDraftPayload = draftDTO.draftPayload;

            return Promise.resolve({ward: draftWardResponse, draftPayload: savedDraftPayload});
        });

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

        await waitFor(() => expect(result.current.draft.currentStep).toBe(3));
        expect(result.current.draft.teams.map((team) => team.name)).toEqual(['간호사 1팀']);
        expect(result.current.draft.nurses).toEqual([]);

        await act(async () => {
            await result.current.goNextStep();
        });

        expect(result.current.draft.currentStep).toBe(4);
        expect(result.current.canComplete).toBe(false);
    });

    it('saves edited custom leave shift types before moving from shift types to nurses', async () => {
        let savedDraftPayload: unknown = null;

        mockGetOnboardingWardDraft.mockImplementation(() =>
            Promise.resolve(savedDraftPayload ? {ward: draftWardResponse, draftPayload: savedDraftPayload} : null),
        );
        mockSaveOnboardingWardDraft.mockImplementation((_wardId, draftDTO) => {
            savedDraftPayload = draftDTO.draftPayload;

            return Promise.resolve({ward: draftWardResponse, draftPayload: savedDraftPayload});
        });

        const {result} = renderHook(() => useOnboardingWardWizard());

        act(() => {
            result.current.updateWardIdentity({hospitalName: '듀팅병원', wardName: '응급실'});
        });

        await act(async () => {
            await result.current.goNextStep();
        });

        act(() => {
            result.current.skipOrComplete();
        });

        await waitFor(() => expect(result.current.draft.currentStep).toBe(3));

        act(() => {
            result.current.addShiftType();
        });

        const rShiftTypeId = result.current.draft.shiftTypes[result.current.draft.shiftTypes.length - 1]?.id;

        act(() => {
            result.current.updateShiftType(rShiftTypeId ?? '', {
                name: 'R',
                shortName: 'R',
                startTime: '',
                endTime: '',
                isOff: true,
                classification: 'OTHER_LEAVE',
            });
        });

        await act(async () => {
            await result.current.goNextStep();
        });

        const savedDraft =
            mockSaveOnboardingWardDraft.mock.calls[mockSaveOnboardingWardDraft.mock.calls.length - 1]?.[1]?.draftPayload?.draft;
        const savedRShiftType = savedDraft?.shiftTypes?.find((shiftType: {shortName?: string}) => shiftType.shortName === 'R');

        expect(result.current.draft.currentStep).toBe(4);
        expect(savedDraft.currentStep).toBe(4);
        expect(savedRShiftType).toEqual(expect.objectContaining({isOff: true, classification: 'OTHER_LEAVE'}));
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
