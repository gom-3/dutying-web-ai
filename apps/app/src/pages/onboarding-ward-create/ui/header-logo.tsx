import logoWordmarkPurple from '@/shared/assets/images/logo-wordmark-purple.png';
import ROUTE from '@/shared/constant/path';

function HeaderLogo() {
    return (
        <div className="px-4 pt-7 md:px-10">
            <a href={ROUTE.ROOT} className="flex h-11 w-fit items-center px-2">
                <img src={logoWordmarkPurple} alt="dutying" className="h-[32.4px] w-[118.8px] object-contain" />
            </a>
        </div>
    );
}

export default HeaderLogo;
