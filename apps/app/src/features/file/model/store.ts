import * as Sentry from '@sentry/react';
import {AccountAPI} from '@/shared/api';
import {RUNTIME_CONFIG} from '@/shared/config/runtime';
import {createStore} from '@/shared/util/create-store';

interface IState {
    imageBaseUrl: string;
    defaultProfileImages: string[];
}

const initialState: IState = {
    imageBaseUrl: '',
    defaultProfileImages: [],
};
const DEFAULT_IMAGE_BASE_URL = RUNTIME_CONFIG.profileImageBaseUrl();

export const useProfileImageStore = createStore<IState>(initialState, {name: 'useProfileImageStore'});

const getImageUrls = (images: Awaited<ReturnType<typeof AccountAPI.getDefaultProfileImages>>) =>
    Array.isArray(images) ? images.map((image) => image.url).filter(Boolean) : [];

const getImageBaseUrl = (imageUrls: string[]) => {
    const match = imageUrls[0]?.match(/^(https:\/\/[^/]+)\//);

    return match ? match[1] : DEFAULT_IMAGE_BASE_URL;
};

export const initializeProfileImageStore = async () => {
    try {
        const images = await AccountAPI.getDefaultProfileImages();
        const imageUrls = getImageUrls(images);

        useProfileImageStore.setState({
            defaultProfileImages: imageUrls,
            imageBaseUrl: getImageBaseUrl(imageUrls),
        });
    } catch (error) {
        Sentry.captureException(error, {
            tags: {feature: 'profile-image', action: 'initialize-store'},
        });
        useProfileImageStore.setState({
            imageBaseUrl: DEFAULT_IMAGE_BASE_URL,
        });
    }
};
