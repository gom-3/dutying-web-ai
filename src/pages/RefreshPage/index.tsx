import {useEffect} from 'react';
import {TailSpin} from 'react-loader-spinner';
import useRefresh from '@/features/auth/useRefresh';

function RefreshPage() {
    const {refresh} = useRefresh();

    useEffect(() => {
        refresh();
    }, [refresh]);

    return (
        <div className="flex h-screen w-screen flex-col items-center justify-center">
            로그인중입니다.
            <TailSpin color="#844AFF" />
        </div>
    );
}

export default RefreshPage;
