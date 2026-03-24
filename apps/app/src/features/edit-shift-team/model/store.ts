import {createStore} from '@/shared/util/create-store';

export type TNurseDrawerMode = 'create' | 'edit';
export type TNurseSaveStatus = 'idle' | 'saving' | 'success' | 'error';

const initialState = {
    selectedNurseId: null as number | null,
    selectedNurseDrawerMode: 'edit' as TNurseDrawerMode,
    isNurseDraftDirty: false,
    nurseSaveStatus: 'idle' as TNurseSaveStatus,
    isAddingNurse: false,
    isDeletingNurse: false,
};
const useEditNurseStore = createStore(initialState, {
    name: 'useEditNurseStore',
    persist: false,
});

export default useEditNurseStore;
