import type {TScheduleObservation} from '@dutying/api/ward';
import client from '@/shared/api/client';

export type TScheduleSatisfaction = 'LIKED' | 'NEEDS_WORK';
export type TScheduleFeedback = {satisfaction: TScheduleSatisfaction; feedbackNote: string; eventId: string};

/** Explicit user submission: unlike background receipts, HTTP failures must reach the UI. */
export async function sendScheduleResultFeedback(observation: TScheduleObservation, feedback: TScheduleFeedback): Promise<void> {
    await client.post(
        `/wards/${observation.wardId}/shift-teams/${observation.shiftTeamId}/schedule/journey-events`,
        {
            type: 'USER_FEEDBACK',
            serverEventId: observation.serverEventId,
            ...feedback,
        },
        {suppressErrorToast: true, timeout: 10000},
    );
}
