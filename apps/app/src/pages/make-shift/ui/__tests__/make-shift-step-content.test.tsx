import {MemoryRouter} from 'react-router-dom';
import {describe, expect, it, vi} from 'vitest';
import {act, render, screen} from '@/shared/util/test-utils';
import {MakeShiftStepContent} from '../make-shift-step-content';

const stepLoad = vi.hoisted(() => ({complete: undefined as (() => void) | undefined}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../use-flow-transition-feedback', () => ({
    useFlowTransitionFeedback: () => ({
        transitioning: null,
        runTransition: (_direction: string, action: () => void) => action(),
    }),
}));

vi.mock('../make-shift-step-config', async () => {
    const {lazy} = await import('react');

    return {
        MAKE_SHIFT_STEP_CONFIG: {
            1: {
                labelKey: 'workers',
                captionKey: 'workersCaption',
                layout: 'narrow',
                Component: () => <div data-testid="narrow-step" />,
                intro: {
                    titleKey: 'workersTitle',
                    descriptionKey: 'workersDescription',
                },
            },
            2: {
                labelKey: 'constraints',
                captionKey: 'constraintsCaption',
                layout: 'narrow',
                Component: lazy(
                    () =>
                        new Promise<{default: () => React.JSX.Element}>((resolve) => {
                            stepLoad.complete = () => resolve({default: () => <div data-testid="delayed-step" />});
                        }),
                ),
            },
            3: {
                labelKey: 'requests',
                captionKey: 'requestsCaption',
                layout: 'wide',
                Component: () => <div data-testid="wide-step" />,
            },
        },
    };
});

describe('MakeShiftStepContent layout', () => {
    it('shows local loading feedback until a step and its navigation are ready', async () => {
        render(
            <MemoryRouter>
                <h1>Schedule</h1>
                <MakeShiftStepContent currentStep={2} canPrev canNext onPrev={vi.fn()} onNext={vi.fn()} />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', {name: 'Schedule'})).toBeInTheDocument();
        expect(screen.getByText('page.state.loadingTitle')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /page\.makeShift\.navigation\.next/})).not.toBeInTheDocument();

        await act(async () => stepLoad.complete?.());

        expect(await screen.findByTestId('delayed-step')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /page\.makeShift\.navigation\.next/})).toBeEnabled();
    });

    it('lets narrow steps use natural height', () => {
        render(
            <MemoryRouter>
                <MakeShiftStepContent currentStep={1} canPrev={false} canNext onPrev={vi.fn()} onNext={vi.fn()} />
            </MemoryRouter>,
        );

        const content = screen.getByTestId('narrow-step').closest('.make-shift-step-content');

        expect(content).toHaveClass('make-shift-step-content--narrow');
        expect(content).not.toHaveClass('min-h-0');
        expect(content).not.toHaveClass('flex-1');
    });

    it('lets wide steps use natural height', () => {
        render(
            <MemoryRouter>
                <MakeShiftStepContent currentStep={3} canPrev canNext onPrev={vi.fn()} onNext={vi.fn()} />
            </MemoryRouter>,
        );

        const content = screen.getByTestId('wide-step').closest('.make-shift-step-content');

        expect(content).toHaveClass('make-shift-step-content--wide');
        expect(content).not.toHaveClass('min-h-0');
        expect(content).not.toHaveClass('flex-1');
    });

    it('keeps the next button disabled while the current step is saving', () => {
        render(
            <MemoryRouter>
                <MakeShiftStepContent currentStep={1} canPrev={false} canNext nextBusy onPrev={vi.fn()} onNext={vi.fn()} />
            </MemoryRouter>,
        );

        expect(screen.getByRole('button', {name: /page\.makeShift\.navigation\.saving/})).toBeDisabled();
    });
});
