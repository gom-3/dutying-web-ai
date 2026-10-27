import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {AiChatScroll} from '../ai-chat-scroll';

afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
});

describe('conversation reading position', () => {
    it('restores a reading position after asynchronous history load and remount, and clears it only for a new conversation', () => {
        const frames: FrameRequestCallback[] = [];

        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());

        const flush = () =>
            act(() => {
                frames.splice(0).forEach((callback) => callback(0));
            });
        const measure = (container: HTMLElement) => {
            const viewport = container.querySelector('.ai-adjust-chat-scroll') as HTMLDivElement;

            Object.defineProperties(viewport, {
                scrollHeight: {value: 1200, configurable: true},
                clientHeight: {value: 300, configurable: true},
                scrollTop: {value: 0, writable: true},
            });
            viewport.scrollTo = vi.fn();

            return viewport;
        };

        localStorage.setItem('same-schedule-scroll', JSON.stringify({top: 240, following: false}));

        const view = (ready: boolean, resetKey = 0) => (
            <AiChatScroll historyKey="same-schedule-scroll" ready={ready} resetKey={resetKey} composerHidden={false} className="">
                Full conversation
            </AiChatScroll>
        );
        const first = render(view(false));
        const viewport = measure(first.container);

        flush();
        expect(viewport.scrollTo).not.toHaveBeenCalled();
        first.rerender(view(true));
        flush();
        expect(viewport.scrollTo).toHaveBeenLastCalledWith({top: 240, behavior: 'instant'});
        viewport.scrollTop = 280;
        fireEvent.scroll(viewport);
        first.unmount();

        const second = render(view(true));
        const restored = measure(second.container);

        flush();
        expect(restored.scrollTo).toHaveBeenLastCalledWith({top: 280, behavior: 'instant'});
        expect(screen.getByRole('button', {name: '최근 대화로 이동'})).toBeVisible();
        second.rerender(view(true, 1));
        flush();
        expect(restored.scrollTo).toHaveBeenLastCalledWith({top: 1200, behavior: 'instant'});
        expect(screen.queryByRole('button', {name: '최근 대화로 이동'})).not.toBeInTheDocument();
    });

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
        const viewport = container.querySelector('.ai-adjust-chat-scroll') as HTMLDivElement;

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
        expect(viewport).toHaveFocus();
        expect(screen.queryByRole('button', {name: '최근 대화로 이동'})).not.toBeInTheDocument();
        vi.mocked(viewport.scrollTo).mockClear();
        act(() => resize());
        flushFrames();
        expect(viewport.scrollTo).toHaveBeenCalledWith({top: 1000, behavior: 'instant'});
    });
});
