import {act} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen} from '@/shared/util/test-utils';
import {LandingHospitalRotation} from '../landing-adoption-overview';

const motion = vi.hoisted(() => ({reduced: false}));

vi.mock('../use-landing-reduced-motion', () => ({useLandingReducedMotion: () => motion.reduced}));

const images = () => screen.getByRole('region', {name: '듀팅 이용 현황'}).querySelectorAll('img');
const advance = (steps: number) => act(() => vi.advanceTimersByTime(3800 * steps));
const expectExistingIcons = () => {
    expect(images()).toHaveLength(7);

    images().forEach((image) => {
        expect(image).toHaveAttribute('src', '/img/landing-hospital-3d-icon.webp');
        expect(image).toHaveAttribute('alt', '');
        expect(image.closest('[aria-hidden="true"]')).not.toBeNull();
    });
};

describe('LandingHospitalRotation', () => {
    beforeEach(() => {
        motion.reduced = false;
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows the existing hospital icons instead of hospital logos, including Gil Hospital', () => {
        render(<LandingHospitalRotation />);

        expect(screen.getByText('충북대학교병원')).toBeInTheDocument();
        expectExistingIcons();

        advance(4);

        expect(screen.getByText('가천대 길병원')).toBeInTheDocument();
        expectExistingIcons();
    });

    it('retains Hanbit Hospital at the end and wraps back to the first hospital', () => {
        render(<LandingHospitalRotation />);
        advance(151);

        expect(screen.getByText('한빛병원')).toBeInTheDocument();
        expectExistingIcons();

        advance(1);

        expect(screen.getByText('충북대학교병원')).toBeInTheDocument();
        expectExistingIcons();
    });

    it('keeps the name and icons stationary when reduced motion is enabled', () => {
        motion.reduced = true;

        const {unmount} = render(<LandingHospitalRotation />);

        advance(5);

        expect(screen.getByText('충북대학교병원')).toBeInTheDocument();
        expectExistingIcons();

        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
});
