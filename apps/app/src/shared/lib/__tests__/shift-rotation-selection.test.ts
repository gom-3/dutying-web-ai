import {describe, expect, it} from 'vitest';
import {
    getDefaultTimeRangeForRotation,
    getFirstAvailableClassificationForRotation,
    getRequiredRotationClassificationCounts,
    getSelectableClassificationsForRotation,
    getSelectableClassificationsForWardMode,
    getSelectableRotationSystemsForClassification,
    getSelectableShiftRotationSystemsForWardMode,
    getRequiredRotationClassifications,
} from '../shift-rotation-selection';

describe('shift rotation selection', () => {
    it('limits classifications by the selected rotation system', () => {
        expect(getSelectableClassificationsForRotation('THREE')).toEqual(['DAY', 'EVENING', 'NIGHT']);
        expect(getSelectableClassificationsForRotation('TWO')).toEqual(['DAY', 'NIGHT', 'NIGHT_CONTINUATION']);
        expect(getSelectableClassificationsForRotation('NONE')).toEqual(['OFF', 'OTHER_WORK', 'ANNUAL_LEAVE', 'OTHER_LEAVE']);
        expect(getSelectableClassificationsForRotation('NONE', {primaryOff: true})).toEqual(['OFF']);
    });

    it('chooses the first unused compatible classification', () => {
        expect(
            getFirstAvailableClassificationForRotation({
                rotationSystem: 'TWO',
                currentClassification: 'OTHER_WORK',
                usedClassifications: new Set(['DAY']),
            }),
        ).toBe('NIGHT');
    });

    it('limits rotation systems to the ward rotation mode', () => {
        expect(getSelectableShiftRotationSystemsForWardMode('THREE')).toEqual(['THREE', 'NONE']);
        expect(getSelectableShiftRotationSystemsForWardMode('TWO')).toEqual(['TWO', 'NONE']);
        expect(getSelectableShiftRotationSystemsForWardMode('MIXED')).toEqual(['THREE', 'TWO', 'NONE']);
    });

    it('keeps classification dropdowns broad while constraining their valid rotation axis', () => {
        expect(getSelectableClassificationsForWardMode('THREE')).toEqual([
            'DAY',
            'EVENING',
            'NIGHT',
            'OFF',
            'OTHER_WORK',
            'ANNUAL_LEAVE',
            'OTHER_LEAVE',
        ]);
        expect(getSelectableClassificationsForWardMode('TWO')).toEqual([
            'DAY',
            'NIGHT',
            'NIGHT_CONTINUATION',
            'OFF',
            'OTHER_WORK',
            'ANNUAL_LEAVE',
            'OTHER_LEAVE',
        ]);
        expect(getSelectableRotationSystemsForClassification('MIXED', 'DAY')).toEqual(['THREE', 'TWO']);
        expect(getSelectableRotationSystemsForClassification('MIXED', 'EVENING')).toEqual(['THREE']);
        expect(getSelectableRotationSystemsForClassification('MIXED', 'NIGHT_CONTINUATION')).toEqual(['TWO']);
        expect(getSelectableRotationSystemsForClassification('THREE', 'NIGHT_CONTINUATION')).toEqual([]);
        expect(getSelectableRotationSystemsForClassification('MIXED', 'OFF')).toEqual(['NONE']);
        expect(getSelectableRotationSystemsForClassification('MIXED', 'ANNUAL_LEAVE')).toEqual(['NONE']);
    });

    it('describes the exact required semantic slots for each ward mode', () => {
        expect(getRequiredRotationClassifications('TWO')).toEqual([
            {rotationSystem: 'TWO', classification: 'DAY'},
            {rotationSystem: 'TWO', classification: 'NIGHT'},
            {rotationSystem: 'NONE', classification: 'OFF'},
        ]);
        expect(getRequiredRotationClassifications('TWO', {includeNightContinuation: true})).toEqual([
            {rotationSystem: 'TWO', classification: 'DAY'},
            {rotationSystem: 'TWO', classification: 'NIGHT'},
            {rotationSystem: 'TWO', classification: 'NIGHT_CONTINUATION'},
            {rotationSystem: 'NONE', classification: 'OFF'},
        ]);
        expect(getRequiredRotationClassifications('MIXED')).toHaveLength(6);
    });

    it('counts every required semantic slot independently', () => {
        expect(
            getRequiredRotationClassificationCounts('MIXED', [
                {rotationSystem: 'THREE', classification: 'DAY'},
                {rotationSystem: 'THREE', classification: 'DAY'},
                {rotationSystem: 'TWO', classification: 'DAY'},
                {rotationSystem: 'NONE', classification: 'OFF'},
            ]),
        ).toEqual([
            {rotationSystem: 'THREE', classification: 'DAY', count: 2},
            {rotationSystem: 'THREE', classification: 'EVENING', count: 0},
            {rotationSystem: 'THREE', classification: 'NIGHT', count: 0},
            {rotationSystem: 'TWO', classification: 'DAY', count: 1},
            {rotationSystem: 'TWO', classification: 'NIGHT', count: 0},
            {rotationSystem: 'NONE', classification: 'OFF', count: 1},
        ]);
    });

    it('provides canonical two-shift time ranges', () => {
        expect(getDefaultTimeRangeForRotation('TWO', 'DAY')).toEqual({startTime: '07:00', endTime: '19:00'});
        expect(getDefaultTimeRangeForRotation('TWO', 'NIGHT')).toEqual({startTime: '19:00', endTime: '07:00'});
        expect(getDefaultTimeRangeForRotation('TWO', 'NIGHT_CONTINUATION')).toEqual({startTime: '00:00', endTime: '07:00'});
    });
});
