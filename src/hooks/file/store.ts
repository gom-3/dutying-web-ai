import {AccountAPI} from '@/libs/api';
import {createStore} from '@/libs/util/create-store';

interface IState {
    imageBaseUrl: string;
    defaultProfileImages: string[];
}

const initialState: IState = {
    imageBaseUrl: '',
    defaultProfileImages: [],
};

export const useProfileImageStore = createStore<IState>(initialState, {name: 'useProfileImageStore'});

AccountAPI.getDefaultProfileImages().then((images) => {
    useProfileImageStore.setState({
        defaultProfileImages: images,
        imageBaseUrl: (() => {
            const match = images[0]?.match(/^(https:\/\/[^/]+)\//);

            return match ? match[1] : 'https://dutying-prod.s3.ap-northeast-2.amazonaws.com';
        })(),
    });
});

const DEFAULT_IMAGE_BASE_URL = 'https://dutying-prod.s3.ap-northeast-2.amazonaws.com';

export const initializeProfileImageStore = async () => {
    try {
        const images = await AccountAPI.getDefaultProfileImages();
        const match = images[0]?.match(/^(https:\/\/[^/]+)\//);

        useProfileImageStore.setState({
            defaultProfileImages: images,
            imageBaseUrl: match ? match[1] : DEFAULT_IMAGE_BASE_URL,
        });
    } catch (error) {
        console.error('Failed to initialize profile image store:', error);
        useProfileImageStore.setState({
            imageBaseUrl: DEFAULT_IMAGE_BASE_URL,
        });
    }
};
