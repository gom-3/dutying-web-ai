import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
        const {baseElement} = render(<SectionHeader step={3} />);
        const button = screen.getByRole('button', {name: /설명 영상/});

        expect(button).toHaveTextContent('1분');
        expect(button).toHaveAttribute('aria-haspopup', 'dialog');
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(baseElement.querySelector('video, source, img')).toBeNull();

        fireEvent.click(button);

        const video = baseElement.querySelector('video');

        expect(screen.getByRole('dialog', {name: '근무표 입력 방법'})).toContainElement(video);
        expect(video).toHaveAttribute('src', getOnboardingTutorialVideo('ko')?.src);
        expect(video).toHaveAttribute('poster', getOnboardingTutorialVideo('ko')?.poster);
        expect(video).toHaveAttribute('preload', 'none');
        expect(video).toHaveAttribute('playsinline');
        expect(video).toHaveAttribute('controls');
        expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps keyboard focus in the modal and preserves the underlying schedule input', async () => {
        const user = userEvent.setup();

        render(
            <>
                <SectionHeader step={3} />
                <label>
                    간호사 이름
                    <input defaultValue="김간호" />
                </label>
            </>,
        );

        const input = screen.getByRole('textbox', {name: '간호사 이름'});
        const trigger = screen.getByRole('button', {name: /설명 영상/});

        await user.click(trigger);

        const closeButton = screen.getByRole('button', {name: '영상 닫기'});

        expect(closeButton).toHaveFocus();
        expect(screen.queryByRole('textbox', {name: '간호사 이름'})).not.toBeInTheDocument();
        expect(input).toBeInTheDocument();
        await user.tab({shift: true});
        expect(screen.getByRole('combobox', {name: '재생 속도'})).toHaveFocus();
        await user.tab();
        expect(closeButton).toHaveFocus();
        await user.keyboard('{Escape}');
        await waitFor(() => expect(trigger).toHaveFocus());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: '간호사 이름'})).toHaveValue('김간호');
    });

    it('keeps the source available when Strict Mode replays the player effects', () => {
        const {baseElement} = render(
            <StrictMode>
                <SectionHeader step={3} />
            </StrictMode>,
        );

        fireEvent.click(screen.getByRole('button', {name: /설명 영상/}));
        expect(baseElement.querySelector('video')).toHaveAttribute('src', getOnboardingTutorialVideo('ko')?.src);
    });

    it('changes playback speed without replacing or seeking the video and syncs native speed changes', () => {
        const {baseElement} = render(<SectionHeader step={3} />);

        fireEvent.click(screen.getByRole('button', {name: /설명 영상/}));

        const video = baseElement.querySelector('video')!;
        const speed = screen.getByRole('combobox', {name: '재생 속도'});

        expect(speed).toHaveValue('1');
        expect(video.playbackRate).toBe(1);
        video.currentTime = 30;

        for (const rate of [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]) {
            fireEvent.change(speed, {target: {value: String(rate)}});
            expect(video.playbackRate).toBe(rate);
            expect(video.currentTime).toBe(30);
            expect(baseElement.querySelector('video')).toBe(video);
        }

        act(() => {
            video.playbackRate = 1.5;
            fireEvent.rateChange(video);
        });
        expect(speed).toHaveValue('1.5');
    });

    it('keeps the chosen speed after retrying or reopening the video', () => {
        const {baseElement} = render(<SectionHeader step={3} />);

        fireEvent.click(screen.getByRole('button', {name: /설명 영상/}));
        fireEvent.change(screen.getByRole('combobox', {name: '재생 속도'}), {target: {value: '2'}});
        fireEvent.error(baseElement.querySelector('video')!);
        fireEvent.click(screen.getByRole('button', {name: '다시 재생'}));
        expect(baseElement.querySelector('video')?.playbackRate).toBe(2);

        fireEvent.click(screen.getByRole('button', {name: '영상 닫기'}));
        fireEvent.click(screen.getByRole('button', {name: /설명 영상/}));
        expect(screen.getByRole('combobox', {name: '재생 속도'})).toHaveValue('2');
        expect(baseElement.querySelector('video')?.playbackRate).toBe(2);
    });

    it.each(['en', 'ja', 'zh', 'th', 'vi'])('hides the guide for %s without a Korean fallback', async (language) => {
        await act(() => i18n.changeLanguage(language));

        const {baseElement} = render(<SectionHeader step={3} />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(baseElement.querySelector('video')).toBeNull();
    });

    it('shows the guide for regional Korean locales only on the schedule step', async () => {
        await act(() => i18n.changeLanguage('ko-KR'));

        const {rerender} = render(<SectionHeader step={3} />);

        expect(screen.getByRole('button', {name: /설명 영상/})).toBeInTheDocument();
        rerender(<SectionHeader step={4} />);
        expect(screen.queryByRole('button', {name: /설명 영상/})).not.toBeInTheDocument();
        expect(getOnboardingTutorialVideo('fr')).toBeUndefined();
    });

    it('stops playback, releases the source and returns focus when closed', async () => {
        const {baseElement} = render(<SectionHeader step={3} />);
        const button = screen.getByRole('button', {name: /설명 영상/});

        fireEvent.click(button);

        const video = baseElement.querySelector('video');

        fireEvent.click(screen.getByRole('button', {name: '영상 닫기'}));

        expect(baseElement.querySelector('video')).toBeNull();
        expect(video).not.toHaveAttribute('src');
        expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
        expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
        await waitFor(() => expect(button).toHaveFocus());
    });

    it('unmounts an open video on language and step changes', async () => {
        const {baseElement, rerender} = render(<SectionHeader step={3} />);

        fireEvent.click(screen.getByRole('button', {name: /설명 영상/}));
        await act(() => i18n.changeLanguage('ja'));
        expect(baseElement.querySelector('video')).toBeNull();
        expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();

        await act(() => i18n.changeLanguage('ko'));
        expect(screen.getByRole('button', {name: /설명 영상/})).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(screen.getByRole('button', {name: /설명 영상/}));
        rerender(<SectionHeader step={4} />);
        expect(baseElement.querySelector('video')).toBeNull();
    });

    it('lets the visitor retry a failed video and close it with Escape', () => {
        const {baseElement} = render(<SectionHeader step={3} />);

        fireEvent.click(screen.getByRole('button', {name: /설명 영상/}));

        const firstVideo = baseElement.querySelector('video')!;

        fireEvent.error(firstVideo);
        expect(screen.getByRole('alert')).toHaveTextContent('영상을 불러오지 못했어요');
        fireEvent.click(screen.getByRole('button', {name: '다시 재생'}));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(baseElement.querySelector('video')).not.toBe(firstVideo);

        fireEvent.keyDown(screen.getByRole('dialog', {name: '근무표 입력 방법'}), {key: 'Escape'});
        expect(baseElement.querySelector('video')).toBeNull();
    });
});
