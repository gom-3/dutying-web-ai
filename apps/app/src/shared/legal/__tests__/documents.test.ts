import {describe, expect, it} from 'vitest';
import {getPublishedLegalDocumentUrl} from '../documents';

describe('published legal documents', () => {
    it.each([
        ['ko', 'KR-ko-KR-v2026-06-20-38598c0fae25815a9108e62a27544da9'],
        ['ko-KR', 'KR-ko-KR-v2026-06-20-38598c0fae25815a9108e62a27544da9'],
        ['ja', 'JP-ja-JP-v2026-06-20-38598c0fae25810285b4fbe0439b60a5'],
        ['zh-CN', 'CN-zh-CN-v2026-06-20-38598c0fae258196b228ec11015bd3c5'],
        ['en', 'GLOBAL-en-Terms-of-Service-v2026-06-20-38598c0fae258168b173cc4eadef2781'],
    ])('maps %s to its published terms document', (language, documentId) => {
        expect(getPublishedLegalDocumentUrl('termsOfService', language)).toBe(`https://app.notion.com/p/${documentId}?pvs=21`);
    });

    it.each(['th', 'vi', 'fr', undefined])('falls back to the global terms document for %s', (language) => {
        expect(getPublishedLegalDocumentUrl('termsOfService', language)).toBe(
            'https://app.notion.com/p/GLOBAL-en-Terms-of-Service-v2026-06-20-38598c0fae258168b173cc4eadef2781?pvs=21',
        );
    });

    it.each([
        ['ko', 'KR-ko-KR-v2026-06-20-38598c0fae25819bb8e4d184fab61653'],
        ['ja-JP', 'JP-ja-JP-v2026-06-20-38598c0fae2581f5aec4c62cbf5826e5'],
        ['zh', 'CN-zh-CN-v2026-06-20-38598c0fae258136a48eeb77e58bccc8'],
        ['en-US', 'GLOBAL-en-Privacy-Policy-v2026-06-20-38598c0fae25817f80b0e5046c476863'],
    ])('maps %s to its published privacy document', (language, documentId) => {
        expect(getPublishedLegalDocumentUrl('privacyPolicy', language)).toBe(`https://app.notion.com/p/${documentId}?pvs=21`);
    });

    it.each(['th', 'vi', 'fr', undefined])('falls back to the global privacy document for %s', (language) => {
        expect(getPublishedLegalDocumentUrl('privacyPolicy', language)).toBe(
            'https://app.notion.com/p/GLOBAL-en-Privacy-Policy-v2026-06-20-38598c0fae25817f80b0e5046c476863?pvs=21',
        );
    });
});
