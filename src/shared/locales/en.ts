import {type TLocale} from './ko';

export const en: TLocale = {
    page: {
        landing: {
            title: 'Duty Schedule\nNow Easier!',
        },
        makeShift: {
            overview: {
                loading: 'Loading duty schedule...',
                shiftExists: '{{teamName}} has a schedule for {{month}}.',
                shiftEmpty: "{{teamName}}'s {{month}} schedule is empty.",
                checking: 'Checking schedule status.',
                viewShift: 'View {{month}} duty schedule',
                createShift: 'Create {{month}} duty schedule',
                noTeamsTitle: 'No shift teams found.',
                noTeamsDescription: 'Create a shift team first or check ward settings.',
            },
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
        duty: {
            prevMonth: 'Previous month',
            nextMonth: 'Next month',
            monthHeader: '{{year}}-{{month}}',
            title: 'Duty management',
            confirmedShift: 'Confirmed duty schedule',
            createCurrentMonth: 'Create this month schedule',
            createNextMonth: 'Create next month schedule',
            publish: 'Publish',
            exportExcel: 'Export Excel',
            editShift: 'Edit duty schedule',
            save: 'Save',
            cancel: 'Cancel',
            loading: 'Loading duty schedule...',
            error: 'Failed to load duty schedule.',
            noTeamsTitle: 'No shift teams found.',
            noTeamsDescription: 'Create a shift team and try again.',
            emptyTitle: 'No {{month}} schedule for {{teamName}}.',
            emptyDescription: 'Go to schedule creation to start the {{month}} schedule.',
        },
        refresh: {
            loading: 'Logging in...',
        },
    },
    feature: {
        auth: {
            sessionExpired: 'Your login has expired. Please sign in again.',
        },
        shiftEditor: {
            panel: {
                histories: 'History',
                faults: 'Violations',
                history: {
                    reordered: 'Reordered workers',
                    editedCells: 'Edited {{count}} cells by {{source}}',
                    defaultLabel: 'Edit history',
                    empty: 'No edit history.',
                    sourceAi: 'AI',
                    sourceSystem: 'System',
                    sourceUser: 'Manual',
                },
                faultsEmpty: 'No violations.',
                fold: 'Close',
                expand: 'Expand',
            },
        },
    },
};
