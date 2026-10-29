import {act, cleanup, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CalendarNurseName} from '../calendar-nurse-name';

let viewportWidth = 80;
let trackWidth = 180;

const observers: TestResizeObserver[] = [];

class TestResizeObserver implements ResizeObserver {
    readonly callback: ResizeObserverCallback;
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        observers.push(this);
    }

    resize() {
        this.callback([], this);
    }
}

function nameRoot(container: HTMLElement) {
    return container.querySelector<HTMLElement>('.make-shift-calendar__nurse-name')!;
}

describe('CalendarNurseName', () => {
    beforeEach(() => {
        viewportWidth = 80;
        trackWidth = 180;
        observers.length = 0;
        vi.stubGlobal('ResizeObserver', TestResizeObserver);
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
            return this.classList.contains('make-shift-calendar__nurse-name') ? viewportWidth : 0;
        });
        vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
            return this.classList.contains('make-shift-calendar__nurse-name-track') ? trackWidth : 0;
        });
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('retains the real name behind an ellipsis and exposes it once to assistive technology', () => {
        const name = '김민지간호사선생님';
        const {container} = render(<CalendarNurseName name={name} displayName="김민지간…" />);
        const root = nameRoot(container);
        const track = root.querySelector('.make-shift-calendar__nurse-name-track');

        expect(root).toHaveAttribute('data-clipped', 'true');
        expect(root).toHaveAttribute('data-overflow', 'true');
        expect(root).toHaveAttribute('tabindex', '0');
        expect(root.querySelector('.make-shift-calendar__nurse-name-preview')).toHaveTextContent('김민지간…');
        expect(root.querySelector('.make-shift-calendar__nurse-name-preview')).toHaveAttribute('aria-hidden', 'true');
        expect(track).toHaveTextContent(name);
        expect(track).toHaveAttribute('aria-hidden', 'true');
        expect(root.querySelector('.sr-only')).toHaveTextContent(name);
    });

    it('does not add a tab stop to fitting names but reveals names shortened by the character limit', () => {
        trackWidth = 40;

        const view = render(<CalendarNurseName name="김민" displayName="김민" />);

        expect(nameRoot(view.container)).toHaveAttribute('data-clipped', 'false');
        expect(nameRoot(view.container)).toHaveAttribute('data-overflow', 'false');
        expect(nameRoot(view.container)).not.toHaveAttribute('tabindex');

        trackWidth = 75;

        view.rerender(<CalendarNurseName name="김민지간호사" displayName="김민지간…" />);

        expect(nameRoot(view.container)).toHaveAttribute('data-clipped', 'true');
        expect(nameRoot(view.container)).toHaveAttribute('data-overflow', 'false');
        expect(nameRoot(view.container)).toHaveAttribute('tabindex', '0');
        expect(nameRoot(view.container).querySelector('.make-shift-calendar__nurse-name-track')).toHaveTextContent('김민지간호사');

        view.rerender(<CalendarNurseName name="김민지간호사" displayName="김민지간…" focusable={false} />);

        expect(nameRoot(view.container)).toHaveAttribute('data-clipped', 'true');
        expect(nameRoot(view.container)).not.toHaveAttribute('tabindex');
    });

    it('rechecks actual overflow after resizing and name changes without requiring a character limit', () => {
        const name = 'Alexandra Elizabeth Montgomery-Wellington';
        const view = render(<CalendarNurseName name={name} displayName={name} />);

        expect(nameRoot(view.container)).toHaveAttribute('data-overflow', 'true');

        viewportWidth = 240;
        act(() => observers.forEach((observer) => observer.resize()));

        expect(nameRoot(view.container)).toHaveAttribute('data-clipped', 'false');
        expect(nameRoot(view.container)).toHaveAttribute('data-overflow', 'false');
        expect(nameRoot(view.container)).not.toHaveAttribute('tabindex');

        trackWidth = 280;
        view.rerender(<CalendarNurseName name={`${name} RN`} displayName={`${name} RN`} />);

        expect(nameRoot(view.container)).toHaveAttribute('data-clipped', 'true');
        expect(nameRoot(view.container)).toHaveAttribute('data-overflow', 'true');
        expect(nameRoot(view.container).querySelector('.sr-only')).toHaveTextContent(`${name} RN`);
    });

    it('disconnects resize observation when the calendar row is removed', () => {
        const view = render(<CalendarNurseName name="김민지간호사선생님" displayName="김민지간…" />);

        expect(observers.length).toBeGreaterThan(0);
        expect(observers.some((observer) => observer.observe.mock.calls.length > 0)).toBe(true);
        view.unmount();

        expect(observers.every((observer) => observer.disconnect.mock.calls.length > 0)).toBe(true);
    });
});
