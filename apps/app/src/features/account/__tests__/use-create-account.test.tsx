import {act, renderHook} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {useCreateAccount} from '../model';

const createAccountProfileDTO = {
    name: '홍길동',
    phoneNum: '01012345678',
    profileImg: {
        defaultProfileImgId: 1,
    },
};

describe('useCreateAccount', () => {
    it('tracks loading to success when account creation succeeds', async () => {
        let resolveSubmit: (() => void) | undefined;

        const submit = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveSubmit = resolve;
                }),
        );
        const {result} = renderHook(() =>
            useCreateAccount({
                submit,
            }),
        );

        let request: Promise<unknown>;

        act(() => {
            request = result.current.handleCreateAccount(createAccountProfileDTO);
        });

        expect(result.current.createAccountStatus).toBe('loading');
        expect(result.current.createAccountFeedback.message).toBe('계정 정보를 저장하고 있어요.');

        await act(async () => {
            resolveSubmit?.();
            await request!;
        });

        expect(result.current.createAccountStatus).toBe('success');
        expect(result.current.createAccountFeedback.message).toBe('계정 정보를 저장했어요.');
    });

    it('keeps validation failure feedback empty without submitting', () => {
        const submit = vi.fn();
        const {result} = renderHook(() =>
            useCreateAccount({
                submit,
            }),
        );

        act(() => {
            result.current.handleCreateAccountValidationFailure();
        });

        expect(submit).not.toHaveBeenCalled();
        expect(result.current.createAccountStatus).toBe('idle');
        expect(result.current.createAccountFeedback.message).toBeNull();
    });

    it('classifies handled api errors as failure', async () => {
        const submit = vi.fn().mockRejectedValue({code: 400});
        const {result} = renderHook(() =>
            useCreateAccount({
                submit,
            }),
        );

        let request: Promise<unknown>;

        act(() => {
            request = result.current.handleCreateAccount(createAccountProfileDTO);
        });

        await act(async () => {
            await request!.catch(() => undefined);
        });

        await expect(request!).rejects.toEqual({code: 400});

        expect(result.current.createAccountStatus).toBe('failure');
    });

    it('can classify custom handled errors without rethrowing', async () => {
        const submit = vi.fn().mockRejectedValue({code: 409, message: 'PHONE_NUM_ALREADY_USED'});
        const {result} = renderHook(() =>
            useCreateAccount({
                submit,
                isHandledError: (error) =>
                    typeof error === 'object' &&
                    error !== null &&
                    'message' in error &&
                    (error as {message?: string}).message === 'PHONE_NUM_ALREADY_USED',
                shouldRethrowError: false,
            }),
        );

        let request: Promise<unknown>;

        act(() => {
            request = result.current.handleCreateAccount(createAccountProfileDTO);
        });

        await act(async () => {
            await request!;
        });

        expect(result.current.createAccountStatus).toBe('failure');
    });

    it('classifies unexpected errors as exception', async () => {
        const error = new Error('network');
        const submit = vi.fn().mockRejectedValue(error);
        const {result} = renderHook(() =>
            useCreateAccount({
                submit,
            }),
        );

        let request: Promise<unknown>;

        act(() => {
            request = result.current.handleCreateAccount(createAccountProfileDTO);
        });

        await act(async () => {
            await request!.catch(() => undefined);
        });

        await expect(request!).rejects.toThrow('network');

        expect(result.current.createAccountStatus).toBe('exception');
        expect(result.current.createAccountFeedback.message).toBe('계정 생성 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.');
    });

    it('does not reset back to idle while submit is still loading', async () => {
        let resolveSubmit: (() => void) | undefined;

        const submit = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveSubmit = resolve;
                }),
        );
        const {result} = renderHook(() =>
            useCreateAccount({
                submit,
            }),
        );

        act(() => {
            void result.current.handleCreateAccount(createAccountProfileDTO);
        });

        act(() => {
            result.current.resetCreateAccountStatus();
        });

        expect(result.current.createAccountStatus).toBe('loading');

        await act(async () => {
            resolveSubmit?.();
            await Promise.resolve();
        });
    });
});
