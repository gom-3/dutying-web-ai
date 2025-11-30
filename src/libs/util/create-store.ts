import type {StateCreator, StoreApi, UseBoundStore} from 'zustand';
import {devtools, persist, type PersistOptions} from 'zustand/middleware';
import {shallow} from 'zustand/shallow';
import {createWithEqualityFn} from 'zustand/traditional';

export type TStoreActions<S extends object> = {
    setState: <K extends keyof S>(key: K, value: S[K]) => void;
    patch: (partial: Partial<S> | ((prev: S) => Partial<S>)) => void;
    reset: () => void;
};

export type TStoreOf<S extends object> = S & TStoreActions<S>;

type TOptions<S extends object> = {
    name: string;
    persist?: boolean;
    devtools?: boolean;
    persistOptions?: Omit<PersistOptions<TStoreOf<S>>, 'name'>;
    equalityFn?: typeof shallow;
};

export function createStore<S extends object>(initialState: S, opts: TOptions<S>): UseBoundStore<StoreApi<TStoreOf<S>>> {
    const {name, persist: usePersist = false, devtools: useDevtools = true, persistOptions, equalityFn = shallow} = opts;
    const baseCreator: StateCreator<TStoreOf<S>> = (set) => ({
        ...initialState,
        setState: (key, value) => set((prev) => ({...prev, [key]: value})),
        patch: (partial) => set((prev) => ({...prev, ...(typeof partial === 'function' ? partial(prev) : partial)})),
        reset: () => set(() => ({...initialState})),
    });
    const withPersist = usePersist
        ? (persist(baseCreator, {
              name,
              ...persistOptions,
          }) as StateCreator<TStoreOf<S>>)
        : baseCreator;
    const withDevtools = useDevtools ? devtools(withPersist) : withPersist;

    return createWithEqualityFn<TStoreOf<S>>(withDevtools as StateCreator<TStoreOf<S>>, equalityFn);
}
