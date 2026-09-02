import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {StrictMode} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {getOnboardingTutorialVideo} from '../../model/tutorial-video';
import SectionHeader from '../section-header';

describe('onboarding schedule video guide', () => {
    beforeEach(() => {
        vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
        vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('loads no media until the Korean guide button is clicked', () => {
        const {container} = render(<SectionHeader step={3} />);
        const button = screen.getByRole('button', {name: /설명 영상/});

        expect(button).toHaveTextContent('1:53');
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(container.querySelector('video, source, img')).toBeNull();

        fireEvent.click(button);

        const video = container.querySelector('video');

        expect(video).toHaveAttribute('src', getOnboardingTutorialVideo('ko')?.src);
        expect(video).toHaveAttribute('poster', getOnboardingTutorialVideo('ko')?.poster);
        expect(video).toHaveAttribute('preload', 'none');
        expect(video).toHaveAttribute('playsinline');
        expect(video).toHaveAttribute('controls');
        expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps the source available when Strict Mode replays the player effects', () => {
        const {container} = render(
            <StrictMode>
                <SectionHeader step={3} />
            </StrictMode>,
        );

        fireEvent.click(screen.getByRole('button', {name: /설명 영상/}));
        expect(container.querySelector('video')).toHaveAttribute('src', getOnboardingTutorialVideo('ko')?.src);
    });

    it('changes playback speed without replacing or seeking the video and syncs native speed changes', () => {
        const {container} = render(<SectionHeader step={3} />);

        fireEvent.click(screen.getByRole('button', {name: /설명 영상/}));

        const video = container.querySelector('video')!;
        const speed = screen.getByRole('combobox', {name: '재생 속도'});

        expect(speed).toHaveValue('1');
        expect(video.playbackRate).toBe(1);
        video.currentTime = 30;

        for (const rate of [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]) {
            fireEvent.change(speed, {target: {value: String(rate)}});
            expect(video.playbackRate).toBe(rate);
            expect(video.currentTime).toBe(30);
            expect(container.querySelector('video')).toBe(video);
        }

        act(() => {
            video.playbackRate = 1.5;
            fireEvent.rateChange(video);
        });
        expect(speed).toHaveValue('1.5');
    });

    it('keeps the chosen speed after retrying or reopening the video', () => {
        const {container} = render(<SectionHeader step={3} />);

        fireEvent.click(screen.getByRole('button', {name: /설명 영상/}));
        fireEvent.change(screen.getByRole('combobox', {name: '재생 속도'}), {target: {value: '2'}});
        fireEvent.error(container.querySelector('video')!);
        fireEvent.click(screen.getByRole('button', {name: '다시 재생'}));
        expect(container.querySelector('video')?.playbackRate).toBe(2);

        fireEvent.click(screen.getByRole('button', {name: '영상 닫기'}));
        fireEvent.click(screen.getByRole('button', {name: /설명 영상/}));
        expect(screen.getByRole('combobox', {name: '재생 속도'})).toHaveValue('2');
        expect(container.querySelector('video')?.playbackRate).toBe(2);
    });

    it.each(['en', 'ja', 'zh', 'th', 'vi'])('hides the guide for %s without a Korean fallback', async (language) => {
        await act(() => i18n.changeLanguage(language));

        const {container} = render(<SectionHeader step={3} />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(container.querySelector('video')).toBeNull();
    });

    it('shows the guide for regional Korean locales only on the schedule step', async () => {
        await act(() => i18n.changeLanguage('ko-KR'));

        const {rerender} = render(<SectionHeader step={3} />);

        expect(screen.getByRole('button', {name: /설명 영상/})).toBeInTheDocument();
        rerender(<SectionHeader step={4} />);
        expect(screen.queryByRole('button', {name: /설명 영상/})).not.toBeInTheDocument();
        expect(getOnboardingTutorialVideo('fr')).toBeUndefined();
    });

    it('stops playback, releases the source and returns focus when closed', () => {
        const {container} = render(<SectionHeader step={3} />);
        const button = screen.getByRole('button', {name: /설명 영상/});

        fireEvent.click(button);

        const video = container.querySelector('video');

        fireEvent.click(screen.getByRole('button', {name: '영상 닫기'}));

        expect(container.querySelector('video')).toBeNull();
        expect(video).not.toHaveAttribute('src');
        expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
        expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
        expect(button).toHaveFocus();
    });

    it('unmounts an open video on language and step changes', async () => {
        const {container, rerender} = render(<SectionHeader step={3} />);

        fireEvent.click(screen.getByRole('button', {name: /설명 영상/}));
        await act(() => i18n.changeLanguage('ja'));
        expect(container.querySelector('video')).toBeNull();
        expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();

        await act(() => i18n.changeLanguage('ko'));
        expect(screen.getByRole('button', {name: /설명 영상/})).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(screen.getByRole('button', {name: /설명 영상/}));
        rerender(<SectionHeader step={4} />);
        expect(container.querySelector('video')).toBeNull();
    });

    it('lets the visitor retry a failed video and close it with Escape', () => {
        const {container} = render(<SectionHeader step={3} />);

        fireEvent.click(screen.getByRole('button', {name: /설명 영상/}));

        const firstVideo = container.querySelector('video')!;

        fireEvent.error(firstVideo);
        expect(screen.getByRole('alert')).toHaveTextContent('영상을 불러오지 못했어요');
        fireEvent.click(screen.getByRole('button', {name: '다시 재생'}));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(container.querySelector('video')).not.toBe(firstVideo);

        fireEvent.keyDown(screen.getByRole('region', {name: '근무표 입력 방법'}), {key: 'Escape'});
        expect(container.querySelector('video')).toBeNull();
    });
});
