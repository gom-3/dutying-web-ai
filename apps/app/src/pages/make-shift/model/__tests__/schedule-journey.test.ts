import {beforeEach, describe, expect, it, vi} from 'vitest';
const post = vi.fn();
vi.mock('@/shared/api/client', () => ({default: {post}}));
vi.mock('@/features/auth/model/store', () => ({default: {getState: () => ({accountId: 4})}}));
const observation = {flowId: 'flow', serverEventId: 'result', wardId: 1, shiftTeamId: 2, year: 2026, month: 10};

beforeEach(() => {
    vi.resetModules();
    post.mockReset();
    sessionStorage.clear();
});
describe('schedule journey evidence', () => {
    it('keeps flow IDs stable across attempts and separates month and team', async () => {
        const {scheduleJourneyId} = await import('../schedule-journey');
        const id = scheduleJourneyId(1, 2, 2026, 10);
        expect(scheduleJourneyId(1, 2, 2026, 10)).toBe(id);
        expect(scheduleJourneyId(1, 2, 2026, 11)).not.toBe(id);
        expect(scheduleJourneyId(1, 3, 2026, 10)).not.toBe(id);
    });
    it('does not fabricate a report for an old server without observation metadata', async () => {
        const {reportScheduleJourney} = await import('../schedule-journey');
        await reportScheduleJourney(undefined, {type: 'CLIENT_DISPLAYED', displayedText: 'hello'});
        expect(post).not.toHaveBeenCalled();
    });
    it('deduplicates a committed UI snapshot and reuses the event ID on network retry', async () => {
        post.mockRejectedValueOnce(new Error('lost response')).mockResolvedValue({status: 204});
        const {reportScheduleJourney} = await import('../schedule-journey');
        await reportScheduleJourney(observation, {type: 'CLIENT_DISPLAYED', displayedText: '휴무 설정 확인'});
        await reportScheduleJourney(observation, {type: 'CLIENT_DISPLAYED', displayedText: '휴무 설정 확인'});
        expect(post).toHaveBeenCalledTimes(2);
        expect(post.mock.calls[0][1].eventId).toBe(post.mock.calls[1][1].eventId);
        expect(post.mock.calls[0][1]).toMatchObject({type: 'CLIENT_DISPLAYED', serverEventId: 'result', displayedText: '휴무 설정 확인'});
    });
    it('keeps background authorization failures away from global error side effects', async () => {
        post.mockResolvedValue({status: 401});
        const {reportScheduleJourney} = await import('../schedule-journey');
        await reportScheduleJourney(observation, {type: 'CLIENT_DISPLAYED', displayedText: 'ready'});
        expect(post).toHaveBeenCalledTimes(1);
        expect(post.mock.calls[0][2].validateStatus(401)).toBe(true);
    });
    it('a telemetry failure does not fail the scheduling action', async () => {
        post.mockRejectedValue(new Error('offline'));
        const {reportScheduleJourney} = await import('../schedule-journey');
        await expect(reportScheduleJourney(observation, {type: 'CLIENT_APPLIED', changedCellCount: 2})).resolves.toBeUndefined();
    });
    it('tracks only an applied result for confirmation correlation and clears on undo', async () => {
        post.mockResolvedValue({status: 204});
        const {reportScheduleJourney, lastAppliedScheduleObservation} = await import('../schedule-journey');
        await reportScheduleJourney(observation, {type: 'CLIENT_DISPLAYED', displayedText: 'ready'});
        expect(lastAppliedScheduleObservation(1, 2, 2026, 10)).toBeUndefined();
        await reportScheduleJourney(observation, {type: 'CLIENT_APPLIED', changedCellCount: 2});
        expect(lastAppliedScheduleObservation(1, 2, 2026, 10)).toEqual(observation);
        await reportScheduleJourney(observation, {type: 'CLIENT_UNDONE'});
        expect(lastAppliedScheduleObservation(1, 2, 2026, 10)).toBeUndefined();
    });
});
