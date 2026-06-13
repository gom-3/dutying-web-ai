import {koToEn} from '@dutying/utils/ko-to-en';
import type {TRequestShift, TWardConstraint, TShiftNurse, TWardShiftType, TShift} from '@/entities';
import i18n from '@/i18n';
import {type TFault, type TCheckFaultOptions, type TFocus, type TFaultType, type TRequestShiftEditAvailability} from './types';

const t = (key: string, values?: Record<string, string | number>) => i18n.t(key, values);
const getMonthIndex = (year: number, month: number) => year * 12 + month;

export const getRequestShiftEditAvailability = (year: number, month: number, now: Date = new Date()): TRequestShiftEditAvailability => {
    const currentMonthIndex = getMonthIndex(now.getFullYear(), now.getMonth() + 1);
    const targetMonthIndex = getMonthIndex(year, month);

    if (targetMonthIndex < currentMonthIndex - 1) {
        return {
            canEdit: false,
            status: 'lockedPast',
            validationMessage: t('page.request.availability.lockedPast.validationMessage'),
            badgeLabel: t('page.request.availability.lockedPast.badgeLabel'),
            periodLabel: t('page.request.availability.editablePeriodLabel'),
            description: t('page.request.availability.lockedPast.description'),
        };
    }

    if (targetMonthIndex > currentMonthIndex + 1) {
        return {
            canEdit: false,
            status: 'lockedFuture',
            validationMessage: t('page.request.availability.lockedFuture.validationMessage'),
            badgeLabel: t('page.request.availability.lockedFuture.badgeLabel'),
            periodLabel: t('page.request.availability.editablePeriodLabel'),
            description: t('page.request.availability.lockedFuture.description'),
        };
    }

    return {
        canEdit: true,
        status: 'editable',
        validationMessage: null,
        badgeLabel: t('page.request.availability.editable.badgeLabel'),
        periodLabel: t('page.request.availability.editablePeriodLabel'),
        description: t('page.request.availability.editable.description'),
    };
};

export const moveFocus = (
    direction: 'left' | 'right' | 'up' | 'down',
    moveEnd: boolean,
    shift: TShift | TRequestShift,
    focus: TFocus,
    setFocus: (focus: TFocus) => void,
) => {
    const flatNurses = shift.divisionShiftNurses.flatMap<{shiftNurse: TShiftNurse}>((x) => x).map((x) => x.shiftNurse);
    const {day, shiftNurseId} = focus;
    const dayCnt = shift.days.length;
    const nurseIndex = flatNurses.findIndex((x) => x.shiftNurseId === shiftNurseId);

    let newNurseId = shiftNurseId;
    let newDay = day;

    switch (direction) {
        case 'left': {
            if (day === 0) {
                if (nurseIndex === 0) {
                    newDay = dayCnt - 1;
                    newNurseId = flatNurses[flatNurses.length - 1].shiftNurseId;
                } else {
                    newNurseId = flatNurses[nurseIndex - 1].shiftNurseId;
                    newDay = dayCnt - 1;
                }
            } else {
                newDay = moveEnd ? 0 : Math.max(0, day - 1);
            }

            break;
        }
        case 'right': {
            if (day === dayCnt - 1) {
                if (nurseIndex === flatNurses.length - 1) {
                    newNurseId = flatNurses[0].shiftNurseId;
                    newDay = 0;
                } else {
                    newNurseId = flatNurses[nurseIndex + 1].shiftNurseId;
                    newDay = 0;
                }
            } else {
                newDay = moveEnd ? dayCnt - 1 : Math.min(dayCnt - 1, day + 1);
            }

            break;
        }
        case 'up': {
            if (nurseIndex === 0) {
                newNurseId = flatNurses[flatNurses.length - 1].shiftNurseId;
                newDay = day;
            } else {
                newNurseId = moveEnd ? flatNurses[0].shiftNurseId : flatNurses[nurseIndex - 1].shiftNurseId;
                newDay = day;
            }

            break;
        }
        case 'down': {
            if (nurseIndex === flatNurses.length - 1) {
                newNurseId = flatNurses[0].shiftNurseId;
                newDay = day;
            } else {
                newNurseId = moveEnd ? flatNurses[flatNurses.length - 1].shiftNurseId : flatNurses[nurseIndex + 1].shiftNurseId;
                newDay = day;
            }

            break;
        }
    }

    if (newDay != day || newNurseId != shiftNurseId) {
        setFocus({
            day: newDay,

            shiftNurseName: findNurse(shift, shiftNurseId)!.name,
            shiftNurseId: newNurseId,
        });
    }
};

export const keydownEventMapper = (e: KeyboardEvent, ...op: {keys: string[]; callback: () => void}[]) => {
    op.forEach(({keys, callback}) => {
        if (keys.map((key) => key.toUpperCase()).indexOf(koToEn(e.key).toUpperCase()) != -1) {
            callback();
        }
    });
};

export const updateCheckFaultOption = (wardConstraint: TWardConstraint): TCheckFaultOptions => {
    return {
        maxContinuousWork: {
            type: 'wrong',
            isActive: wardConstraint.maxContinuousWork,
            regExp: new RegExp(`[den][den]{${wardConstraint.maxContinuousWorkVal - 1},}[den]`, 'g'),
            message: t('page.request.faultOptions.maxContinuousWork.message', {count: wardConstraint.maxContinuousWorkVal}),
            value: wardConstraint.maxContinuousWorkVal,
            label: t('page.request.faultOptions.maxContinuousWork.label'),
        },
        minNightInterval: {
            type: 'wrong',
            isActive: wardConstraint.minNightInterval,
            regExp: new RegExp(`n[^n]{1,${wardConstraint.minNightIntervalVal - 1}}n`, 'g'),
            message: t('page.request.faultOptions.minNightInterval.message', {count: wardConstraint.minNightIntervalVal}),
            value: wardConstraint.minNightIntervalVal,
            label: t('page.request.faultOptions.minNightInterval.label'),
        },
        maxContinuousNight: {
            type: 'wrong',
            isActive: wardConstraint.maxContinuousNight,
            regExp: new RegExp(`n{${wardConstraint.maxContinuousNightVal + 1},}`, 'g'),
            message: t('page.request.faultOptions.maxContinuousNight.message', {count: wardConstraint.maxContinuousNightVal}),
            value: wardConstraint.maxContinuousNightVal,
            label: t('page.request.faultOptions.maxContinuousNight.label'),
        },
        minContinuousNight: {
            type: 'bad',
            isActive: wardConstraint.minContinuousNight,
            regExp: new RegExp(`[^n-]n{1,${wardConstraint.minContinuousNightVal - 1}}[^n-]`, 'g'),
            message: t('page.request.faultOptions.minContinuousNight.message', {count: wardConstraint.minContinuousNightVal}),
            value: wardConstraint.minContinuousNightVal,
            label: t('page.request.faultOptions.minContinuousNight.label'),
        },
        minOffAssignAfterNight: {
            type: 'bad',
            isActive: wardConstraint.minOffAssignAfterNight,
            regExp: new RegExp(`n([de]|o{1,${wardConstraint.minOffAssignAfterNightVal - 1}}[den])`, 'g'),
            message: t('page.request.faultOptions.minOffAssignAfterNight.message', {
                count: wardConstraint.minOffAssignAfterNightVal,
            }),
            value: wardConstraint.minOffAssignAfterNightVal,
            label: t('page.request.faultOptions.minOffAssignAfterNight.label'),
        },
        excludeCertainWorkTypes: {
            type: 'bad',
            isActive: wardConstraint.excludeCertainWorkTypes,
            regExp: new RegExp(`(ed|nd|ne|nod)`, 'g'),
            message: t('page.request.faultOptions.excludeCertainWorkTypes.message'),
            value: null,
            label: t('page.request.faultOptions.excludeCertainWorkTypes.label'),
        },
        excludeNightBeforeReqOff: {
            type: 'bad',
            isActive: wardConstraint.excludeNightBeforeReqOff,
            regExp: new RegExp(`nO`, 'g'),
            message: t('page.request.faultOptions.excludeNightBeforeReqOff.message'),
            value: null,
            label: t('page.request.faultOptions.excludeNightBeforeReqOff.label'),
        },
    };
};

export const checkShift = (shift: TShift, checkFaultOptions: TCheckFaultOptions, wardShiftTypeMap: Map<number, TWardShiftType>) => {
    const faults: Map<string, TFault> = new Map();

    for (let i = 0; i < shift.divisionShiftNurses.length; i++) {
        const division = shift.divisionShiftNurses[i];

        for (let j = 0; j < division.length; j++) {
            const row = division[j];

            let str = row.wardShiftList
                .map((x, index) =>
                    x === null
                        ? '-'
                        : x === row.wardReqShiftList[index]
                          ? wardShiftTypeMap.get(x)?.shortName.toUpperCase()
                          : wardShiftTypeMap.get(x)?.shortName.toLowerCase(),
                )
                .join('');

            str = '-' + str + '-'; // Pad edges so single-night checks can inspect boundaries.

            for (const key of Object.keys(checkFaultOptions) as TFaultType[]) {
                const option = checkFaultOptions[key];

                if (option.isActive === false) continue;

                while (true) {
                    const match = option.regExp.exec(str);

                    if (match === null) break;

                    const focus: TFocus = {
                        shiftNurseId: row.shiftNurse.shiftNurseId,
                        shiftNurseName: row.shiftNurse.name,
                        day: match.index - 1,
                    };

                    faults.set(Object.values({shiftNurseId: focus.shiftNurseId, day: focus.day}).join(','), {
                        type: option.type,
                        faultType: key,
                        nurseName: row.shiftNurse.name,
                        focus,
                        message: option.message,
                        matchString: match[0],
                        length: match[0].length,
                    });
                }
            }
        }
    }

    return faults;
};

export const findNurse = (shift: TShift | TRequestShift, shiftNurseId: number) => {
    return (
        shift.divisionShiftNurses.flatMap<{shiftNurse: TShiftNurse}>((x) => x).find((x) => x.shiftNurse.shiftNurseId === shiftNurseId)
            ?.shiftNurse ?? null
    );
};
