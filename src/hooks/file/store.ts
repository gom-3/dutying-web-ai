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
