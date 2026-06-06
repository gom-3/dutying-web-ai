import {beforeEach, describe, expect, it, vi} from 'vitest';
import BoardAPI from '..';

const {mockDelete, mockGet, mockPost, mockPut} = vi.hoisted(() => ({
    mockDelete: vi.fn(),
    mockGet: vi.fn(),
    mockPost: vi.fn(),
    mockPut: vi.fn(),
}));

vi.mock('../../client', () => ({
    default: {
        delete: mockDelete,
        get: mockGet,
        post: mockPost,
        put: mockPut,
    },
}));

describe('BoardAPI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a post with a JSON body instead of query params', async () => {
        const payload = {title: '123', content: '123'};
        const response = {...payload, postId: 1};

        mockPost.mockResolvedValue({data: response});

        await expect(BoardAPI.createPost(287, {...payload, imageUrls: [], deadlineDate: undefined})).resolves.toBe(response);

        expect(mockPost).toHaveBeenCalledWith('/wards/287/board/posts', payload);
    });

    it('keeps optional post fields in the JSON body when present', async () => {
        const payload = {
            title: 'notice',
            content: 'please check',
            deadlineDate: '2026-06-10',
            imageUrls: ['https://example.com/post.png'],
        };
        const response = {...payload, postId: 2};

        mockPost.mockResolvedValue({data: response});

        await expect(BoardAPI.createPost(287, payload)).resolves.toBe(response);

        expect(mockPost).toHaveBeenCalledWith('/wards/287/board/posts', payload);
    });

    it('gets board schedules with a date range and supports direct array responses', async () => {
        const response = [
            {
                scheduleId: 1,
                title: '신규 교육',
                scheduleDate: '2026-05-12',
                sourceType: 'MANUAL',
                editableByMe: true,
                deletableByMe: true,
            },
            {
                scheduleId: 2,
                title: '확인 마감',
                scheduleDate: '2026-05-13',
                sourceType: 'BOARD_DEADLINE',
                sourcePostId: 99,
                editableByMe: false,
                deletableByMe: false,
            },
        ];

        mockGet.mockResolvedValue({data: response});

        await expect(BoardAPI.getSchedules(287, '2026-05-01', '2026-05-31')).resolves.toEqual(response);

        expect(mockGet).toHaveBeenCalledWith('/wards/287/board/schedules?startDate=2026-05-01&endDate=2026-05-31');
    });

    it('normalizes wrapped board schedule list responses', async () => {
        const response = {
            schedules: [
                {
                    scheduleId: 3,
                    title: '팀 회의',
                    scheduleDate: '2026-06-02',
                    sourceType: 'MANUAL',
                },
            ],
        };

        mockGet.mockResolvedValue({data: response});

        await expect(BoardAPI.getSchedules(287, '2026-06-01', '2026-06-30')).resolves.toEqual(response.schedules);
    });

    it('normalizes snake_case board schedule response fields', async () => {
        const response = [
            {
                scheduleId: 4,
                title: '종일 교육',
                scheduleDate: '2026-06-03',
                start_date: '2026-06-03',
                end_date: '2026-06-04',
                all_day: 'true',
                start_time: null,
                end_time: null,
                editable_by_me: 1,
                deletable_by_me: 1,
                source_type: 'MANUAL' as const,
            },
        ];

        mockGet.mockResolvedValue({data: response});

        await expect(BoardAPI.getSchedules(287, '2026-06-01', '2026-06-30')).resolves.toEqual([
            {
                ...response[0],
                startDate: '2026-06-03',
                endDate: '2026-06-04',
                allDay: true,
                isAllDay: true,
                startTime: null,
                endTime: null,
                editableByMe: true,
                deletableByMe: true,
                sourceType: 'MANUAL',
            },
        ]);
    });

    it('creates, updates, and deletes board schedules on the schedule endpoints', async () => {
        const payload = {
            title: '신규 교육',
            content: '3층 교육실',
            scheduleDate: '2026-05-12',
            startTime: '14:00',
            endTime: '15:00',
        };

        mockPost.mockResolvedValue({data: {...payload, scheduleId: 1}});
        mockPut.mockResolvedValue({data: {...payload, title: '수정 교육', scheduleId: 1}});
        mockDelete.mockResolvedValue({data: undefined});

        await BoardAPI.createSchedule(287, payload);
        await BoardAPI.updateSchedule(287, 1, {...payload, title: '수정 교육'});
        await BoardAPI.deleteSchedule(287, 1);

        expect(mockPost).toHaveBeenCalledWith('/wards/287/board/schedules', payload);
        expect(mockPut).toHaveBeenCalledWith('/wards/287/board/schedules/1', {...payload, title: '수정 교육'});
        expect(mockDelete).toHaveBeenCalledWith('/wards/287/board/schedules/1');
    });

    it('sends both all-day field names for board schedule create and update payloads', async () => {
        const payload = {
            title: '종일 교육',
            content: '온라인',
            scheduleDate: '2026-05-12',
            startDate: '2026-05-12',
            endDate: '2026-05-12',
            allDay: true,
            startTime: null,
            endTime: null,
        };
        const expectedPayload = {
            ...payload,
            isAllDay: true,
        };

        mockPost.mockResolvedValue({data: {...expectedPayload, scheduleId: 1}});
        mockPut.mockResolvedValue({data: {...expectedPayload, scheduleId: 1}});

        await BoardAPI.createSchedule(287, payload);
        await BoardAPI.updateSchedule(287, 1, payload);

        expect(mockPost).toHaveBeenCalledWith('/wards/287/board/schedules', expectedPayload);
        expect(mockPut).toHaveBeenCalledWith('/wards/287/board/schedules/1', expectedPayload);
    });
});
