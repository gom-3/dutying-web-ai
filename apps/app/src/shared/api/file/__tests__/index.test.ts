import {beforeEach, describe, expect, it, vi} from 'vitest';
import FileAPI from '..';

const {mockPost} = vi.hoisted(() => ({
    mockPost: vi.fn(),
}));

vi.mock('../../client', () => ({
    default: {
        post: mockPost,
    },
}));

describe('FileAPI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses onboarding ward excel through the Spring file endpoint', async () => {
        const file = new File(['excel'], 'schedule.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const response = {
            nurse_candidates: [],
            shift_type_candidates: [],
            constraint_candidates: [],
        };
        mockPost.mockResolvedValue({data: response});

        await expect(FileAPI.parseOnboardingWardExcel(file)).resolves.toBe(response);

        const [url, body, config] = mockPost.mock.calls[0] ?? [];
        expect(url).toBe('/files/wards/onboarding/parse');
        expect(body).toBeInstanceOf(FormData);
        const formData = body as FormData;
        expect(formData.get('file')).toBe(file);
        expect(formData.get('files')).toBeNull();
        expect(config).toEqual({
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    });

    it('passes onboarding target month params when provided', async () => {
        const file = new File(['excel'], 'schedule.xls', {
            type: 'application/vnd.ms-excel',
        });
        const response = {
            nurse_candidates: [],
            shift_type_candidates: [],
            constraint_candidates: [],
        };
        mockPost.mockResolvedValue({data: response});

        await FileAPI.parseOnboardingWardExcel(file, {targetYear: 2026, targetMonth: 6});

        const [, , config] = mockPost.mock.calls[0] ?? [];
        expect(config).toEqual({
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            params: {
                targetYear: 2026,
                targetMonth: 6,
            },
        });
    });

    it('requests lossless photo assignments using the versioned endpoint', async () => {
        const file = new File(['image'], 'roster.JPEG', {type: 'image/jpeg'});
        const data = {nurses: [{name: 'Nurse A', unmapped_assignments: {'2026-12-04': '교육지원'}}]};

        mockPost.mockResolvedValueOnce({data});
        await expect(FileAPI.parseOnboardingWardExcel(file, {targetYear: 2026, targetMonth: 12})).resolves.toBe(data);
        expect(mockPost).toHaveBeenCalledWith(
            '/files/wards/onboarding/parse/v2',
            expect.any(FormData),
            expect.objectContaining({
                params: {targetYear: 2026, targetMonth: 12},
            }),
        );
    });

    it('falls back only when the legacy image endpoint is the only one available', async () => {
        const file = new File(['image'], 'roster.png', {type: 'image/png'});

        mockPost.mockRejectedValueOnce(Object.assign(new Error('Not found'), {code: 404}));
        mockPost.mockResolvedValueOnce({data: {nurses: [], warnings: ['Partial result']}});
        const result = await FileAPI.parseOnboardingWardExcel(file);

        expect(result.warnings).toEqual(['Partial result', expect.any(String)]);
        expect(mockPost.mock.calls.map(([url]) => url)).toEqual(['/files/wards/onboarding/parse/v2', '/files/wards/onboarding/parse']);
        mockPost.mockClear().mockRejectedValueOnce(Object.assign(new Error('Retake photo'), {code: 422}));
        await expect(FileAPI.parseOnboardingWardExcel(file)).rejects.toThrow('Retake photo');
        expect(mockPost).toHaveBeenCalledTimes(1);
    });
});
