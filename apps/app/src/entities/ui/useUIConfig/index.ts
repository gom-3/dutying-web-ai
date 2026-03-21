import {useUIConfigStore} from './store';

type TShiftTypeColorStyle = 'background' | 'text';

const useUIConfigUseCase = () => {
    const setState = useUIConfigStore((state) => state.setState);
    const handleChangeSeparateWeekendColor = (value: boolean) => {
        setState('separateWeekendColor', value);
    };
    const handleShiftTypeColorStyle = (value: TShiftTypeColorStyle) => {
        setState('shiftTypeColorStyle', value);
    };

    return {
        handleChangeSeparateWeekendColor,
        handleShiftTypeColorStyle,
    };
};

export default useUIConfigUseCase;
