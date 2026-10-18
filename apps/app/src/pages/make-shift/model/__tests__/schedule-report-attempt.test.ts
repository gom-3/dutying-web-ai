import {describe, expect, it, vi} from 'vitest';
import {ScheduleReportAttempt} from '../schedule-report-attempt';

describe('report action keys', () => {
    const create = () => {
        let sequence = 0;

        const uuid = vi.fn(() => `key-${++sequence}`);

        return {action: new ScheduleReportAttempt(uuid), uuid};
    };

    it('reuses the action key on an unchanged retry, including trimmed whitespace', () => {
        const {action, uuid} = create();
        const key = action.keyFor('owner:ward:team:conversation:operation', ' 의견 ');

        action.noteChanged('의견  ');
        expect(action.keyFor('owner:ward:team:conversation:operation', '의견')).toBe(key);
        expect(uuid).toHaveBeenCalledOnce();
    });
    it('changes the key for every new scope or submitted content', () => {
        const {action} = create();
        const first = action.keyFor('scope:1', '의견');
        const second = action.keyFor('scope:2', '의견');
        const third = action.keyFor('scope:2', '다른 의견');

        expect(new Set([first, second, third]).size).toBe(3);
    });
    it('does not reuse a failed action after editing away and back to the original note', () => {
        const {action} = create();
        const first = action.keyFor('scope:1', '의견');

        action.noteChanged('다른 의견');
        action.noteChanged('의견');
        expect(action.keyFor('scope:1', '의견')).not.toBe(first);
    });
    it('starts a new action after success or deliberate cancellation', () => {
        const {action} = create();
        const first = action.keyFor('scope:1', '의견');

        action.reset();
        expect(action.keyFor('scope:1', '의견')).not.toBe(first);
    });
});
