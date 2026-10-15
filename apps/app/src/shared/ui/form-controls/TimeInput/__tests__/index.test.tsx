import {fireEvent} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import TimeInput from '..';

describe('TimeInput 컴포넌트', () => {
    it('accepts fullwidth time pasted or committed by a Japanese IME', () => {
        const onTimeChange = vi.fn();

        render(<TimeInput onTimeChange={onTimeChange} />);

        const input = screen.getByRole('textbox');

        fireEvent.compositionStart(input);
        fireEvent.change(input, {target: {value: '０９：３０'}});
        expect(input).toHaveValue('０９：３０');
        expect(onTimeChange).not.toHaveBeenCalled();
        fireEvent.compositionEnd(input);
        expect(input).toHaveValue('09:30');
        expect(onTimeChange).toHaveBeenCalledWith('09:30');
        fireEvent.change(input, {target: {value: '１８：００'}});
        expect(input).toHaveValue('18:00');
        expect(onTimeChange).toHaveBeenCalledWith('18:00');
    });
    it('정상적으로 렌더링되어야 함', () => {
        render(<TimeInput />);
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('initTime prop으로 입력 필드가 초기화되어야 함', () => {
        render(<TimeInput initTime="12:34" />);
        expect(screen.getByRole('textbox')).toHaveValue('12:34');
    });

    it('유효한 시간 입력 시 TimeInput의 value가 업데이트되어야 함', async () => {
        render(<TimeInput />);

        const input = screen.getByRole('textbox');

        await userEvent.type(input, '12:34');
        expect(input).toHaveValue('12:34');
    });

    it('유효하지 않은 시간 입력 시 TimeInput의 value는 그대로여야 함', async () => {
        render(<TimeInput initTime="12:34" />);

        const input = screen.getByRole('textbox');

        await userEvent.type(input, '99:99');
        expect(input).toHaveValue('12:34');
    });

    it('사용자 입력마다 onTimeChange가 호출되어야 함', async () => {
        const mockOnTimeChange = vi.fn();

        render(<TimeInput onTimeChange={mockOnTimeChange} />);

        const input = screen.getByRole('textbox');

        await userEvent.type(input, '12:34');
        expect(mockOnTimeChange).toHaveBeenCalledWith('12:34');
    });
});
