import logoWordmarkPurple from '@/shared/assets/images/logo-wordmark-purple.png';
import ROUTE from '@/shared/constant/path';

function HeaderLogo() {
    return (
        <a href={ROUTE.ROOT} className="fixed top-7 left-4 z-50 flex h-11 items-center px-2 md:left-10">
            <img src={logoWordmarkPurple} alt="dutying" className="h-[32.4px] w-[118.8px] object-contain" />
        </a>
    );
}

export default HeaderLogo;
