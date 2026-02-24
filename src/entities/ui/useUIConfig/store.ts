import {createStore} from '@/shared/util/create-store';

const initialState = {
    separateWeekendColor: false,
    shiftTypeColorStyle: 'background',
};

export const useUIConfigStore = createStore(initialState, {
    name: 'useUIConfigStore',
});
