import {afterEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {AiChatScroll} from '../ai-chat-scroll';

afterEach(() => vi.unstubAllGlobals());

describe('conversation reading position', () => {
    it('keeps the reading position across new messages, image resize and composer changes, then resumes following on request', () => {
        let resize: () => void = () => {};
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(callback: () => void) {
                    resize = callback;
                }
                observe() {}
                disconnect() {}
            },
        );
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
        const flushFrames = () =>
            act(() => {
                frames.splice(0).forEach((callback) => callback(0));
            });
        const {container, rerender} = render(
            <AiChatScroll className="" composerHidden={false}>
                First result
            </AiChatScroll>,
        );
        const viewport = container.firstElementChild as HTMLDivElement;
        Object.defineProperties(viewport, {
            scrollHeight: {value: 1000, configurable: true},
            clientHeight: {value: 300, configurable: true},
            scrollTop: {value: 700, writable: true},
        });
        viewport.scrollTo = vi.fn();
        flushFrames();
        expect(viewport.scrollTo).toHaveBeenCalledWith({top: 1000, behavior: 'instant'});
        vi.mocked(viewport.scrollTo).mockClear();

        viewport.scrollTop = 200;
        fireEvent.scroll(viewport);
        rerender(
            <AiChatScroll className="" composerHidden>
                New result
            </AiChatScroll>,
        );
        act(() => resize());
        flushFrames();
        expect(viewport.scrollTo).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: '최근 대화로 이동'}));
        expect(viewport.scrollTo).toHaveBeenCalledWith({top: 1000, behavior: 'instant'});
        expect(screen.queryByRole('button', {name: '최근 대화로 이동'})).not.toBeInTheDocument();
        vi.mocked(viewport.scrollTo).mockClear();
        act(() => resize());
        flushFrames();
        expect(viewport.scrollTo).toHaveBeenCalledWith({top: 1000, behavior: 'instant'});
    });
});
