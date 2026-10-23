import {expect, it, vi} from 'vitest';
import client from '@/shared/api/client';
import {sendScheduleResultFeedback} from '../schedule-result-feedback';
vi.mock('@/shared/api/client', () => ({default: {post: vi.fn()}}));
it('sends feedback to the original result without calling adjustment', async () => {
    vi.mocked(client.post).mockResolvedValue({status: 200});
    await sendScheduleResultFeedback(
        {flowId: 'flow', serverEventId: 'result', wardId: 1, shiftTeamId: 2, year: 2026, month: 11},
        {satisfaction: 'LIKED', feedbackNote: '', eventId: 'event'},
    );
    expect(client.post).toHaveBeenCalledWith(
        '/wards/1/shift-teams/2/schedule/journey-events',
        {type: 'USER_FEEDBACK', serverEventId: 'result', satisfaction: 'LIKED', feedbackNote: '', eventId: 'event'},
        {suppressErrorToast: true, timeout: 10000},
    );
});
it('propagates delivery failures so the user can retry', async () => {
    vi.mocked(client.post).mockRejectedValueOnce(new Error('offline'));
    await expect(
        sendScheduleResultFeedback(
            {flowId: 'flow', serverEventId: 'result', wardId: 1, shiftTeamId: 2, year: 2026, month: 11},
            {satisfaction: 'NEEDS_WORK', feedbackNote: '휴무 배치', eventId: 'event'},
        ),
    ).rejects.toThrow('offline');
});
