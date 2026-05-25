import {useCallback, useEffect} from 'react';
import {type TRequestShift} from '@/entities/shift';
import {type TFocus} from './types';
import {moveFocus} from './utils';

type TUseRequestShiftKeyboardParams = {
    activeEffect: boolean;
    focus: TFocus | null;
    requestShift: TRequestShift | null | undefined;
    setFocus: (focus: TFocus | null) => void;
};

export const useRequestShiftKeyboard = ({
    activeEffect,
    focus,
    requestShift,
    setFocus,
}: TUseRequestShiftKeyboardParams) => {
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (['Ctrl', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }

            const ctrlKey = e.ctrlKey || e.metaKey;

            if (!focus || !requestShift) return;

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                moveFocus(
                    e.key.replace('Arrow', '').toLowerCase() as 'left' | 'right' | 'up' | 'down',
                    ctrlKey,
                    requestShift,
                    focus,
                    setFocus,
                );
            }
        },
        [focus, requestShift, setFocus],
    );

    useEffect(() => {
        if (!activeEffect) return;

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeEffect, handleKeyDown]);
};
