import type {TReqShiftCapacitySettings, TWardShiftTypeResponse} from '@dutying/api/ward';
import {describe, expect, it} from 'vitest';
import {capacityDraftRows, capacityDraftRules} from '../request-capacity';

const off = {wardShiftTypeId: 1, classification: 'OFF', isActive: true} as TWardShiftTypeResponse;
const annual = {wardShiftTypeId: 2, classification: 'ANNUAL_LEAVE', isOff: true, isActive: true} as TWardShiftTypeResponse;
const empty = {rules: []} as unknown as TReqShiftCapacitySettings;

describe('request capacity input', () => {
    it('defaults to OFF rather than another leave type and never invents a three-person limit', () => {
        expect(capacityDraftRows(empty, [annual, off])).toEqual([{wardShiftTypeId: 1, teamMax: '', groups: []}]);
        expect(capacityDraftRules(capacityDraftRows(empty, [annual, off]))).toEqual([]);
    });

    it('requires an explicit choice when more than one OFF type exists', () => {
        expect(capacityDraftRows(empty, [off, {...off, wardShiftTypeId: 3}])).toEqual([]);
    });

    it('keeps team and group limits as separate rules and allows group-only limits', () => {
        expect(capacityDraftRules([{wardShiftTypeId: 1, teamMax: '', groups: [{groupId: 10, max: '1'}]}])).toEqual([
            {wardShiftTypeId: 1, groupId: 10, maxPerDay: 1},
        ]);
        expect(capacityDraftRules([{wardShiftTypeId: 1, teamMax: '3', groups: [{groupId: 10, max: '1'}]}])).toHaveLength(2);
    });

    it('rejects fractional, negative, missing group limits and duplicate scopes', () => {
        for (const max of ['-1', '1.5', '1e3', '10001'])
            expect(capacityDraftRules([{wardShiftTypeId: 1, teamMax: max, groups: []}])).toBeNull();

        expect(capacityDraftRules([{wardShiftTypeId: 1, teamMax: '', groups: [{groupId: 10, max: ''}]}])).toBeNull();
        expect(
            capacityDraftRules([
                {
                    wardShiftTypeId: 1,
                    teamMax: '',
                    groups: [
                        {groupId: 10, max: '1'},
                        {groupId: 10, max: '2'},
                    ],
                },
            ]),
        ).toBeNull();
    });

    it('distinguishes zero capacity from no limit', () => {
        expect(capacityDraftRules([{wardShiftTypeId: 1, teamMax: '0', groups: []}])).toEqual([
            {wardShiftTypeId: 1, groupId: null, maxPerDay: 0},
        ]);
    });
});
