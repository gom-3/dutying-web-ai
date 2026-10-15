import {fireEvent} from '@testing-library/react';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {normalizeShiftShortNameInput} from '@/shared/lib/shift-short-name';
import {render, screen} from '@/shared/util/test-utils';
import CompositionInput from '..';

describe('CompositionInput', () => {
    it('keeps the entire IME draft and normalizes the abbreviation only after conversion', () => {
        const onCommit = vi.fn();

        function Field() {
            const [value, setValue] = useState('');

            return (
                <CompositionInput
                    value={value}
                    onValueChange={(next) => {
                        onCommit(next);
                        setValue(normalizeShiftShortNameInput(next));
                    }}
                />
            );
        }

        render(<Field />);

        const input = screen.getByRole('textbox');

        fireEvent.compositionStart(input);
        fireEvent.change(input, {target: {value: 'にっきん'}});
        expect(input).toHaveValue('にっきん');
        expect(onCommit).not.toHaveBeenCalled();
        fireEvent.change(input, {target: {value: '日勤'}});
        fireEvent.compositionEnd(input, {data: '日勤'});
        expect(input).toHaveValue('日勤');
        expect(onCommit).toHaveBeenCalledWith('日勤');
    });

    it('applies the name limit after IME conversion', () => {
        const onValueChange = vi.fn();

        render(<CompositionInput value="" maxLength={12} onValueChange={onValueChange} />);

        const input = screen.getByRole('textbox');

        fireEvent.compositionStart(input);
        fireEvent.change(input, {target: {value: 'にっきんにっきんにっきんにっきん'}});
        expect(input).toHaveValue('にっきんにっきんにっきんにっきん');
        expect(onValueChange).not.toHaveBeenCalled();
        fireEvent.change(input, {target: {value: '日勤日勤日勤日勤'}});
        fireEvent.compositionEnd(input);
        expect(onValueChange).toHaveBeenCalledWith('日勤日勤日勤日勤');
    });
});
