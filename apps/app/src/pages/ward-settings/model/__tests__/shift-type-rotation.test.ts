import {describe, expect, it} from 'vitest';
import type {TWardShiftType} from '@/entities/ward';
import {inferWardRotationMode, resolveWardShiftRotationSystem} from '../shift-type-rotation';

function shiftType(overrides: Partial<TWardShiftType> = {}): TWardShiftType {
    return {
        wardShiftTypeId: 1,
        name: '데이',
        shortName: 'D',
        startTime: '07:00',
        endTime: '15:00',
        color: '#63C8B8',
        isDefault: true,
        isOff: false,
        isCounted: true,
        classification: 'DAY',
        rotationSystem: 'THREE',
        isActive: true,
        ...overrides,
    };
}

describe('shift type rotation selection', () => {
    it('uses explicit classification and rotation metadata instead of the display symbol', () => {
        expect(resolveWardShiftRotationSystem(shiftType({shortName: '1', isDefault: false}))).toBe('THREE');
        expect(
            resolveWardShiftRotationSystem(shiftType({shortName: '1', isDefault: false, classification: 'DAY', rotationSystem: 'TWO'})),
        ).toBe('TWO');
    });

    it('does not override an explicit rotation from a circled legacy symbol', () => {
        const explicitThree = shiftType({shortName: 'ⓓ', isDefault: false, rotationSystem: 'THREE'});

        expect(resolveWardShiftRotationSystem(explicitThree)).toBe('THREE');
    });

    it('keeps a circled-symbol fallback only when legacy data has no rotation metadata', () => {
        const legacy = shiftType({shortName: 'ⓓ', isDefault: false, rotationSystem: undefined});

        expect(resolveWardShiftRotationSystem(legacy)).toBe('TWO');
        expect(inferWardRotationMode([legacy])).toBe('TWO');
    });

    it('forces non-rotation classifications onto NONE', () => {
        const support = shiftType({shortName: 'S', isDefault: false, classification: 'OTHER_WORK', rotationSystem: 'THREE'});

        expect(resolveWardShiftRotationSystem(support)).toBe('NONE');
    });

    it('infers three-shift two-shift and mixed modes from active stored rows', () => {
        const three = shiftType();
        const two = shiftType({wardShiftTypeId: 2, shortName: '1', rotationSystem: 'TWO'});

        expect(inferWardRotationMode([three])).toBe('THREE');
        expect(inferWardRotationMode([two])).toBe('TWO');
        expect(inferWardRotationMode([three, two])).toBe('MIXED');
        expect(inferWardRotationMode([three, {...two, isActive: false}])).toBe('THREE');
    });
});
