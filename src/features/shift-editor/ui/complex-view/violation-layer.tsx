import React from 'react';
import {FaultDotIcon} from '@/shared/assets/svg';
import {type TViolation} from '../../model';

interface IViolationLayerProps {
    violation: TViolation;
    children?: React.ReactNode;
}

function ViolationLayer({violation, children}: IViolationLayerProps) {
    return (
        <>
            <div
                style={{
                    width: `calc(2.125rem + 2.25rem * ${violation.cells.length - 1})`,
                }}
                className={`group absolute left-[.0625rem] z-10 h-8.5 rounded-[.5625rem] border-[.125rem] border-[#FF0000] bg-[#ff000033]`}
            >
                <FaultDotIcon className="absolute top-[-0.85rem] right-0 h-[.75rem] w-[.75rem]" />
                {children}
            </div>
            <div className="invisible absolute -bottom-6.5 z-31 rounded-md bg-white px-2 py-1 font-apple text-sm whitespace-nowrap text-sub-1 shadow-banner group-hover:visible">
                <div
                    className="absolute -top-1.5 left-[50%] z-31 h-0 w-0 translate-x-[-50%]"
                    style={{
                        borderTop: '.625rem solid none',
                        borderLeft: '.4375rem solid transparent',
                        borderRight: '.4375rem solid transparent',
                        borderBottom: '.625rem solid white',
                    }}
                />
                {violation.message}
            </div>
        </>
    );
}

export default ViolationLayer;
