import {afterEach, describe, expect, it} from 'vitest';
import {createStore} from '../create-store';

describe('createStore', () => {
    afterEach(() => {
        localStorage.clear();
    });

    it('exposes explicit actions while keeping persisted payload limited to state keys', () => {
        const useCounterStore = createStore(
            {
                count: 0,
                label: 'idle',
            },
            {
                name: 'useCounterStore',
                persist: true,
                actions: ({patch, reset}) => ({
                    increase: () => patch((prev) => ({count: prev.count + 1, label: 'updated'})),
                    resetCounter: reset,
                }),
            },
        );

        useCounterStore.getState().increase();

        expect(useCounterStore.getState()).toMatchObject({
            count: 1,
            label: 'updated',
        });
        expect(useCounterStore.getState().resetCounter).toBeTypeOf('function');

        const persisted = JSON.parse(localStorage.getItem('useCounterStore') ?? '{}');

        expect(persisted.state).toEqual({
            count: 1,
            label: 'updated',
        });
    });

    it('only exposes unsafe mutators when a store opts into the migration escape hatch', () => {
        const useDraftStore = createStore(
            {
                value: 1,
            },
            {
                name: 'useDraftStore',
                unsafeMutators: true,
            },
        );

        useDraftStore.getState().unsafePatch({
            value: 3,
        });

        expect(useDraftStore.getState().value).toBe(3);
        expect('unsafePatch' in useDraftStore.getState()).toBe(true);
    });
});
