import {type CSSProperties, useLayoutEffect, useRef, useState} from 'react';
import './calendar-nurse-name.css';

export function CalendarNurseName({name, displayName, focusable = true}: {name: string; displayName: string; focusable?: boolean}) {
    const fullName = name.trim();
    const viewportRef = useRef<HTMLSpanElement>(null);
    const trackRef = useRef<HTMLSpanElement>(null);
    const [measurement, setMeasurement] = useState({distance: 0, clipped: displayName !== fullName});

    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        const track = trackRef.current;

        if (!viewport || !track) return;

        const measure = () => {
            const distance = Math.max(0, track.scrollWidth - viewport.clientWidth);
            const clipped = displayName !== fullName || distance > 1;

            setMeasurement((previous) => (previous.distance === distance && previous.clipped === clipped ? previous : {distance, clipped}));
        };

        measure();

        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);

        observer?.observe(viewport);
        observer?.observe(track);
        document.fonts?.addEventListener('loadingdone', measure);

        return () => {
            observer?.disconnect();
            document.fonts?.removeEventListener('loadingdone', measure);
        };
    }, [displayName, fullName]);

    return (
        <span
            ref={viewportRef}
            className="make-shift-calendar__nurse-name"
            data-clipped={measurement.clipped}
            data-overflow={measurement.distance > 1}
            tabIndex={focusable && measurement.clipped ? 0 : undefined}
            style={
                {
                    '--nurse-name-distance': `${-measurement.distance}px`,
                    '--nurse-name-duration': `${Math.max(1.5, measurement.distance / 28)}s`,
                } as CSSProperties
            }
        >
            <span className="sr-only">{fullName}</span>
            <span className="make-shift-calendar__nurse-name-preview" aria-hidden="true">
                {displayName}
            </span>
            <span ref={trackRef} className="make-shift-calendar__nurse-name-track" aria-hidden="true">
                {fullName}
            </span>
        </span>
    );
}
