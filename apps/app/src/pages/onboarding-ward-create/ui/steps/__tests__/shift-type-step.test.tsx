import {screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {render, userEvent} from '@/shared/util/test-utils';
import type {TOnboardingWardShiftType} from '../../../model';
import {ShiftTypeStep} from '../shift-type-step';

const createUnassignedNightShiftType = (): TOnboardingWardShiftType => ({
    id: 'schedule-night',
    name: '야간 코드',
    shortName: '1',
    startTime: '19:00',
    endTime: '07:00',
    color: '#3580FF',
    isDefault: false,
    isOff: false,
    isCounted: true,
    classification: 'OTHER_WORK',
    rotationSystem: 'NONE',
    paidMinutes: null,
    source: 'schedule-input',
    protectedByPreviousSchedule: true,
    mappingStatus: 'UNASSIGNED',
    mappingRecommendation: {classification: 'NIGHT', rotationSystem: 'TWO', reason: 'TIME'},
});

describe('ShiftTypeStep', () => {
    it('혼합 교대의 미확정 야간 근무에서 3교대와 2교대를 모두 직접 선택할 수 있다', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <ShiftTypeStep
                shiftTypes={[createUnassignedNightShiftType()]}
                rotationMode="MIXED"
                onChange={onChange}
                onDragEnd={vi.fn()}
                onAdd={vi.fn()}
                onDelete={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('combobox', {name: '야간 코드 교대제 선택'}));

        expect(screen.getByRole('option', {name: '3교대'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '2교대'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '해당 없음'})).toBeInTheDocument();

        await user.click(screen.getByRole('option', {name: '2교대'}));

        expect(onChange).toHaveBeenCalledWith(
            'schedule-night',
            expect.objectContaining({
                classification: 'NIGHT',
                rotationSystem: 'TWO',
                mappingStatus: 'CONFIRMED',
                startTime: '19:00',
                endTime: '07:00',
            }),
        );
    });

    it('혼합 교대의 기타 근무는 교대제를 해당 없음으로 고정한다', () => {
        const customShiftType: TOnboardingWardShiftType = {
            ...createUnassignedNightShiftType(),
            id: 'custom-work',
            name: '교육',
            shortName: 'W',
            classification: 'OTHER_WORK',
            rotationSystem: 'NONE',
            source: undefined,
            protectedByPreviousSchedule: false,
            mappingStatus: 'CONFIRMED',
            mappingRecommendation: undefined,
        };

        render(
            <ShiftTypeStep
                shiftTypes={[customShiftType]}
                rotationMode="MIXED"
                onChange={vi.fn()}
                onDragEnd={vi.fn()}
                onAdd={vi.fn()}
                onDelete={vi.fn()}
            />,
        );

        expect(screen.queryByRole('combobox', {name: '교육 교대제 선택'})).not.toBeInTheDocument();
        expect(screen.getByText('해당 없음')).toBeInTheDocument();
    });

    it('기타 휴무는 저장된 isOff 값과 관계없이 근무시간을 하이픈으로 고정한다', () => {
        const otherLeaveShiftType: TOnboardingWardShiftType = {
            ...createUnassignedNightShiftType(),
            id: 'other-leave',
            name: '특별 휴가',
            shortName: 'L',
            classification: 'OTHER_LEAVE',
            rotationSystem: 'NONE',
            isOff: false,
            source: undefined,
            protectedByPreviousSchedule: false,
            mappingStatus: 'CONFIRMED',
            mappingRecommendation: undefined,
        };

        render(
            <ShiftTypeStep
                shiftTypes={[otherLeaveShiftType]}
                rotationMode="MIXED"
                onChange={vi.fn()}
                onDragEnd={vi.fn()}
                onAdd={vi.fn()}
                onDelete={vi.fn()}
            />,
        );

        const timeInputs = screen.getAllByDisplayValue('-');

        expect(timeInputs).toHaveLength(2);
        expect(timeInputs.every((input) => input.hasAttribute('disabled'))).toBe(true);
    });
});
