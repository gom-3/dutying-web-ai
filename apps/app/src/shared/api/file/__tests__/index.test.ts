import {beforeEach, describe, expect, it, vi} from 'vitest';
import FileAPI from '..';

const {mockGet, mockPost} = vi.hoisted(() => ({
    mockGet: vi.fn(),
    mockPost: vi.fn(),
}));

vi.mock('../../client', () => ({
    default: {
        get: mockGet,
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

        await expect(FileAPI.parseOnboardingWardExcel(file, {wardId: 10})).resolves.toBe(response);

        const [url, body, config] = mockPost.mock.calls[0] ?? [];
        expect(url).toBe('/files/wards/onboarding/parse');
        expect(body).toBeInstanceOf(FormData);
        const formData = body as FormData;
        expect(formData.get('file')).toBe(file);
        expect(formData.get('wardId')).toBe('10');
        expect(formData.get('files')).toBeNull();
        expect(config).toEqual({
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    });

    it('gets saved onboarding ward parse result from the Spring ward endpoint', async () => {
        const response = {
            wardId: 10,
            exists: true,
            fileName: 'schedule.xlsx',
            payload: {
                nurse_candidates: [],
                shift_type_candidates: [],
                constraint_candidates: [],
            },
        };
        mockGet.mockResolvedValue({data: response});

        await expect(FileAPI.getOnboardingWardParseResult(10)).resolves.toBe(response);

        expect(mockGet).toHaveBeenCalledWith('/wards/10/onboarding/parse-result');
    });
});
