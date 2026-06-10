import {toBlob} from 'html-to-image';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {buildShiftImageFileName, buildShiftImageTitle, downloadBlobAsFile, shiftToImage} from '../shift-to-image';

vi.mock('html-to-image', () => ({
    toBlob: vi.fn(),
}));

describe('shift-to-image', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('ko');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('팀 이름과 연월을 기준으로 파일명을 만든다', () => {
        expect(buildShiftImageFileName({year: 2026, month: 3, teamName: 'ICU/1팀'})).toBe('ICU 1팀 2026년 3월 근무표.png');
        expect(buildShiftImageFileName({year: 2026, month: 3, teamName: null})).toBe('2026년 3월 근무표.png');
    });

    it('연월, 병원명, 병동명으로 이미지 제목을 만든다', () => {
        expect(buildShiftImageTitle({year: 2027, month: 1, hospitalName: '듀팅병원', wardName: '7A'})).toBe(
            '2027년 1월 듀팅병원 7A 근무표',
        );
        expect(buildShiftImageTitle({year: 2027, month: 1, hospitalName: null, wardName: null})).toBe('2027년 1월 근무표');
    });

    it('활성 언어 기준으로 이미지 파일명과 제목을 만든다', async () => {
        await i18n.changeLanguage('en');

        expect(buildShiftImageFileName({year: 2026, month: 3, teamName: 'ICU/1'})).toBe('ICU 1 2026 M3 schedule.png');
        expect(buildShiftImageTitle({year: 2027, month: 1, hospitalName: 'Dutying Hospital', wardName: '7A'})).toBe(
            'Dutying Hospital 7A 2027 M1 schedule',
        );

        await i18n.changeLanguage('ja');

        expect(buildShiftImageFileName({year: 2026, month: 3, teamName: 'ICU/1'})).toBe('ICU 1 2026年3月勤務表.png');
        expect(buildShiftImageTitle({year: 2027, month: 1, hospitalName: 'デューティング病院', wardName: '7A'})).toBe(
            '2027年1月 デューティング病院 7A 勤務表',
        );
    });

    it('blob을 object url로 내려받는다', () => {
        const blob = new Blob(['test'], {type: 'image/png'});
        const click = vi.fn();
        const anchor = {click, href: '', download: ''};

        vi.spyOn(document, 'createElement').mockReturnValue(anchor as unknown as HTMLAnchorElement);

        const createObjectURLSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:url');
        const revokeObjectURLSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

        downloadBlobAsFile(blob, 'duty.png');

        expect(anchor.href).toBe('blob:url');
        expect(anchor.download).toBe('duty.png');
        expect(click).toHaveBeenCalledTimes(1);
        expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:url');
    });

    it('캡처 blob을 A4 가로 이미지로 합성해 다운로드한다', async () => {
        const captureBlob = new Blob(['image'], {type: 'image/png'});
        const a4Blob = new Blob(['a4-image'], {type: 'image/png'});
        const element = document.createElement('div');
        const click = vi.fn();
        const anchor = {click, href: '', download: ''};
        const context = {
            drawImage: vi.fn(),
            fillRect: vi.fn(),
            fillText: vi.fn(),
            measureText: vi.fn(() => ({width: 900})),
            restore: vi.fn(),
            save: vi.fn(),
            set fillStyle(_value: string) {},
            set filter(_value: string) {},
            set font(_value: string) {},
            set globalAlpha(_value: number) {},
            set imageSmoothingEnabled(_value: boolean) {},
            set imageSmoothingQuality(_value: ImageSmoothingQuality) {},
            set textBaseline(_value: CanvasTextBaseline) {},
        };
        const canvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => context),
            toBlob: vi.fn((callback: BlobCallback) => callback(a4Blob)),
        };

        Object.defineProperty(element, 'scrollWidth', {value: 720});
        Object.defineProperty(element, 'scrollHeight', {value: 480});
        Object.defineProperty(element, 'clientWidth', {value: 700});
        Object.defineProperty(element, 'clientHeight', {value: 460});

        vi.mocked(toBlob).mockResolvedValue(captureBlob);

        class MockImage {
            onerror: (() => void) | null = null;
            onload: (() => void) | null = null;
            naturalWidth = 1440;
            naturalHeight = 960;
            width = 1440;
            height = 960;

            set src(value: string) {
                if (value === '/img/group-19.png') {
                    this.naturalWidth = 2901;
                    this.naturalHeight = 797;
                    this.width = 2901;
                    this.height = 797;
                }

                queueMicrotask(() => this.onload?.());
            }
        }

        vi.stubGlobal('Image', MockImage);

        const createElement = document.createElement.bind(document);

        vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
            if (tagName === 'canvas') return canvas as unknown as HTMLCanvasElement;

            if (tagName === 'a') return anchor as unknown as HTMLAnchorElement;

            return createElement(tagName);
        });

        const createObjectURLSpy = vi
            .spyOn(window.URL, 'createObjectURL')
            .mockReturnValueOnce('blob:capture')
            .mockReturnValueOnce('blob:download');
        const revokeObjectURLSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

        await expect(
            shiftToImage({
                element,
                year: 2027,
                month: 1,
                teamName: '중환자실',
                hospitalName: '듀팅병원',
                wardName: '7A',
            }),
        ).resolves.toBe('중환자실 2027년 1월 근무표.png');
        expect(toBlob).toHaveBeenCalledWith(
            element,
            expect.objectContaining({
                width: 720,
                height: 480,
                pixelRatio: 2,
            }),
        );
        expect(canvas.width).toBe(3508);
        expect(canvas.height).toBe(2480);
        expect(context.fillText).toHaveBeenCalledWith('2027년 1월 듀팅병원 7A 근무표', 172, 132, 3164);
        expect(context.drawImage).toHaveBeenCalledTimes(2);
        expect(createObjectURLSpy).toHaveBeenCalledWith(captureBlob);
        expect(createObjectURLSpy).toHaveBeenCalledWith(a4Blob);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:capture');
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:download');
        expect(anchor.download).toBe('중환자실 2027년 1월 근무표.png');
        expect(click).toHaveBeenCalledTimes(1);
    });
});
