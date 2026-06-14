import {create} from 'zustand';

type TNavigationBarFoldSource = 'auto' | 'user';

type TNavigationBarFoldStore = {
    isFold: boolean;
    lastChangeSource: TNavigationBarFoldSource;
    setFold: (isFold: boolean, source?: TNavigationBarFoldSource) => void;
    collapse: (source?: TNavigationBarFoldSource) => void;
    expand: (source?: TNavigationBarFoldSource) => void;
    reset: () => void;
};

export const useNavigationBarFoldStore = create<TNavigationBarFoldStore>((set) => ({
    isFold: false,
    lastChangeSource: 'auto',
    setFold: (isFold, source = 'user') => set({isFold, lastChangeSource: source}),
    collapse: (source = 'auto') => set({isFold: true, lastChangeSource: source}),
    expand: (source = 'auto') => set({isFold: false, lastChangeSource: source}),
    reset: () => set({isFold: false, lastChangeSource: 'auto'}),
}));
