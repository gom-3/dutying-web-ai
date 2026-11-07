import {useEffect, useState} from 'react';

const eventName = 'dutying-schedule-display';
const key = (wardId: number | null) => `schedule-display:${wardId}`;

function readAnnualLeave(wardId: number | null): boolean {
    if (wardId == null) return false;

    try {
        const saved = JSON.parse(localStorage.getItem(key(wardId)) ?? 'null');

        return typeof saved?.annualLeave === 'boolean'
            ? saved.annualLeave
            : localStorage.getItem(`annual-leave-display:${wardId}`) === 'true';
    } catch {
        return false;
    }
}

export function useScheduleDisplay(wardId: number | null) {
    const [snapshot, setSnapshot] = useState(() => ({wardId, showAnnualLeave: readAnnualLeave(wardId)}));
    const showAnnualLeave = snapshot.wardId === wardId ? snapshot.showAnnualLeave : readAnnualLeave(wardId);

    useEffect(() => {
        const sync = () => setSnapshot({wardId, showAnnualLeave: readAnnualLeave(wardId)});

        sync();
        window.addEventListener('storage', sync);
        window.addEventListener(eventName, sync);

        return () => {
            window.removeEventListener('storage', sync);
            window.removeEventListener(eventName, sync);
        };
    }, [wardId]);

    const setShowAnnualLeave = (checked: boolean) => {
        try {
            if (wardId != null) localStorage.setItem(key(wardId), JSON.stringify({annualLeave: checked}));

            window.dispatchEvent(new Event(eventName));
        } catch {
            // The current screen remains usable when storage is unavailable.
        }

        setSnapshot({wardId, showAnnualLeave: checked});
    };

    return {showAnnualLeave, setShowAnnualLeave};
}
