import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Scope} from '@/features/commercial/api';
import {useHospitalNavigationContext} from './use-hospital-navigation-context';

const keyFor = (accountId: number) => `dutying:workspace-navigation:${accountId}`;
const hospital = (ref: string, overrides: Partial<Scope> = {}): Scope => ({
    type: 'HOSPITAL',
    ref,
    scopeId: `hospital-${ref}`,
    name: `${ref} 병원`,
    role: 'OWNER',
    status: 'ACTIVE',
    ...overrides,
});
const first = hospital('h1');
const second = hospital('h2', {role: 'MANAGER'});
const ward: Scope = {type: 'WARD', ref: '11', scopeId: 'ward-11', name: '중환자실', role: 'OWNER'};

type TNavigationInput = Parameters<typeof useHospitalNavigationContext>[0];

beforeEach(() => sessionStorage.clear());
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    sessionStorage.clear();
});

describe('hospital navigation context', () => {
    it('uses a single assigned hospital before its paid contract is active and excludes wards', () => {
        const draft = hospital('h1', {status: 'DRAFT'});
        const {result} = renderHook(() => useHospitalNavigationContext({accountId: 7, scopes: [ward, draft]}));

        expect(result.current.hospitals).toEqual([draft]);
        expect(result.current.hospital).toEqual(draft);
    });

    it('leaves multiple hospitals unselected until there is a valid route or previous choice', () => {
        const {result} = renderHook(() => useHospitalNavigationContext({accountId: 7, scopes: [first, second]}));

        expect(result.current.hospital).toBeUndefined();
        expect(result.current.hospitals).toEqual([first, second]);
    });

    it('gives an authorized hospital route priority over the remembered hospital', () => {
        sessionStorage.setItem(keyFor(7), JSON.stringify({ref: first.ref, scopeId: first.scopeId}));

        const {result} = renderHook(() => useHospitalNavigationContext({accountId: 7, scopes: [first, second], currentScope: second}));

        expect(result.current.hospital).toEqual(second);
        expect(JSON.parse(sessionStorage.getItem(keyFor(7))!)).toEqual({ref: second.ref, scopeId: second.scopeId});
    });

    it('keeps the hospital after leaving its route for a personal page', () => {
        const {result, rerender} = renderHook<ReturnType<typeof useHospitalNavigationContext>, TNavigationInput>(
            (input) => useHospitalNavigationContext(input),
            {
                initialProps: {accountId: 7, scopes: [first, second], currentScope: second},
            },
        );

        rerender({accountId: 7, scopes: [first, second]});

        expect(result.current.hospital).toEqual(second);
    });

    it('restores the last authorized hospital on a direct personal entry', () => {
        sessionStorage.setItem(keyFor(7), JSON.stringify({ref: second.ref, scopeId: second.scopeId}));

        const {result} = renderHook(() => useHospitalNavigationContext({accountId: 7, scopes: [first, second]}));

        expect(result.current.hospital).toEqual(second);
    });

    it.each([
        ['malformed JSON', '{'],
        ['a removed hospital', JSON.stringify({ref: 'removed', scopeId: 'hospital-removed'})],
        ['a mismatched scope id', JSON.stringify({ref: first.ref, scopeId: second.scopeId})],
        ['a ward scope', JSON.stringify({ref: ward.ref, scopeId: ward.scopeId})],
    ])('does not restore %s when several hospitals are available', (_label, stored) => {
        sessionStorage.setItem(keyFor(7), stored);

        const {result} = renderHook(() => useHospitalNavigationContext({accountId: 7, scopes: [first, second, ward]}));

        expect(result.current.hospital).toBeUndefined();
    });

    it('uses current permission and name instead of values supplied by a stored record or route object', () => {
        const current = hospital('h1', {role: 'MANAGER', name: '이름이 바뀐 병원'});

        sessionStorage.setItem(keyFor(7), JSON.stringify({ref: first.ref, scopeId: first.scopeId, role: 'OWNER', name: '예전 병원명'}));

        const {result, rerender} = renderHook<ReturnType<typeof useHospitalNavigationContext>, TNavigationInput>(
            (input) => useHospitalNavigationContext(input),
            {
                initialProps: {accountId: 7, scopes: [current, second]},
            },
        );

        expect(result.current.hospital).toEqual(current);
        rerender({accountId: 7, scopes: [current, second], currentScope: first});
        expect(result.current.hospital).toEqual(current);
    });

    it('does not use a forged route scope and falls back to an authorized stored hospital', () => {
        sessionStorage.setItem(keyFor(7), JSON.stringify({ref: second.ref, scopeId: second.scopeId}));

        const {result} = renderHook(() =>
            useHospitalNavigationContext({
                accountId: 7,
                scopes: [first, second],
                currentScope: {...first, scopeId: 'not-authorized'},
            }),
        );

        expect(result.current.hospital).toEqual(second);
    });

    it('remembers a validated choice using only hospital identifiers and updates the selection', () => {
        const {result} = renderHook(() => useHospitalNavigationContext({accountId: 7, scopes: [first, second]}));

        let accepted = false;

        act(() => {
            accepted = result.current.rememberHospital({...second, name: '변조된 병원명', role: 'OWNER'});
        });

        expect(accepted).toBe(true);
        expect(result.current.hospital).toEqual(second);
        expect(JSON.parse(sessionStorage.getItem(keyFor(7))!)).toEqual({ref: second.ref, scopeId: second.scopeId});
    });

    it('rejects ward, unknown, and mismatched choices without changing the selected hospital or saved choice', () => {
        sessionStorage.setItem(keyFor(7), JSON.stringify({ref: first.ref, scopeId: first.scopeId}));

        const {result} = renderHook(() => useHospitalNavigationContext({accountId: 7, scopes: [first, second, ward]}));
        const saved = sessionStorage.getItem(keyFor(7));

        for (const candidate of [ward, hospital('unknown'), {...second, scopeId: first.scopeId}]) {
            act(() => {
                expect(result.current.rememberHospital(candidate)).toBe(false);
            });
        }

        expect(result.current.hospital).toEqual(first);
        expect(sessionStorage.getItem(keyFor(7))).toBe(saved);
    });

    it('isolates the previous selection when changing accounts even if both accounts can access the same hospitals', () => {
        const {result, rerender} = renderHook<ReturnType<typeof useHospitalNavigationContext>, TNavigationInput>(
            (input) => useHospitalNavigationContext(input),
            {
                initialProps: {accountId: 7, scopes: [first, second], currentScope: second},
            },
        );

        rerender({accountId: 8, scopes: [first, second]});

        expect(result.current.hospital).toBeUndefined();
        expect(sessionStorage.getItem(keyFor(8))).toBeNull();
    });

    it('restores the next account’s own authorized selection rather than the prior account’s memory', () => {
        sessionStorage.setItem(keyFor(8), JSON.stringify({ref: first.ref, scopeId: first.scopeId}));

        const {result, rerender} = renderHook<ReturnType<typeof useHospitalNavigationContext>, TNavigationInput>(
            (input) => useHospitalNavigationContext(input),
            {
                initialProps: {accountId: 7, scopes: [first, second], currentScope: second},
            },
        );

        rerender({accountId: 8, scopes: [first, second]});

        expect(result.current.hospital).toEqual(first);
    });

    it('drops a removed hospital and uses the sole remaining authorized hospital', () => {
        const {result, rerender} = renderHook<ReturnType<typeof useHospitalNavigationContext>, TNavigationInput>(
            (input) => useHospitalNavigationContext(input),
            {
                initialProps: {accountId: 7, scopes: [first, second], currentScope: second},
            },
        );

        rerender({accountId: 7, scopes: [first]});

        expect(result.current.hospital).toEqual(first);
    });

    it('does not reuse a revoked selection when two other hospitals remain', () => {
        const third = hospital('h3');
        const {result, rerender} = renderHook<ReturnType<typeof useHospitalNavigationContext>, TNavigationInput>(
            (input) => useHospitalNavigationContext(input),
            {
                initialProps: {accountId: 7, scopes: [first, second, third], currentScope: second},
            },
        );

        rerender({accountId: 7, scopes: [first, third]});

        expect(result.current.hospital).toBeUndefined();
        expect(result.current.hospitals).toEqual([first, third]);
    });

    it('keeps the current account’s in-memory selection ahead of an older saved choice', () => {
        const {result, rerender} = renderHook<ReturnType<typeof useHospitalNavigationContext>, TNavigationInput>(
            (input) => useHospitalNavigationContext(input),
            {
                initialProps: {accountId: 7, scopes: [first, second]},
            },
        );

        act(() => {
            result.current.rememberHospital(second);
        });
        sessionStorage.setItem(keyFor(7), JSON.stringify({ref: first.ref, scopeId: first.scopeId}));
        rerender({accountId: 7, scopes: [first, second]});

        expect(result.current.hospital).toEqual(second);
    });

    it('hides a remembered hospital when permissions are unavailable, then revalidates after they return', () => {
        const {result, rerender} = renderHook<ReturnType<typeof useHospitalNavigationContext>, TNavigationInput>(
            (input) => useHospitalNavigationContext(input),
            {
                initialProps: {accountId: 7, scopes: [first, second], currentScope: second},
            },
        );

        rerender({accountId: 7, scopes: []});
        expect(result.current.hospital).toBeUndefined();
        expect(result.current.hospitals).toEqual([]);

        rerender({accountId: 7, scopes: [first, second]});
        expect(result.current.hospital).toEqual(second);
    });

    it('does not promote a ward route into hospital context for ward-only accounts', () => {
        const {result} = renderHook(() => useHospitalNavigationContext({accountId: 7, scopes: [ward], currentScope: ward}));

        expect(result.current.hospital).toBeUndefined();
        expect(result.current.hospitals).toEqual([]);
        expect(sessionStorage.getItem(keyFor(7))).toBeNull();
    });

    it('continues navigating in memory when browser storage cannot be read or written', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Storage unavailable', 'SecurityError');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Storage unavailable', 'SecurityError');
        });

        const {result, rerender} = renderHook<ReturnType<typeof useHospitalNavigationContext>, TNavigationInput>(
            (input) => useHospitalNavigationContext(input),
            {
                initialProps: {accountId: 7, scopes: [first, second]},
            },
        );

        expect(result.current.hospital).toBeUndefined();
        act(() => {
            expect(result.current.rememberHospital(second)).toBe(true);
        });
        expect(result.current.hospital).toEqual(second);

        rerender({accountId: 7, scopes: [first, second]});
        expect(result.current.hospital).toEqual(second);
    });
});
