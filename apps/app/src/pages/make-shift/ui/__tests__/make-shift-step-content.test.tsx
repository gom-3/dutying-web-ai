import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@/shared/util/test-utils';
import {MakeShiftStepContent} from '../make-shift-step-content';

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

vi.mock('../make-shift-step-config', () => ({
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
        3: {
            labelKey: 'requests',
            captionKey: 'requestsCaption',
            layout: 'wide',
            Component: () => <div data-testid="wide-step" />,
        },
    },
}));

describe('MakeShiftStepContent layout', () => {
    it('lets narrow steps use natural height', () => {
        render(<MakeShiftStepContent currentStep={1} canPrev={false} canNext onPrev={vi.fn()} onNext={vi.fn()} />);

        const content = screen.getByTestId('narrow-step').closest('.make-shift-step-content');

        expect(content).toHaveClass('make-shift-step-content--narrow');
        expect(content).not.toHaveClass('min-h-0');
        expect(content).not.toHaveClass('flex-1');
    });

    it('lets wide steps use natural height', () => {
        render(<MakeShiftStepContent currentStep={3} canPrev canNext onPrev={vi.fn()} onNext={vi.fn()} />);

        const content = screen.getByTestId('wide-step').closest('.make-shift-step-content');

        expect(content).toHaveClass('make-shift-step-content--wide');
        expect(content).not.toHaveClass('min-h-0');
        expect(content).not.toHaveClass('flex-1');
    });
});
