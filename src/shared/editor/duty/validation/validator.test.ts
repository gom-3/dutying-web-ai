import {describe, expect, it} from 'vitest';
import type {DutyDoc} from '../doc';
import {createDutyValidator} from './validator';

const baseConstraint = {
    maxContinuousWork: false,
    maxContinuousWorkVal: 3,
    minNightInterval: false,
    minNightIntervalVal: 3,
    maxContinuousNight: false,
    maxContinuousNightVal: 2,
    minContinuousNight: false,
    minContinuousNightVal: 2,
    minOffAssignAfterNight: false,
    minOffAssignAfterNightVal: 2,
    excludeCertainWorkTypes: false,
    excludeNightBeforeReqOff: false,
};

describe('duty/validation/createDutyValidator', () => {
    it('maxContinuousWork 위반을 잡는다', () => {
        const doc: DutyDoc = {
            columns: ['d1', 'd2', 'd3', 'd4'],
            rows: [{workerId: 'w1', cells: ['D', 'E', 'N', 'D']}],
            workerMeta: {w1: {name: 'Kim'}},
        };
        const validator = createDutyValidator({
            wardConstraint: {...baseConstraint, maxContinuousWork: true, maxContinuousWorkVal: 3},
        });
        const v = validator(doc);

        expect(v.some((x) => x.ruleId === 'duty.maxContinuousWork')).toBe(true);
    });

    it('minNightInterval 위반을 잡는다', () => {
        const doc: DutyDoc = {
            columns: ['d1', 'd2', 'd3'],
            rows: [{workerId: 'w1', cells: ['N', 'D', 'N']}], // n d n (간격 1)
            workerMeta: {w1: {name: 'Kim'}},
        };
        const validator = createDutyValidator({
            wardConstraint: {...baseConstraint, minNightInterval: true, minNightIntervalVal: 3},
        });
        const v = validator(doc);

        expect(v.some((x) => x.ruleId === 'duty.minNightInterval')).toBe(true);
    });

    it('minContinuousNight 위반을 잡는다', () => {
        const doc: DutyDoc = {
            columns: ['d1', 'd2', 'd3'],
            rows: [{workerId: 'w1', cells: ['D', 'N', 'D']}], // 단일 나이트
            workerMeta: {w1: {name: 'Kim'}},
        };
        const validator = createDutyValidator({
            wardConstraint: {...baseConstraint, minContinuousNight: true, minContinuousNightVal: 2},
        });
        const v = validator(doc);

        expect(v.some((x) => x.ruleId === 'duty.minContinuousNight')).toBe(true);
    });

    it('minOffAssignAfterNight 위반을 잡는다', () => {
        const doc: DutyDoc = {
            columns: ['d1', 'd2'],
            rows: [{workerId: 'w1', cells: ['N', 'D']}], // n d
            workerMeta: {w1: {name: 'Kim'}},
        };
        const validator = createDutyValidator({
            wardConstraint: {...baseConstraint, minOffAssignAfterNight: true, minOffAssignAfterNightVal: 2},
        });
        const v = validator(doc);

        expect(v.some((x) => x.ruleId === 'duty.minOffAssignAfterNight')).toBe(true);
    });

    it('excludeCertainWorkTypes 위반을 잡는다 (ed)', () => {
        const doc: DutyDoc = {
            columns: ['d1', 'd2'],
            rows: [{workerId: 'w1', cells: ['E', 'D']}], // e d
            workerMeta: {w1: {name: 'Kim'}},
        };
        const validator = createDutyValidator({
            wardConstraint: {...baseConstraint, excludeCertainWorkTypes: true},
        });
        const v = validator(doc);

        expect(v.some((x) => x.ruleId === 'duty.excludeCertainWorkTypes')).toBe(true);
    });

    it('excludeNightBeforeReqOff 위반을 잡는다 (nO)', () => {
        const doc: DutyDoc = {
            columns: ['d1', 'd2'],
            rows: [{workerId: 'w1', cells: ['N', null]}],
            workerMeta: {w1: {name: 'Kim'}},
        };
        const validator = createDutyValidator({
            wardConstraint: {...baseConstraint, excludeNightBeforeReqOff: true},
            mode: {requestedOffByRow: [[false, true]]},
        });
        const v = validator(doc);

        expect(v.some((x) => x.ruleId === 'duty.excludeNightBeforeReqOff')).toBe(true);
    });
});
