import {type ReactNode} from 'react';
import {useNavigate} from 'react-router';
import logoWordmarkPurple from '@/shared/assets/images/logo-wordmark-purple.png';
import ROUTE from '@/shared/constant/path';

type TRegisterShellProps = {
    children: ReactNode;
    maxWidth?: string;
};

function RegisterShell({children, maxWidth = 'max-w-[480px]'}: TRegisterShellProps) {
    const navigate = useNavigate();

    return (
        <div className="min-h-full bg-main-bg px-4 pt-7 font-apple md:px-10">
            <button
                type="button"
                className="flex h-11 cursor-pointer items-center rounded-[12px] bg-transparent px-2"
                onClick={() => navigate(ROUTE.ROOT)}
                aria-label="듀팅 홈으로 이동"
            >
                <img src={logoWordmarkPurple} alt="dutying" className="h-[32.4px] w-[118.8px] object-contain" />
            </button>
            <main className={`mx-auto flex w-full ${maxWidth} flex-col pt-10 pb-10 md:pt-16 md:pb-16`}>{children}</main>
        </div>
    );
}

export default RegisterShell;
