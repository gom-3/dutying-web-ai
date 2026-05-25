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
        <div className="min-h-full bg-[#FAF8FB] px-4 py-7 font-apple md:px-10">
            <button
                type="button"
                className="h-11 cursor-pointer rounded-[12px] bg-transparent px-2"
                onClick={() => navigate(ROUTE.ROOT)}
                aria-label="듀팅 홈으로 이동"
            >
                <img src={logoWordmarkPurple} alt="dutying" className="h-9 w-[132px] object-contain" />
            </button>
            <main className={`mx-auto flex w-full ${maxWidth} flex-col py-10 md:py-16`}>{children}</main>
        </div>
    );
}

export default RegisterShell;
