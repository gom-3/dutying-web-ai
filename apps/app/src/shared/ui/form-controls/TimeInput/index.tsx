import {cn} from '@dutying/utils/style';
import React, {useEffect, useRef, useState} from 'react';
import {normalizeInputWidth} from '@/shared/lib/input-width';
import CompositionInput from '@/shared/ui/form-controls/CompositionInput';

interface ITimeInputProps
    extends Omit<React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, 'onChange' | 'value'> {
    initTime?: string;
    onTimeChange?: (value: string) => void;
}

function TimeInput({initTime, onTimeChange, className, ...props}: ITimeInputProps) {
    const [time, setTime] = useState(initTime ?? '');
    const lastValue = useRef('');
    const isValid = (value: string) => {
        const regexp = /^\d{0,2}?:?\d{0,2}$/;

        if (!regexp.test(value)) {
            return false;
        }

        const [hoursStr, minutesStr] = value.split(':');
        const hours = Number(hoursStr);
        const minutes = Number(minutesStr);
        const isValidHour = (hour: number) => Number.isInteger(hour) && hour >= 0 && hour < 24;
        const isValidMinutes = (minutes: number) => (Number.isInteger(minutes) && hours >= 0 && hours < 24) || Number.isNaN(minutes);

        if (!isValidHour(hours) || !isValidMinutes(minutes)) {
            return false;
        }

        if (minutes < 10 && Number(minutesStr[0]) > 5) {
            return false;
        }

        const valArr = value.indexOf(':') !== -1 ? value.split(':') : [value];

        if (valArr[0]?.length && (parseInt(valArr[0], 10) < 0 || parseInt(valArr[0], 10) > 23)) {
            return false;
        }

        if (valArr[1]?.length && (parseInt(valArr[1], 10) < 0 || parseInt(valArr[1], 10) > 59)) {
            return false;
        }

        return true;
    };
    const handleChange = (rawValue: string) => {
        let value = normalizeInputWidth(rawValue);

        if (value === time) {
            return;
        }

        if (value === '') onTimeChange?.(value);

        if (isValid(value)) {
            if (value.length === 2 && lastValue.current.length === 3) value = value.slice(0, 1);

            if (value.length === 2 && lastValue.current.length === 1) value += ':';

            lastValue.current = value;

            setTime(value);

            if (value.length === 5) {
                onTimeChange?.(value);
            }
        }
    };

    useEffect(() => {
        if (initTime) setTime(initTime);
    }, [initTime]);

    return (
        <CompositionInput
            value={time}
            onValueChange={handleChange}
            variant="foundation"
            fieldSize="md"
            className={cn(
                'rounded-[.625rem] px-6.25 font-poppins text-[2.25rem] outline-1 outline-sub-4 focus:text-main-1 focus:outline-main-1',
                className,
            )}
            {...props}
        />
    );
}

export default TimeInput;
