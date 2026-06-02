import {create} from 'zustand';

type TNavigationBarFoldStore = {
    isFold: boolean;
    setFold: (isFold: boolean) => void;
    collapse: () => void;
    reset: () => void;
};

export const useNavigationBarFoldStore = create<TNavigationBarFoldStore>((set) => ({
    isFold: false,
    setFold: (isFold) => set({isFold}),
    collapse: () => set({isFold: true}),
    reset: () => set({isFold: false}),
}));
