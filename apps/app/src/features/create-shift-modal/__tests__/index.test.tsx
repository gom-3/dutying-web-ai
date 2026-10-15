import {fireEvent} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import CreateShiftModal from '../index';

describe('CreateShiftModal', () => {
    beforeEach(() => {
        const modalRoot = document.createElement('div');

        modalRoot.id = 'modal-root';
        document.body.appendChild(modalRoot);
    });

    afterEach(() => {
        document.querySelector('#modal-root')?.remove();
    });

    it('saves a Japanese abbreviation and fullwidth time after composition', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();

        render(<CreateShiftModal open shiftType={null} close={vi.fn()} onSubmit={onSubmit} onDelete={vi.fn()} />);

        const [name, shortName] = screen.getAllByRole('textbox');
        const [start, end] = screen.getAllByDisplayValue('00:00');

        fireEvent.change(name!, {target: {value: '夜勤'}});
        fireEvent.compositionStart(shortName!);
        fireEvent.change(shortName!, {target: {value: 'やきん'}});
        expect(shortName).toHaveValue('やきん');
        fireEvent.change(shortName!, {target: {value: '夜'}});
        fireEvent.compositionEnd(shortName!);
        fireEvent.change(start!, {target: {value: '２２：００'}});
        fireEvent.change(end!, {target: {value: '０７：００'}});
        await user.click(screen.getByRole('button', {name: '저장'}));

        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({name: '夜勤', shortName: '夜', startTime: '22:00', endTime: '07:00'}),
        );
    });

    it('shows inline validation instead of alert when required fields are missing', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();

        render(<CreateShiftModal open shiftType={null} close={vi.fn()} onSubmit={onSubmit} onDelete={vi.fn()} />);

        await user.click(screen.getByRole('button', {name: '저장'}));

        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('근무명을 입력해 주세요.');
    });

    it('clears work-time validation when switching to leave mode', async () => {
        const user = userEvent.setup();

        render(<CreateShiftModal open shiftType={null} close={vi.fn()} onSubmit={vi.fn()} onDelete={vi.fn()} />);

        const [nameInput, shortNameInput] = screen.getAllByRole('textbox');
        const [startTimeInput, endTimeInput] = screen.getAllByDisplayValue('00:00');

        await user.type(nameInput!, 'Day');
        await user.type(shortNameInput!, 'D');
        await user.clear(startTimeInput);
        await user.clear(endTimeInput);
        await user.click(screen.getByRole('button', {name: '저장'}));

        expect(screen.getByRole('alert')).toHaveTextContent('근무 시간을 입력해 주세요.');

        await user.click(screen.getByText('휴가'));

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('rejects a short name whose first character is already used', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();

        render(
            <CreateShiftModal open shiftType={null} existingShortNames={['N']} close={vi.fn()} onSubmit={onSubmit} onDelete={vi.fn()} />,
        );

        const [nameInput, shortNameInput] = screen.getAllByRole('textbox');

        await user.type(nameInput!, '데이');
        await user.type(shortNameInput!, 'N');
        await user.click(screen.getByRole('button', {name: '저장'}));

        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('약자의 첫 글자가 겹치지 않게 입력해 주세요.');
    });
});
