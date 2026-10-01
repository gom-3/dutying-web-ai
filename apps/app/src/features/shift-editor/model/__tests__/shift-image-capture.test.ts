import {afterEach, describe, expect, it, vi} from 'vitest';
import {createShiftImageCapture} from '../shift-image-capture';

describe('createShiftImageCapture', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        document.body.replaceChildren();
    });

    it('restores all full names and widens only the export copy while retaining calendar content', () => {
        const element = document.createElement('div');

        element.innerHTML = `<div class="make-shift-calendar">
            <div data-sticky-header="true">1 2 3</div>
            <div class="make-shift-calendar__row-name" title="홍길동아주긴이름"><span>홍길동아…</span></div>
            <div class="make-shift-calendar__row-name" title="Alexandra Montgomery"><span>Alex…</span></div>
            <div>D N O</div>
        </div>`;
        document.body.append(element);
        Object.defineProperty(element, 'clientWidth', {value: 1000});
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            return {width: this.tagName === 'SPAN' ? (this.textContent?.length ?? 0) * 16 : 84} as DOMRect;
        });

        const original = element.outerHTML;
        const capture = createShiftImageCapture(element);

        expect(capture.element).not.toBe(element);
        expect(Array.from(capture.element.querySelectorAll('.make-shift-calendar__row-name'), (name) => name.textContent)).toEqual([
            '홍길동아주긴이름',
            'Alexandra Montgomery',
        ]);
        expect(capture.element.style.getPropertyValue('--make-shift-name-column-width')).toBe('336px');
        expect(capture.element.style.width).toBe('1252px');
        expect(capture.element.querySelector<HTMLElement>('[data-sticky-header]')?.style.position).toBe('static');
        expect(capture.element.textContent).toContain('D N O');
        expect(element.outerHTML).toBe(original);
        expect(capture.element.isConnected).toBe(true);
        capture.dispose();
        expect(capture.element.isConnected).toBe(false);
        expect(element.isConnected).toBe(true);
    });
});
