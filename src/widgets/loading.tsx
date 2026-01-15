import Lottie from 'react-lottie';
import {useLoadingStore} from '@/features/ui/useLoading/store';
import loadingLottie from '@/shared/assets/animation/loading.json';

const Loading = () => {
    const loading = useLoadingStore((state) => state.loading);

    return (
        loading && (
            <div className="fixed z-1005 flex h-screen w-screen items-center justify-center bg-[#0000006e] backdrop-blur-[1px]">
                <Lottie
                    options={{
                        autoplay: true,
                        loop: true,
                        animationData: loadingLottie,
                        rendererSettings: {
                            preserveAspectRatio: 'xMidYMid slice',
                        },
                    }}
                    height={400}
                    width={400}
                />
            </div>
        )
    );
};

export default Loading;
