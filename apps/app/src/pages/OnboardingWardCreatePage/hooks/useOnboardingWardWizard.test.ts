import {act} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type * as SharedApiModule from '@/shared/api';
import {renderHook} from '@/shared/util/test-utils';
import useOnboardingWardWizard from './useOnboardingWardWizard';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const mockCreateWard = vi.fn();
const mockParseOnboardingWardExcel = vi.fn();

vi.mock('react-hot-toast', () => ({
    default: {
        success: (...args: unknown[]) => toastSuccess(...args),
        error: (...args: unknown[]) => toastError(...args),
    },
}));

vi.mock('@/features/auth/useRegister', () => ({
    default: () => ({
        actions: {
            createWard: mockCreateWard,
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

const uploadFile = async (applyUploadedFile: (file: File) => Promise<void>, file: File) => {
    await act(async () => {
        await applyUploadedFile(file);
    });
};

describe('useOnboardingWardWizard upload flow', () => {
    beforeEach(() => {
        mockCreateWard.mockReset();
        mockParseOnboardingWardExcel.mockReset();
        toastSuccess.mockReset();
        toastError.mockReset();
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
        });

        const {result} = renderHook(() => useOnboardingWardWizard());

        await uploadFile(result.current.applyUploadedFile, new File(['mock'], 'march-duty.xlsx', {type: 'application/vnd.ms-excel'}));

        expect(result.current.uploadStatus).toBe('success');
        expect(result.current.uploadError).toBeNull();
        expect(result.current.uploadWarnings).toEqual([]);
        expect(result.current.draft.uploadedFileName).toBe('march-duty.xlsx');
        expect(result.current.draft.wardName).toBe('중환자실');
        expect(result.current.draft.hospitalName).toBe('듀팅병원');
        expect(result.current.draft.shiftTypes.map((shiftType) => shiftType.name)).toEqual(['데이', '오프']);
        expect(result.current.draft.teams.map((team) => team.name)).toEqual(['A팀']);
        expect(result.current.draft.nurses.map((nurse) => nurse.name)).toEqual(['신규 간호사']);
        expect(toastSuccess).toHaveBeenCalledWith('엑셀 데이터를 불러왔어요.');
        expect(toastError).not.toHaveBeenCalled();
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
        expect(result.current.uploadError).toBe('엑셀 파일(.xlsx, .xls, .csv)만 업로드할 수 있어요.');
        expect(result.current.uploadWarnings).toEqual([]);
        expect(result.current.draft).toEqual(initialDraft);
        expect(toastError).toHaveBeenCalledWith('엑셀 파일(.xlsx, .xls, .csv)만 업로드할 수 있어요.');
        expect(toastSuccess).not.toHaveBeenCalled();
    });
});
