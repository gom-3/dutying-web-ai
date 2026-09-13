import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TutorialOverlay} from '../TutorialOverlay';

const targetRects = new Map<string, DOMRect>();
const resizeObserverCallbacks: ResizeObserverCallback[] = [];

class ResizeObserverMock implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
        resizeObserverCallbacks.push(callback);
    }

    disconnect = vi.fn();
    observe = vi.fn();
    unobserve = vi.fn();
}

const createRect = ({height, left, top, width}: {height: number; left: number; top: number; width: number}) =>
    ({
        bottom: top + height,
        height,
        left,
        right: left + width,
        top,
        width,
        x: left,
        y: top,
        toJSON: () => ({}),
    }) as DOMRect;

describe('TutorialOverlay', () => {
    beforeEach(() => {
        resizeObserverCallbacks.length = 0;
        targetRects.clear();
        vi.stubGlobal('ResizeObserver', ResizeObserverMock);
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            return targetRects.get(this.id) ?? createRect({height: 0, left: 0, top: 0, width: 0});
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('keeps the highlight aligned while an animated target opens', () => {
        targetRects.set('nurse_edit_drawer', createRect({height: 720, left: 1200, top: 40, width: 0}));

        render(
            <>
                <aside id="nurse_edit_drawer" />
                <TutorialOverlay
                    config={{
                        scrollLock: true,
                        steps: [
                            {
                                highlightIds: ['nurse_edit_drawer'],
                                title: '간호사 정보 수정하기',
                                info: '오른쪽 패널에서 수정할 수 있어요.',
                            },
                        ],
                    }}
                    closeCallback={vi.fn()}
                />
            </>,
        );

        expect(document.getElementById('HighlightedElement')).toHaveStyle({left: '1192px', width: '16px'});

        targetRects.set('nurse_edit_drawer', createRect({height: 720, left: 900, top: 40, width: 300}));

        act(() => {
            resizeObserverCallbacks.forEach((callback) => callback([], {} as ResizeObserver));
        });

        expect(document.getElementById('HighlightedElement')).toHaveStyle({left: '892px', width: '316px'});
        expect(screen.getByText('간호사 정보 수정하기').closest('#InfoBox')).toHaveStyle({left: '526px'});
    });

    it('keeps tutorial controls available after observing the target', () => {
        const closeCallback = vi.fn();

        targetRects.set('nurse_edit_drawer', createRect({height: 720, left: 900, top: 40, width: 300}));

        render(
            <>
                <aside id="nurse_edit_drawer" />
                <TutorialOverlay
                    config={{scrollLock: true, steps: [{highlightIds: ['nurse_edit_drawer'], title: '간호사 정보 수정하기'}]}}
                    closeCallback={closeCallback}
                />
            </>,
        );

        fireEvent.click(screen.getByRole('button', {name: '완료'}));

        expect(closeCallback).toHaveBeenCalledOnce();
    });
});
