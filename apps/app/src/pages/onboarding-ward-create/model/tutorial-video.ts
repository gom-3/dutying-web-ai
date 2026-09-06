import type {TPreferredLanguage} from '@dutying/domain';
import {normalizePreferredLanguage} from '@/shared/i18n/locale';

export type TOnboardingTutorialVideo = {
    src: string;
    poster: string;
    durationLabel: string;
};

const configuredCdnUrl = import.meta.env.VITE_ONBOARDING_VIDEO_BASE_URL?.trim();
const CDN_BASE_URL = (configuredCdnUrl?.length ? configuredCdnUrl : 'https://d2p65uxyq3mfp8.cloudfront.net').replace(/\/+$/, '');
// Add each language only after its video and poster are available on the CDN.
// There is deliberately no Korean fallback for other interface languages.
const TUTORIAL_VIDEOS: Partial<Record<TPreferredLanguage, TOnboardingTutorialVideo>> = {
    ko: {
        src: `${CDN_BASE_URL}/onboarding/ko/ward-onboarding-ko-20260902-v1.mp4`,
        poster: `${CDN_BASE_URL}/onboarding/ko/ward-onboarding-ko-20260902-v1.webp`,
        durationLabel: '1:53',
    },
};

export const getOnboardingTutorialVideo = (language?: string | null) => {
    const normalizedLanguage = normalizePreferredLanguage(language);

    return normalizedLanguage ? TUTORIAL_VIDEOS[normalizedLanguage] : undefined;
};
