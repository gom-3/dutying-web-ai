import {type TLocale} from './ko';

export const en: TLocale = {
    page: {
        landing: {
            title: 'Duty Schedule\nNow Easier!',
        },
        makeShift: {
            constraints: {
                section: {
                    strong: 'Hard constraints',
                    weak: 'Soft constraints',
                    excluded: 'Excluded',
                },
                info: 'You can drag to reorder by your preferred priority.',
                count: '{{count}}',
                empty: 'No constraints to show.',
                dragHandleAria: 'Drag to reorder',
                violationCount: '{{count}}',
                phrase: {
                    max: 'Max',
                    min: 'Min',
                    day: 'days',
                    lte: 'or less',
                    gte: 'or more',
                },
                rule: {
                    maxContinuousWork: {label: 'Max consecutive work days'},
                    minNightInterval: {label: 'Min interval between nights'},
                    maxContinuousNight: {label: 'Max consecutive nights'},
                    minContinuousNight: {label: 'Min consecutive nights'},
                    minOffAssignAfterNight: {label: 'Recommended OFF after night'},
                    excludeCertainWorkTypes: {label: 'Avoid ND / ED / NE / NOD patterns'},
                    excludeNightBeforeReqOff: {label: 'Avoid night before requested OFF'},
                },
            },
            workers: {
                totalCount: 'Total {{count}}',
                sortByLevel: 'Sort by level',
                column: {
                    name: 'Name',
                    level: 'Level',
                    shiftTypes: 'Available shifts',
                    memo: 'Memo',
                },
                dragHandleAria: 'Drag to reorder',
            },
        },
        refresh: {
            loading: 'Logging in...',
        },
    },
    feature: {
        auth: {
            sessionExpired: 'Your login has expired. Please sign in again.',
        },
    },
};
