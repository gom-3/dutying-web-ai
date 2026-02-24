import {createStore} from '@/shared/util/create-store';

const initialState = {
    selectedNurseId: null as number | null,
};
const useEditNurseStore = createStore(initialState, {
    name: 'useEditNurseStore',
    persist: false,
});

export default useEditNurseStore;
