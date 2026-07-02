import {describe, expect, it} from 'vitest';
import {render, screen} from '@/shared/util/test-utils';
import {MakeShiftCalendarSkeleton} from '../make-shift-calendar-skeleton';

describe('MakeShiftCalendarSkeleton', () => {
    it('renders a calendar-shaped busy skeleton', () => {
        render(<MakeShiftCalendarSkeleton ariaLabel="calendar is loading" rowCount={2} dayCount={3} />);

        const skeleton = screen.getByRole('status', {name: 'calendar is loading'});

        expect(skeleton).toHaveAttribute('aria-busy', 'true');
        expect(skeleton).toHaveAttribute('data-testid', 'make-shift-calendar-skeleton');
        expect(skeleton.querySelectorAll('.make-shift-calendar__row')).toHaveLength(2);
        expect(skeleton.querySelectorAll('.make-shift-calendar__day-header-pill > div')).toHaveLength(3);
    });
});
