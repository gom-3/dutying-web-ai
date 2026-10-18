import type {TScheduleObservation} from '@dutying/api/ward';
import type {ReactNode} from 'react';
import {useScheduleJourneyDisplay} from '../../../model/use-schedule-journey-display';

export function JourneyObserved({
    observation,
    children,
    className,
    inert,
}: {
    observation?: TScheduleObservation;
    children: ReactNode;
    className?: string;
    inert?: boolean;
}) {
    const ref = useScheduleJourneyDisplay(observation);
    return (
        <div ref={ref} className={className} inert={inert}>
            {children}
        </div>
    );
}
