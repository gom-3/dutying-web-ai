import type {ReactNode} from 'react';

function RegisterHeading({children}: {children: ReactNode}) {
    return (
        <h1 className="min-w-0 text-2xl leading-[1.4] font-semibold text-balance wrap-anywhere text-sub-1 [line-break:strict] sm:text-[2rem] [&:lang(ko)]:break-keep">
            {children}
        </h1>
    );
}

export default RegisterHeading;
