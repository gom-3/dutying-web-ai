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
});
