import {describe, expect, it} from 'vitest';
import {isRestShiftOption} from '../nurse-shift-types';
describe('work eligibility and rest classification', () => {
    it('excludes all rest classifications even with custom labels', () => {
        for (const classification of ['OFF', 'ANNUAL_LEAVE', 'OTHER_LEAVE']) {
            expect(isRestShiftOption({classification, isOff: false})).toBe(true);
        }

        expect(isRestShiftOption({isOff: true})).toBe(true);
    });
    it('retains actual work and does not infer from a label', () => {
        for (const classification of ['DAY', 'EVENING', 'NIGHT', 'OTHER_WORK']) {
            expect(isRestShiftOption({classification, isOff: false})).toBe(false);
        }
    });
});
