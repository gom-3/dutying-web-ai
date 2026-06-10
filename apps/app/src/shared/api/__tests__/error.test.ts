import i18n from '@/i18n';
import {describe, expect, it} from 'vitest';
import {normalizeApiErrorResponse, resolveApiErrorMessage} from '../error';

describe('api error i18n adapter', () => {
    it('normalizes the server error contract and preserves request metadata', () => {
        const response = normalizeApiErrorResponse({
            code: 'INVALID_PARAMETER',
            message: '파라미터가 올바르지 않습니다.',
            messageKey: 'error.invalidParameter',
            displayPolicy: 'CLIENT_TRANSLATE',
            locale: 'ko-KR',
            requestId: 'req-1',
            traceId: 'trace-1',
            messageArgs: {field: 'name'},
            errors: [{field: 'name', message: '이름을 입력해 주세요.', messageKey: 'NotBlank'}],
        });

        expect(response).toMatchObject({
            code: 'INVALID_PARAMETER',
            messageKey: 'error.invalidParameter',
            displayPolicy: 'CLIENT_TRANSLATE',
            requestId: 'req-1',
            traceId: 'trace-1',
        });
        expect(response?.errors).toEqual([{field: 'name', message: '이름을 입력해 주세요.', messageKey: 'NotBlank'}]);
    });

    it('uses server text when the server explicitly owns the display message', () => {
        const message = resolveApiErrorMessage({
            message: '일정 제목은 비워둘 수 없습니다.',
            messageKey: 'error.invalidParameter',
            displayPolicy: 'SERVER_TEXT_WITH_LANGUAGE',
            locale: 'ko-KR',
        });

        expect(message).toBe('일정 제목은 비워둘 수 없습니다.');
    });

    it('falls back to the server localized message when a client translation key is not present yet', async () => {
        await i18n.changeLanguage('ja');

        const message = resolveApiErrorMessage({
            message: 'この言語コードはサポートされていません。',
            messageKey: 'error.invalidLanguageCode',
            displayPolicy: 'CLIENT_TRANSLATE',
            locale: 'ja-JP',
        });

        expect(message).toBe('この言語コードはサポートされていません。');
    });

    it('hides debug-only server text behind the generic fallback', () => {
        const message = resolveApiErrorMessage({
            message: 'stack trace detail',
            displayPolicy: 'DEBUG_ONLY',
        }, 'fallback');

        expect(message).toBe('fallback');
    });
});
