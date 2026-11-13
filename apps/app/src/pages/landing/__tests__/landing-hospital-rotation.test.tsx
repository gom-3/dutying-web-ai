import {act, fireEvent} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen} from '@/shared/util/test-utils';
import {LandingHospitalRotation} from '../landing-adoption-overview';
import {landingHospitalLogos} from '../landing-hospital-logos';

const motion = vi.hoisted(() => ({reduced: false}));

vi.mock('../use-landing-reduced-motion', () => ({useLandingReducedMotion: () => motion.reduced}));

vi.mock('../landing-hospital-logos', async (importOriginal) => {
    const actual = await importOriginal<{landingHospitalLogos: typeof landingHospitalLogos}>();

    return {landingHospitalLogos: {...actual.landingHospitalLogos, 송추정신병원: undefined}};
});

const image = () => screen.getByRole('region', {name: '듀팅 이용 현황'}).querySelector('img')!;
const advance = (steps: number) => act(() => vi.advanceTimersByTime(3800 * steps));

describe('LandingHospitalRotation', () => {
    beforeEach(() => {
        motion.reduced = false;
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('changes the official logo together with the hospital name, including Gil Hospital', () => {
        render(<LandingHospitalRotation />);

        expect(screen.getByText('충북대학교병원')).toBeInTheDocument();
        expect(image()).toHaveAttribute('src', landingHospitalLogos['충북대학교병원']?.src);
        expect(image()).toHaveAttribute('alt', '');
        expect(image().closest('[aria-hidden="true"]')).not.toBeNull();

        advance(4);

        expect(screen.getByText('가천대 길병원')).toBeInTheDocument();
        expect(image()).toHaveAttribute('src', landingHospitalLogos['가천대 길병원']?.src);
    });

    it('uses the existing icon for a missing logo and recovers to the next hospital logo', () => {
        render(<LandingHospitalRotation />);
        advance(32);

        expect(screen.getByText('송추정신병원')).toBeInTheDocument();
        expect(image()).toHaveAttribute('src', '/img/landing-hospital-3d-icon.webp');

        advance(1);

        expect(screen.getByText('순천향대학교부속부천병원')).toBeInTheDocument();
        expect(image()).toHaveAttribute('src', landingHospitalLogos['순천향대학교부속부천병원']?.src);
    });

    it('falls back on a failed image without carrying that failure to the next hospital', () => {
        render(<LandingHospitalRotation />);
        fireEvent.error(image());

        expect(image()).toHaveAttribute('src', '/img/landing-hospital-3d-icon.webp');

        advance(1);

        expect(screen.getByText('국제성모병원')).toBeInTheDocument();
        expect(image()).toHaveAttribute('src', landingHospitalLogos['국제성모병원']?.src);
    });

    it('includes Hanbit Hospital at the end and wraps back to the first hospital', () => {
        render(<LandingHospitalRotation />);
        advance(151);

        expect(screen.getByText('한빛병원')).toBeInTheDocument();
        expect(image()).toHaveAttribute('src', landingHospitalLogos['한빛병원']?.src);

        advance(1);

        expect(screen.getByText('충북대학교병원')).toBeInTheDocument();
        expect(image()).toHaveAttribute('src', landingHospitalLogos['충북대학교병원']?.src);
    });

    it('keeps the name and logo stationary when reduced motion is enabled', () => {
        motion.reduced = true;

        const {unmount} = render(<LandingHospitalRotation />);

        advance(5);

        expect(screen.getByText('충북대학교병원')).toBeInTheDocument();
        expect(image()).toHaveAttribute('src', landingHospitalLogos['충북대학교병원']?.src);

        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
});
