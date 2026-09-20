export type TProfileImageValue = {
    profileImgUrl?: string;
    defaultProfileImgId?: number;
};

export const DEFAULT_PROFILE_IMAGE_URL = '/img/default-profile-20260920.png';

const DEFAULT_PROFILE_IMAGE_PATH = /\/(?:profile_img\/default|images\/default)\/profile\d+\.png$/;

export const getProfileImageSources = ({profileImg}: {profileImg?: TProfileImageValue}): string[] => {
    const source = profileImg?.profileImgUrl?.trim();

    if (!source || source === DEFAULT_PROFILE_IMAGE_URL) return [DEFAULT_PROFILE_IMAGE_URL];

    try {
        const {pathname} = new URL(source, 'https://app.dutying.ai');

        if (DEFAULT_PROFILE_IMAGE_PATH.test(pathname)) return [DEFAULT_PROFILE_IMAGE_URL];
    } catch {
        // Let the image error handler fall back when an uploaded URL is invalid.
    }

    return [source, DEFAULT_PROFILE_IMAGE_URL];
};

export const getProfileImageFallbackText = (name?: string) => {
    const firstCharacter = Array.from(name?.trim() ?? '')[0];

    if (!firstCharacter) return '';

    return /^[a-z]$/i.test(firstCharacter) ? firstCharacter.toUpperCase() : firstCharacter;
};
