import {getDutyRuleDefinitions, type DutyRuleKey} from '@/shared/editor/duty/validation/validator';
import type {Nurse} from '@/entities/nurse';
import type {WardShiftType, WardConstraint} from '@/entities/ward';

export type Focus = {
    shiftNurseName: string;
    shiftNurseId: number;
    day: number;
};

export type DayInfo = {
    countByShiftList: {count: number; shiftType: WardShiftType}[];
    month: number;
    day: number;
    nurse: Nurse;
    message: string;
};

export type FaultType = DutyRuleKey;

export type CheckFaultOptions = {
    [key in FaultType]: {
        type: 'wrong' | 'bad';
        label: string;
        isActive: boolean;
        regExp: RegExp;
        message: string;
        value: number | null;
    };
};

export type Fault = {
    type: 'wrong' | 'bad';
    faultType: FaultType;
    message: string;
    nurseName: string;
    focus: Focus;
    matchString: string;
    length: number;
};

export type Faults = Map<string, Fault>;

export function buildCheckFaultOptions(wardConstraint: WardConstraint): CheckFaultOptions {
    const defs = getDutyRuleDefinitions({wardConstraint});
    const byKey = new Map(defs.map((d) => [d.key, d] as const));
    const meta: Record<FaultType, {label: string; value: number | null}> = {
        maxContinuousWork: {label: '연속 근무 수', value: wardConstraint.maxContinuousWorkVal},
        minNightInterval: {label: '나이트 간격', value: wardConstraint.minNightIntervalVal},
        maxContinuousNight: {label: '연속 나이트', value: wardConstraint.maxContinuousNightVal},
        minContinuousNight: {label: '연속 나이트', value: wardConstraint.minContinuousNightVal},
        minOffAssignAfterNight: {label: '나이트 근무 후 오프 배정', value: wardConstraint.minOffAssignAfterNightVal},
        excludeCertainWorkTypes: {label: 'ND / ED / NE / NOD 근무 패턴 불가능', value: null},
        excludeNightBeforeReqOff: {label: '신청 오프 전날에는 나이트 근무 불가능', value: null},
    };
    const toOption = (key: FaultType) => {
        const def = byKey.get(key);

        if (!def) throw new Error(`Missing duty rule definition: ${key}`);

        return {
            type: def.level === 'error' ? ('wrong' as const) : ('bad' as const),
            label: meta[key].label,
            isActive: def.isActive,
            regExp: def.regExp,
            message: def.message,
            value: meta[key].value,
        };
    };

    return {
        maxContinuousWork: toOption('maxContinuousWork'),
        minNightInterval: toOption('minNightInterval'),
        maxContinuousNight: toOption('maxContinuousNight'),
        minContinuousNight: toOption('minContinuousNight'),
        minOffAssignAfterNight: toOption('minOffAssignAfterNight'),
        excludeCertainWorkTypes: toOption('excludeCertainWorkTypes'),
        excludeNightBeforeReqOff: toOption('excludeNightBeforeReqOff'),
    };
}
