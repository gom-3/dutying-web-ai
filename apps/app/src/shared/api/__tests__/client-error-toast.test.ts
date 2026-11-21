import {AxiosError, type InternalAxiosRequestConfig} from 'axios';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import axiosInstance from '../client';

const toastError = vi.hoisted(() => vi.fn(() => 'api-validation-toast'));
vi.mock('react-hot-toast', () => ({toast: {error: toastError}, default: {error: toastError}}));
const originalAdapter = axiosInstance.defaults.adapter;

describe('API error feedback ownership', () => {
    beforeEach(() => {
        toastError.mockClear();
        axiosInstance.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
            throw new AxiosError('Invalid request', 'ERR_BAD_REQUEST', config, undefined, {
                config,
                status: 400,
                statusText: 'Bad Request',
                headers: {},
                data: {
                    code: 'INVALID_TYPE_VALUE',
                    messageKey: 'error.invalidTypeValue',
                    errors: [{field: 'wardShiftTypes[0].name', messageKey: 'Size'}],
                },
            });
        };
    });
    afterEach(() => {
        axiosInstance.defaults.adapter = originalAdapter;
    });

    it('passes the shown toast identifier and validation fields to the caller for a contextual replacement', async () => {
        await expect(axiosInstance.post('/wards/v2', {})).rejects.toMatchObject({
            code: 400,
            toastId: 'api-validation-toast',
            responseBody: {errors: [{field: 'wardShiftTypes[0].name', messageKey: 'Size'}]},
        });
        expect(toastError).toHaveBeenCalledOnce();
    });

    it('keeps explicitly suppressed error feedback with the caller', async () => {
        await expect(axiosInstance.post('/wards/v2', {}, {suppressErrorToast: true})).rejects.toMatchObject({
            code: 400,
            toastId: undefined,
        });
        expect(toastError).not.toHaveBeenCalled();
    });
});
