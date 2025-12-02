import {LogoWithSymbol} from '@/shared/assets/svg';

const MobileHeader = () => {
    return (
        <div className="fixed top-0 z-10 h-[60px] w-full bg-white">
            <div className="mx-auto flex h-full w-[85%] items-center">
                <LogoWithSymbol className="w-[98.5504px] shrink-0" />
                <div className="flex w-full items-center">
                    <a
                        href="https://abr.ge/bv13wa"
                        target="_blank"
                        className="ml-auto rounded-[1.875rem] bg-main-1 px-[10px] py-[5px] font-apple text-[12px] font-semibold text-white"
                        rel="noreferrer"
                    >
                        다운로드
                    </a>
                </div>
            </div>
        </div>
    );
};

export default MobileHeader;
