import {fireEvent, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {render, userEvent} from '@/shared/util/test-utils';
import type {TOnboardingWardShiftType} from '../../../model';
import {createInitialDraft} from '../../../model';
import {ShiftTypeStep, ShiftTypeRequirements} from '../shift-type-step';

const createUnassignedNightShiftType = (): TOnboardingWardShiftType => ({
    id: 'schedule-night',
    name: '야간 코드',
    shortName: 'X',
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
    it('commits Japanese abbreviations and fullwidth times after IME conversion', () => {
        const draft = createInitialDraft();
        const shift = draft.shiftTypes[0]!;
        const onChange = vi.fn();

        render(
            <ShiftTypeStep
                shiftTypes={[shift]}
                rotationMode="THREE"
                onChange={onChange}
                onDelete={vi.fn()}
                onAdd={vi.fn()}
                onDragEnd={vi.fn()}
            />,
        );

        const shortName = screen.getByDisplayValue(shift.shortName);
        const time = screen.getByDisplayValue(shift.startTime);

        fireEvent.compositionStart(shortName);
        fireEvent.change(shortName, {target: {value: 'にっきん'}});
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.change(shortName, {target: {value: '日勤'}});
        fireEvent.compositionEnd(shortName);
        expect(onChange).toHaveBeenCalledWith(shift.id, {shortName: '日勤'});
        fireEvent.compositionStart(time);
        fireEvent.change(time, {target: {value: '０９：３０'}});
        fireEvent.compositionEnd(time);
        expect(onChange).toHaveBeenCalledWith(shift.id, {startTime: '09:30'});
    });

    it('blocks deleting or reclassifying the last annual leave and permits editing its name', async () => {
        const user = userEvent.setup();
        const draft = createInitialDraft();
        const annual = draft.shiftTypes.find((shift) => shift.classification === 'ANNUAL_LEAVE')!;
        const onChange = vi.fn();
        const onDelete = vi.fn();

        render(
            <ShiftTypeStep
                shiftTypes={[annual]}
                rotationMode="THREE"
                onChange={onChange}
                onDelete={onDelete}
                onAdd={vi.fn()}
                onDragEnd={vi.fn()}
            />,
        );

        const deleteButton = screen.getByRole('button', {name: '연차 삭제'});

        expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
        await user.click(deleteButton);
        expect(onDelete).not.toHaveBeenCalled();
        await user.click(screen.getByRole('combobox', {name: '연차 근무 의미 선택'}));
        await user.click(screen.getByRole('option', {name: '기타 휴무'}));
        expect(onChange).not.toHaveBeenCalled();
        await user.type(screen.getByDisplayValue('연차'), '휴');
        expect(onChange).toHaveBeenCalled();
    });

    it('marks annual leave with multiple units as ready and ignores inactive units', () => {
        const draft = createInitialDraft();
        const annual = draft.shiftTypes.find((shift) => shift.classification === 'ANNUAL_LEAVE')!;
        const {rerender} = render(
            <ShiftTypeRequirements shiftTypes={[...draft.shiftTypes, {...annual, id: 'half-day', shortName: 'H'}]} rotationMode="THREE" />,
        );

        expect(screen.getByRole('status')).toHaveTextContent('5');
        expect(screen.queryByText('2개 중복')).not.toBeInTheDocument();
        rerender(
            <ShiftTypeRequirements
                shiftTypes={draft.shiftTypes.map((shift) =>
                    shift.classification === 'ANNUAL_LEAVE' ? {...shift, isActive: false} : shift,
                )}
                rotationMode="THREE"
            />,
        );
        expect(screen.getByText('추가가 필요해요')).toBeInTheDocument();
    });
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

    it('2교대에서 선택적인 야간 후반부를 근무 유형으로 설정한다', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const customShiftType: TOnboardingWardShiftType = {
            ...createUnassignedNightShiftType(),
            id: 'night-continuation',
            name: '야간 후반부',
            shortName: 'NC',
            startTime: '09:00',
            endTime: '18:00',
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
                rotationMode="TWO"
                allowNightContinuation
                onChange={onChange}
                onDragEnd={vi.fn()}
                onAdd={vi.fn()}
                onDelete={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('combobox', {name: '야간 후반부 근무 의미 선택'}));
        await user.click(screen.getByRole('option', {name: '퇴근일 근무'}));

        expect(onChange).toHaveBeenCalledWith('night-continuation', {
            classification: 'NIGHT_CONTINUATION',
            isOff: false,
            isCounted: false,
            rotationSystem: 'TWO',
            paidMinutes: 0,
            startTime: '00:00',
            endTime: '07:00',
            mappingStatus: 'CONFIRMED',
        });
    });

    it('일반 오프를 선택한 2교대에서는 퇴근일 근무를 선택지에서 숨긴다', async () => {
        const user = userEvent.setup();

        render(
            <ShiftTypeStep
                shiftTypes={[createUnassignedNightShiftType()]}
                rotationMode="TWO"
                allowNightContinuation={false}
                onChange={vi.fn()}
                onDragEnd={vi.fn()}
                onAdd={vi.fn()}
                onDelete={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('combobox', {name: '야간 코드 근무 의미 선택'}));

        expect(screen.queryByRole('option', {name: '퇴근일 근무'})).not.toBeInTheDocument();
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
