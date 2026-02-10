import {useLoadingStore} from './store';

const useLoadingUseCase = () => {
    const setState = useLoadingStore((state) => state.setState);

    return {
        setLoading: (loading: boolean) => setState('loading', loading),
    };
};

export default useLoadingUseCase;
