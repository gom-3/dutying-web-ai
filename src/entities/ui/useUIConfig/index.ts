import {useUIConfigStore} from './store';

type ShiftTypeColorStyle = 'background' | 'text';

const useUIConfigUseCase = () => {
    const setState = useUIConfigStore((state) => state.setState);
    const handleChangeSeparateWeekendColor = (value: boolean) => {
        setState('separateWeekendColor', value);
    };
    const handleShiftTypeColorStyle = (value: ShiftTypeColorStyle) => {
        setState('shiftTypeColorStyle', value);
    };

    return {
        handleChangeSeparateWeekendColor,
        handleShiftTypeColorStyle,
    };
};

export default useUIConfigUseCase;
