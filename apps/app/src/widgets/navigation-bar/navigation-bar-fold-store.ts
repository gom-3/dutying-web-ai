import {create} from 'zustand';

type TNavigationBarFoldStore = {
    isFold: boolean;
    setFold: (isFold: boolean) => void;
    collapse: () => void;
};

export const useNavigationBarFoldStore = create<TNavigationBarFoldStore>((set) => ({
    isFold: false,
    setFold: (isFold) => set({isFold}),
    collapse: () => set({isFold: true}),
}));
