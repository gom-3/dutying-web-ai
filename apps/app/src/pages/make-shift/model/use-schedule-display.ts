import {useEffect, useState} from 'react';

export type TScheduleDisplay = {rest: boolean; annualLeave: boolean};

const defaults: TScheduleDisplay = {rest: true, annualLeave: false};
const eventName = 'dutying-schedule-display';
const key = (wardId: number | null) => `schedule-display:${wardId}`;

function read(wardId: number | null): TScheduleDisplay {
    if (wardId == null) return defaults;

    try {
        const saved = JSON.parse(localStorage.getItem(key(wardId)) ?? 'null');

        return {
            rest: typeof saved?.rest === 'boolean' ? saved.rest : true,
            annualLeave:
                typeof saved?.annualLeave === 'boolean'
                    ? saved.annualLeave
                    : localStorage.getItem(`annual-leave-display:${wardId}`) === 'true',
        };
    } catch {
        return defaults;
    }
}

/** Display only: changing these preferences never changes a ward's calculation policy. */
export function useScheduleDisplay(wardId: number | null) {
    const [snapshot, setSnapshot] = useState(() => ({wardId, value: read(wardId)}));
    const value = snapshot.wardId === wardId ? snapshot.value : read(wardId);

    useEffect(() => {
        const sync = () => setSnapshot({wardId, value: read(wardId)});

        sync();
        window.addEventListener('storage', sync);
        window.addEventListener(eventName, sync);

        return () => {
            window.removeEventListener('storage', sync);
            window.removeEventListener(eventName, sync);
        };
    }, [wardId]);

    const change = (field: keyof TScheduleDisplay, checked: boolean) => {
        const next = {...value, [field]: checked};

        try {
            if (wardId != null) localStorage.setItem(key(wardId), JSON.stringify(next));

            window.dispatchEvent(new Event(eventName));
        } catch {
            // The current screen remains usable when storage is unavailable.
        }

        setSnapshot({wardId, value: next});
    };

    return {value, change};
}
