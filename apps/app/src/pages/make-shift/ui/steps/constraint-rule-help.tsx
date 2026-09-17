import type {TWardRotationMode} from '@dutying/domain';
import {Check, Info, X} from 'lucide-react';
import type {ReactNode} from 'react';
import type {TI18nKey} from '@/shared/hook/use-typed-translation';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/shared/ui/primitives/tooltip';
import type {TShiftConstraintOption, TShiftConstraintRuleDraft} from '../../model/shift-constraint-rules';
import {hasConstraintHelp} from './constraint-rule-help-codes';

export type TConstraintHelpOption = {
    value: string;
    label: string;
    kind?: 'duty' | 'nurse';
    shortName?: string;
    name?: string;
    color?: string;
    classification?: string;
    isOff?: boolean;
    raw?: TShiftConstraintOption;
};

type THelpDuty = TConstraintHelpOption & {
    kind: 'duty';
};

type THelpExamplePart =
    | {type: 'text'; text: string}
    | {type: 'arrow'}
    | {type: 'duty'; duty: THelpDuty; showName?: boolean}
    | {type: 'dutyGroup'; duties: THelpDuty[]}
    | {type: 'dutyRun'; duties: THelpDuty[]}
    | {type: 'assignment'; person: string; duty: THelpDuty};

type THelpExample = {
    parts?: THelpExamplePart[];
    text?: string;
};

type TConstraintHelpContent = {
    description: string;
    good: THelpExample;
    second: THelpExample;
    goodLabel?: string;
    secondLabel?: string;
    secondTone?: 'avoid' | 'note';
};

type TConstraintRuleHelpProps = {
    rule: TShiftConstraintRuleDraft;
    ruleTitle: string;
    optionMap: Record<string, TConstraintHelpOption[]>;
    rotationMode: TWardRotationMode;
};

const FALLBACK_DUTY_STYLE_BY_CODE: Record<string, {shortName: string; color: string; classification: string}> = {
    D: {shortName: 'D', color: '#3DB7A4', classification: 'DAY'},
    E: {shortName: 'E', color: '#EF7892', classification: 'EVENING'},
    N: {shortName: 'N', color: '#7667E8', classification: 'NIGHT'},
    S: {shortName: 'S', color: '#59677B', classification: 'NIGHT_CONTINUATION'},
    OFF: {shortName: 'O', color: '#8490A3', classification: 'OFF'},
};

function getOptionType(value: unknown) {
    if (typeof value === 'string') return value.trim().toUpperCase();

    if (!value || typeof value !== 'object') return '';

    const type = (value as Record<string, unknown>).type;

    return typeof type === 'string' ? type.trim().toUpperCase() : '';
}

function getPositiveInteger(value: unknown, fallback: number) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : fallback;
}

function getNonNegativeInteger(value: unknown, fallback: number) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function optionMatchesValue(option: TConstraintHelpOption, value: unknown) {
    const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
    const optionRecord = option.raw as Record<string, unknown> | undefined;
    const comparableKeys = ['wardShiftTypeId', 'nurseId', 'divisionNum', 'shiftTeamId'] as const;

    for (const key of comparableKeys) {
        if (record?.[key] != null && optionRecord?.[key] != null) {
            return String(record[key]) === String(optionRecord[key]);
        }
    }

    const valueText = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    const valueType = getOptionType(value);
    const candidates = [option.value, option.label, option.shortName, option.name, option.raw?.code, option.raw?.value]
        .filter(Boolean)
        .map(String);

    if (valueText && candidates.includes(valueText)) return true;

    return Boolean(valueType && option.raw?.type?.toUpperCase() === valueType);
}

function getOptionLabel(options: TConstraintHelpOption[] | undefined, value: unknown, fallback: string) {
    return options?.find((option) => optionMatchesValue(option, value))?.label ?? fallback;
}

function uniqueDutyOptions(options: TConstraintHelpOption[]) {
    const seen = new Set<string>();

    return options.filter((option): option is THelpDuty => {
        if (option.kind !== 'duty') return false;

        const key = String(option.raw?.wardShiftTypeId ?? `${option.value}-${option.classification ?? ''}`);

        if (seen.has(key)) return false;

        seen.add(key);

        return true;
    });
}

function getDutyOptions(optionMap: Record<string, TConstraintHelpOption[]>) {
    return uniqueDutyOptions([
        ...(optionMap.dutyStrict ?? []),
        ...(optionMap.duty ?? []),
        ...(optionMap.dutyReference ?? []),
        ...(optionMap.nightShift ?? []),
        ...(optionMap.twoShiftNight ?? []),
        ...(optionMap.twoShiftNightContinuation ?? []),
        ...(optionMap.offShift ?? []),
    ]);
}

function getFallbackDuty(code: string, name: string): THelpDuty {
    const style = FALLBACK_DUTY_STYLE_BY_CODE[code] ?? FALLBACK_DUTY_STYLE_BY_CODE.OFF;

    return {
        value: `constraint-help-${code}`,
        label: name,
        kind: 'duty',
        shortName: style.shortName,
        name,
        color: style.color,
        classification: style.classification,
        isOff: code === 'OFF',
    };
}

function findDutyByCode(options: THelpDuty[], code: string, fallbackName: string) {
    const normalizedCode = code.toUpperCase();
    const classificationByCode: Record<string, string> = {
        D: 'DAY',
        E: 'EVENING',
        N: 'NIGHT',
        S: 'NIGHT_CONTINUATION',
    };
    const found =
        normalizedCode === 'OFF'
            ? options.find((option) => option.classification === 'OFF' || option.isOff === true)
            : (options.find((option) => option.classification === classificationByCode[normalizedCode]) ??
              options.find((option) => option.shortName?.toUpperCase() === normalizedCode));

    return found ?? getFallbackDuty(normalizedCode, fallbackName);
}

function findDutyByValue(options: THelpDuty[], value: unknown, fallback: THelpDuty) {
    return options.find((option) => optionMatchesValue(option, value)) ?? fallback;
}

function getDutyName(dutyValue: THelpDuty) {
    return [dutyValue.name?.trim(), dutyValue.label].find(Boolean) ?? dutyValue.label;
}

function getAudienceLabels(
    rule: TShiftConstraintRuleDraft,
    optionMap: Record<string, TConstraintHelpOption[]>,
    t: ReturnType<typeof useTypedTranslation>['t'],
) {
    const values = [rule.params.target, rule.params.nurse];

    if (Array.isArray(rule.params.nurseIds)) values.push(...rule.params.nurseIds);

    const labels = values
        .filter((value) => value != null)
        .map((value) => {
            const type = getOptionType(value);

            if (type === 'ALL') return t('page.makeShift.constraints.help.audience.allNurses');

            return getOptionLabel(
                [...(optionMap.target ?? []), ...(optionMap.nurse ?? [])],
                value,
                t('page.makeShift.constraints.help.audience.selectedTarget'),
            );
        });

    if (
        labels.length === 0 &&
        ['TWO_SHIFT_NIGHT_THEN_CONTINUATION', 'TWO_SHIFT_NIGHT_CONTINUATION_AFTER_MIN_OFF', 'TWO_SHIFT_NIGHT_PAIR_MIN_OFF'].includes(
            rule.templateCode,
        )
    ) {
        return [t('page.makeShift.constraints.help.audience.allNurses')];
    }

    return Array.from(new Set(labels));
}

function text(textValue: string): THelpExamplePart {
    return {type: 'text', text: textValue};
}

function arrow(): THelpExamplePart {
    return {type: 'arrow'};
}

function duty(dutyValue: THelpDuty, showName = true): THelpExamplePart {
    return {type: 'duty', duty: dutyValue, showName};
}

function dutyGroup(duties: THelpDuty[]): THelpExamplePart {
    return {type: 'dutyGroup', duties};
}

function dutyRun(duties: THelpDuty[], count: number): THelpExamplePart {
    return {
        type: 'dutyRun',
        duties: Array.from({length: count}, (_, index) => duties[index % duties.length]),
    };
}

function assignment(person: string, dutyValue: THelpDuty): THelpExamplePart {
    return {type: 'assignment', person, duty: dutyValue};
}

function getConstraintHelpContent(
    rule: TShiftConstraintRuleDraft,
    optionMap: Record<string, TConstraintHelpOption[]>,
    rotationMode: TWardRotationMode,
    t: ReturnType<typeof useTypedTranslation>['t'],
): TConstraintHelpContent | null {
    if (!hasConstraintHelp(rule.templateCode)) return null;

    const dutyOptions = getDutyOptions(optionMap);
    const day = findDutyByCode(
        dutyOptions,
        'D',
        rotationMode === 'TWO'
            ? t('page.makeShift.constraints.help.fallbackDuty.twoDay')
            : t('page.makeShift.constraints.help.fallbackDuty.day'),
    );
    const evening = findDutyByCode(dutyOptions, 'E', t('page.makeShift.constraints.help.fallbackDuty.evening'));
    const night = findDutyByCode(dutyOptions, 'N', t('page.makeShift.constraints.help.fallbackDuty.night'));
    const continuation = findDutyByCode(dutyOptions, 'S', t('page.makeShift.constraints.help.fallbackDuty.nightContinuation'));
    const off = findDutyByCode(dutyOptions, 'OFF', t('page.makeShift.constraints.help.fallbackDuty.off'));
    const workingDuties = [day, evening, night];
    const selectedShiftValue = rule.params.shift;
    const selectedShift = dutyOptions.find((option) => optionMatchesValue(option, selectedShiftValue));
    const selectedNight = findDutyByValue(dutyOptions, rule.params.nightShift, night);
    const selectedContinuation = findDutyByValue(dutyOptions, rule.params.nightContinuationShift, continuation);
    const selectedOff = findDutyByValue(dutyOptions, rule.params.offShift, off);
    const selectedShiftName =
        getOptionType(selectedShiftValue) === 'ALL' || !selectedShiftValue
            ? t('page.makeShift.constraints.help.value.allDuties')
            : getDutyName(selectedShift ?? day);
    const selectedShiftPart =
        getOptionType(selectedShiftValue) === 'ALL' || !selectedShiftValue ? dutyGroup(workingDuties) : duty(selectedShift ?? day, true);
    const countValue =
        rule.params.count ?? rule.params.maxCount ?? rule.params.maxContinuousWorkDays ?? rule.params.maxDays ?? rule.params.days;
    const count = getNonNegativeInteger(countValue, 1);
    const positiveCount = getPositiveInteger(countValue, 1);
    const descriptionKey = `page.makeShift.constraints.help.description.${rule.templateCode}` as TI18nKey;
    const description = t(descriptionKey, {
        count,
        workCount: getPositiveInteger(rule.params.workCount, 5),
        offCount: getPositiveInteger(rule.params.offCount, 1),
        minutes: getPositiveInteger(
            rule.params.minRestMinutes ?? rule.params.maxWorkMinutes ?? rule.params.maxMinutes ?? rule.params.minutes,
            480,
        ),
        difference: getNonNegativeInteger(rule.params.maxDifference, 1),
        dayName: getDutyName(day),
        eveningName: getDutyName(evening),
        nightName: getDutyName(selectedNight),
        continuationName: getDutyName(selectedContinuation),
        offName: getDutyName(selectedOff),
        shiftName: selectedShiftName,
    });
    const people = (value: number) => t('page.makeShift.constraints.help.value.people', {count: value});
    const times = (value: number) => t('page.makeShift.constraints.help.value.times', {count: value});

    switch (rule.templateCode) {
        case 'STAFF_COUNT_BY_SHIFT': {
            const operator = getOptionType(rule.params.operator) || 'MIN';
            const dateScope = getOptionLabel(
                optionMap.dateScope,
                rule.params.dateScope,
                t('page.makeShift.constraints.help.value.everyday'),
            );
            const goodCount = count;
            const badCount = operator === 'MIN' ? Math.max(0, count - 1) : count + 1;

            return {
                description,
                good: {parts: [text(dateScope), selectedShiftPart, text(people(goodCount))]},
                second: {parts: [text(dateScope), selectedShiftPart, text(people(badCount))]},
            };
        }
        case 'CORE_MAX_CONTINUOUS_WORK':
        case 'MAX_CONSECUTIVE_WORK_DAYS':
            return {
                description,
                good: {parts: [dutyRun([day], positiveCount), arrow(), duty(off, true)]},
                second: {parts: [dutyRun([day], positiveCount + 1)]},
            };
        case 'MIN_OFF_AFTER_CONSECUTIVE_WORK': {
            const workCount = getPositiveInteger(rule.params.workCount, 5);
            const offCount = getPositiveInteger(rule.params.offCount, 1);
            const shortOffCount = Math.max(0, offCount - 1);

            return {
                description,
                good: {
                    parts: [dutyRun([day], workCount), arrow(), dutyRun([off], offCount)],
                },
                second: {
                    parts: [
                        dutyRun([day], workCount),
                        arrow(),
                        ...(shortOffCount > 0
                            ? [dutyRun([off], shortOffCount), arrow()]
                            : [text(t('page.makeShift.constraints.help.value.withoutOff')), arrow()]),
                        duty(day, true),
                    ],
                },
            };
        }
        case 'AVOID_ISOLATED_WORK_DAY':
            return {
                description,
                good: {parts: [duty(off), arrow(), duty(day), arrow(), duty(evening), arrow(), duty(off)]},
                second: {parts: [duty(off), arrow(), duty(day), arrow(), duty(off)]},
            };
        case 'AVOID_ISOLATED_OFF_DAY':
            return {
                description,
                good: {parts: [duty(day), arrow(), duty(off), arrow(), duty(off), arrow(), duty(evening)]},
                second: {parts: [duty(day), arrow(), duty(off), arrow(), duty(evening)]},
            };
        case 'CORE_MIN_NIGHT_INTERVAL': {
            if (positiveCount <= 1) {
                return {
                    description,
                    good: {parts: [duty(night, true), arrow(), dutyRun([off], 1), arrow(), duty(night, true)]},
                    second: {text: t('page.makeShift.constraints.help.note.minimumNightIntervalOne')},
                    secondTone: 'note',
                };
            }

            return {
                description,
                good: {
                    parts: [duty(night, true), arrow(), dutyRun([off], positiveCount), arrow(), duty(night, true)],
                },
                second: {
                    parts: [duty(night, true), arrow(), dutyRun([off], positiveCount - 1), arrow(), duty(night, true)],
                },
            };
        }
        case 'CORE_MAX_CONTINUOUS_NIGHT':
            return {
                description,
                good: {parts: [dutyRun([night], positiveCount), arrow(), duty(off, true)]},
                second: {parts: [dutyRun([night], positiveCount + 1)]},
            };
        case 'CORE_MIN_CONTINUOUS_NIGHT':
            return positiveCount <= 1
                ? {
                      description,
                      good: {parts: [dutyRun([night], 1), arrow(), duty(off, true)]},
                      second: {text: t('page.makeShift.constraints.help.note.minimumContinuousNightOne')},
                      secondTone: 'note',
                  }
                : {
                      description,
                      good: {parts: [dutyRun([night], positiveCount), arrow(), duty(off, true)]},
                      second: {parts: [dutyRun([night], positiveCount - 1), arrow(), duty(off, true)]},
                  };
        case 'CORE_MIN_OFF_AFTER_NIGHT': {
            const offCount = positiveCount;
            const shortOffCount = Math.max(0, offCount - 1);

            return {
                description,
                good: {parts: [duty(night, true), arrow(), dutyRun([off], offCount), arrow(), duty(day, true)]},
                second: {
                    parts: [
                        duty(night, true),
                        arrow(),
                        ...(shortOffCount > 0
                            ? [dutyRun([off], shortOffCount), arrow()]
                            : [text(t('page.makeShift.constraints.help.value.withoutOff')), arrow()]),
                        duty(day, true),
                    ],
                },
            };
        }
        case 'FORBID_N_THEN_D':
            return {
                description,
                good: {parts: [duty(night, true), arrow(), duty(off, true)]},
                second: {parts: [duty(night, true), arrow(), duty(day, true)]},
            };
        case 'FORBID_N_THEN_E':
            return {
                description,
                good: {parts: [duty(night, true), arrow(), duty(off, true)]},
                second: {parts: [duty(night, true), arrow(), duty(evening, true)]},
            };
        case 'FORBID_E_THEN_D':
            return {
                description,
                good: {parts: [duty(evening, true), arrow(), duty(off, true)]},
                second: {parts: [duty(evening, true), arrow(), duty(day, true)]},
            };
        case 'FORBID_E_THEN_N':
            return {
                description,
                good: {parts: [duty(evening, true), arrow(), duty(off, true)]},
                second: {parts: [duty(evening, true), arrow(), duty(night, true)]},
            };
        case 'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF':
            return {
                description,
                good: {
                    parts: [duty(day, true), arrow(), text(t('page.makeShift.constraints.help.value.requested')), duty(off, true)],
                },
                second: {
                    parts: [duty(night, true), arrow(), text(t('page.makeShift.constraints.help.value.requested')), duty(off, true)],
                },
            };
        case 'NURSE_MAX_WEEKEND_HOLIDAY_SHIFTS': {
            const period = getOptionLabel(optionMap.period, rule.params.period, t('page.makeShift.constraints.help.value.month'));

            return {
                description,
                good: {
                    parts: [
                        text(t('page.makeShift.constraints.help.value.weekendHoliday')),
                        selectedShiftPart,
                        text(`${period} · ${times(count)}`),
                    ],
                },
                second: {
                    parts: [
                        text(t('page.makeShift.constraints.help.value.weekendHoliday')),
                        selectedShiftPart,
                        text(`${period} · ${times(count + 1)}`),
                    ],
                },
            };
        }
        case 'OFF_AFTER_CONSECUTIVE_WORK': {
            const workCount = getPositiveInteger(rule.params.count, 3);

            return {
                description,
                good: {parts: [dutyRun([day], workCount), arrow(), duty(off, true)]},
                second: {parts: [dutyRun([day], workCount), arrow(), duty(day, true)]},
            };
        }
        case 'NURSE_FORBID_WEEKEND':
            return {
                description,
                good: {parts: [text(t('page.makeShift.constraints.help.value.weekendHoliday')), duty(off, true)]},
                second: {parts: [text(t('page.makeShift.constraints.help.value.weekendHoliday')), duty(day, true)]},
            };
        case 'NURSE_PREFER_SHIFT': {
            const preferred = findDutyByValue(dutyOptions, rule.params.shift, day);
            const alternative = workingDuties.find((item) => item.value !== preferred.value) ?? off;

            return {
                description,
                good: {parts: [duty(preferred, true)]},
                second: {parts: [duty(alternative, true)]},
                goodLabel: t('page.makeShift.constraints.help.preferredExample'),
                secondLabel: t('page.makeShift.constraints.help.alternativeExample'),
                secondTone: 'note',
            };
        }
        case 'NURSE_AVOID_SHIFT': {
            const avoided = findDutyByValue(dutyOptions, rule.params.shift, night);
            const alternative = workingDuties.find((item) => item.value !== avoided.value) ?? off;

            return {
                description,
                good: {parts: [duty(alternative, true)]},
                second: {parts: [duty(avoided, true)]},
                goodLabel: t('page.makeShift.constraints.help.alternativePreferredExample'),
                secondLabel: t('page.makeShift.constraints.help.avoidIfPossibleExample'),
            };
        }
        case 'NURSE_PAIR_NOT_SAME_SHIFT': {
            const nurseA = getOptionLabel(optionMap.nurse, rule.params.nurseA, t('page.makeShift.constraints.help.audience.firstNurse'));
            const nurseB = getOptionLabel(optionMap.nurse, rule.params.nurseB, t('page.makeShift.constraints.help.audience.secondNurse'));

            return {
                description,
                good: {
                    parts: [
                        text(t('page.makeShift.constraints.help.value.sameDate')),
                        assignment(nurseA, day),
                        assignment(nurseB, evening),
                    ],
                },
                second: {
                    parts: [text(t('page.makeShift.constraints.help.value.sameDate')), assignment(nurseA, day), assignment(nurseB, day)],
                },
            };
        }
        case 'NURSE_PAIR_PREFER_SAME_SHIFT': {
            const nurseA = getOptionLabel(optionMap.nurse, rule.params.nurseA, t('page.makeShift.constraints.help.audience.firstNurse'));
            const nurseB = getOptionLabel(optionMap.nurse, rule.params.nurseB, t('page.makeShift.constraints.help.audience.secondNurse'));

            return {
                description,
                good: {
                    parts: [text(t('page.makeShift.constraints.help.value.sameDate')), assignment(nurseA, day), assignment(nurseB, day)],
                },
                second: {
                    parts: [
                        text(t('page.makeShift.constraints.help.value.sameDate')),
                        assignment(nurseA, day),
                        assignment(nurseB, evening),
                    ],
                },
                goodLabel: t('page.makeShift.constraints.help.preferredExample'),
                secondLabel: t('page.makeShift.constraints.help.alternativeAssignmentExample'),
                secondTone: 'note',
            };
        }
        case 'TWO_SHIFT_NIGHT_THEN_CONTINUATION': {
            return {
                description,
                good: {parts: [duty(selectedNight, true), arrow(), duty(selectedContinuation, true)]},
                second: {parts: [duty(selectedNight, true), arrow(), duty(off, true)]},
            };
        }
        case 'TWO_SHIFT_NIGHT_CONTINUATION_AFTER_MIN_OFF': {
            const shortCount = Math.max(0, positiveCount - 1);

            return {
                description,
                good: {parts: [duty(selectedContinuation, true), arrow(), dutyRun([selectedOff], positiveCount)]},
                second: {
                    parts: [
                        duty(selectedContinuation, true),
                        arrow(),
                        ...(shortCount > 0
                            ? [dutyRun([selectedOff], shortCount), arrow()]
                            : [text(t('page.makeShift.constraints.help.value.withoutOff')), arrow()]),
                        duty(day, true),
                    ],
                },
            };
        }
        case 'TWO_SHIFT_NIGHT_PAIR_MIN_OFF': {
            const shortCount = Math.max(0, positiveCount - 1);

            return {
                description,
                good: {parts: [duty(selectedNight, true), arrow(), dutyRun([selectedOff], positiveCount)]},
                second: {
                    parts: [
                        duty(selectedNight, true),
                        arrow(),
                        ...(shortCount > 0
                            ? [dutyRun([selectedOff], shortCount), arrow()]
                            : [text(t('page.makeShift.constraints.help.value.withoutOff')), arrow()]),
                        duty(day, true),
                    ],
                },
            };
        }
        case 'MAX_MONTHLY_NIGHT_COUNT': {
            const monthlyCount = getNonNegativeInteger(rule.params.count ?? rule.params.maxCount, 8);

            return {
                description,
                good: {parts: [text(t('page.makeShift.constraints.help.value.month')), duty(night, true), text(times(monthlyCount))]},
                second: {
                    parts: [text(t('page.makeShift.constraints.help.value.month')), duty(night, true), text(times(monthlyCount + 1))],
                },
            };
        }
        case 'MIXED_ROTATION_PARTICIPATION': {
            const dateScope = getOptionLabel(
                optionMap.dateScope,
                rule.params.dateScope,
                t('page.makeShift.constraints.help.value.everyday'),
            );
            const mode = getOptionLabel(
                optionMap.participationMode,
                rule.params.participationMode,
                t('page.makeShift.constraints.help.value.configuredMode'),
            );

            return {
                description,
                good: {parts: [text(`${dateScope} · ${mode}`)]},
                second: {parts: [text(`${dateScope} · ${t('page.makeShift.constraints.help.value.otherMode')}`)]},
            };
        }
        case 'MIXED_DAILY_COMPOSITION': {
            const dateScope = getOptionLabel(
                optionMap.dateScope,
                rule.params.dateScope,
                t('page.makeShift.constraints.help.value.everyday'),
            );
            const composition = getOptionLabel(
                optionMap.mixedComposition ?? optionMap.composition ?? optionMap.compositionMode,
                rule.params.composition ?? rule.params.compositionMode,
                t('page.makeShift.constraints.help.value.configuredComposition'),
            );

            return {
                description,
                good: {parts: [text(`${dateScope} · ${composition}`)]},
                second: {parts: [text(`${dateScope} · ${t('page.makeShift.constraints.help.value.otherComposition')}`)]},
            };
        }
        case 'TWO_SHIFT_DAILY_LINES': {
            const dateScope = getOptionLabel(
                optionMap.dateScope,
                rule.params.dateScope,
                t('page.makeShift.constraints.help.value.everyday'),
            );
            const lineCount = getNonNegativeInteger(rule.params.count, 1);
            const operator = getOptionType(rule.params.operator) || 'MIN';
            const restrictedCount = operator === 'MIN' ? Math.max(0, lineCount - 1) : lineCount + 1;

            return {
                description,
                good: {parts: [text(dateScope), text(t('page.makeShift.constraints.help.value.lines', {count: lineCount}))]},
                second: {parts: [text(dateScope), text(t('page.makeShift.constraints.help.value.lines', {count: restrictedCount}))]},
            };
        }
        case 'TWO_SHIFT_ASSIGNMENT_COUNT': {
            const period = getOptionLabel(optionMap.period, rule.params.period, t('page.makeShift.constraints.help.value.month'));
            const shiftScope = getOptionLabel(
                optionMap.twoShiftScope ?? optionMap.shiftScope ?? optionMap.duty,
                rule.params.shiftScope,
                t('page.makeShift.constraints.help.value.twoShiftDuty'),
            );
            const aggregation = getOptionLabel(
                optionMap.assignmentAggregation,
                rule.params.aggregation,
                t('page.makeShift.constraints.help.value.perNurse'),
            );
            const operator = getOptionType(rule.params.operator) || 'MAX';
            const restrictedCount = operator === 'MIN' ? Math.max(0, count - 1) : count + 1;

            return {
                description,
                good: {parts: [text(`${period} · ${aggregation} · ${shiftScope}`), text(times(count))]},
                second: {parts: [text(`${period} · ${aggregation} · ${shiftScope}`), text(times(restrictedCount))]},
            };
        }
        case 'TIME_WINDOW_STAFF_COUNT': {
            const dateScope = getOptionLabel(
                optionMap.dateScope,
                rule.params.dateScope,
                t('page.makeShift.constraints.help.value.everyday'),
            );
            const operator = getOptionType(rule.params.operator) || 'MIN';
            const restrictedCount = operator === 'MIN' ? Math.max(0, count - 1) : count + 1;
            const timeRange = `${String(rule.params.startTime ?? '07:00')}–${String(rule.params.endTime ?? '15:00')}`;

            return {
                description,
                good: {parts: [text(`${dateScope} · ${timeRange}`), text(people(count))]},
                second: {parts: [text(`${dateScope} · ${timeRange}`), text(people(restrictedCount))]},
            };
        }
        case 'MIN_REST_BETWEEN_SHIFTS': {
            const minutes = getPositiveInteger(rule.params.minRestMinutes ?? rule.params.minutes, 660);

            return {
                description,
                good: {parts: [text(t('page.makeShift.constraints.help.value.restMinutes', {count: minutes}))]},
                second: {
                    parts: [text(t('page.makeShift.constraints.help.value.restMinutes', {count: Math.max(0, minutes - 60)}))],
                },
            };
        }
        case 'MAX_WORK_MINUTES_BY_PERIOD': {
            const period = getOptionLabel(optionMap.period, rule.params.period, t('page.makeShift.constraints.help.value.month'));
            const minutes = getPositiveInteger(rule.params.maxWorkMinutes ?? rule.params.maxMinutes ?? rule.params.minutes, 10440);

            return {
                description,
                good: {parts: [text(period), text(t('page.makeShift.constraints.help.value.workMinutes', {count: minutes}))]},
                second: {parts: [text(period), text(t('page.makeShift.constraints.help.value.workMinutes', {count: minutes + 60}))]},
            };
        }
        case 'MIXED_SHIFT_WORKLOAD_BALANCE': {
            const period = getOptionLabel(optionMap.period, rule.params.period, t('page.makeShift.constraints.help.value.month'));
            const metric = getOptionLabel(
                optionMap.workloadMetric ?? optionMap.metric,
                rule.params.metric,
                t('page.makeShift.constraints.help.value.workload'),
            );
            const difference = getNonNegativeInteger(rule.params.maxDifference, 1);

            return {
                description,
                good: {
                    parts: [
                        text(`${period} · ${metric}`),
                        text(t('page.makeShift.constraints.help.value.difference', {count: difference})),
                    ],
                },
                second: {
                    parts: [
                        text(`${period} · ${metric}`),
                        text(t('page.makeShift.constraints.help.value.difference', {count: difference + 1})),
                    ],
                },
            };
        }
        default:
            return null;
    }
}

function HelpDutyBadge({duty: dutyValue, showName = true}: {duty: THelpDuty; showName?: boolean}) {
    const shortName = dutyValue.shortName ?? dutyValue.label.split(' ')[0] ?? dutyValue.label;
    const name = dutyValue.name ?? dutyValue.label;
    const shouldShowName = showName && name.trim().toUpperCase() !== shortName.trim().toUpperCase();

    return (
        <span
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] px-2 font-apple text-[11px] leading-none font-bold whitespace-nowrap text-white"
            style={{backgroundColor: dutyValue.color ?? '#8490A3'}}
            aria-label={name}
        >
            <span>{shortName}</span>
            {shouldShowName ? <span className="font-medium">{name}</span> : null}
        </span>
    );
}

function HelpDutyGroup({duties}: {duties: THelpDuty[]}) {
    return (
        <span className="inline-flex shrink-0 items-center gap-1" aria-label={duties.map((item) => item.name ?? item.label).join(', ')}>
            {duties.map((item) => (
                <HelpDutyBadge key={`${item.value}-${item.classification ?? ''}`} duty={item} />
            ))}
        </span>
    );
}

function HelpDutyRun({duties}: {duties: THelpDuty[]}) {
    return (
        <span className="inline-flex flex-nowrap items-center gap-1">
            {duties.map((item, index) => {
                const key = String(item.raw?.wardShiftTypeId ?? `${item.value}-${item.classification ?? ''}`);

                return (
                    <span key={`${key}-${index}`} className="inline-flex items-center gap-1">
                        {index > 0 ? (
                            <span className="px-0.5 text-[#9099A8]" aria-hidden="true">
                                →
                            </span>
                        ) : null}
                        <HelpDutyBadge duty={item} showName />
                    </span>
                );
            })}
        </span>
    );
}

function HelpExampleContent({example, audienceLabels}: {example: THelpExample; audienceLabels: string[]}) {
    const audience = audienceLabels.length ? (
        <span
            data-constraint-help-audience="true"
            className="inline-flex h-7 shrink-0 items-center rounded-[8px] bg-[#4B5565] px-2 font-apple text-[11px] leading-none font-bold whitespace-nowrap text-white"
        >
            {audienceLabels.join(' · ')}
        </span>
    ) : null;

    if (example.text) {
        return (
            <span className="inline-flex w-max flex-nowrap items-center gap-1.5 whitespace-nowrap">
                {audience}
                {audience ? <span className="px-0.5 text-[#9099A8]">→</span> : null}
                <span>{example.text}</span>
            </span>
        );
    }

    return (
        <span data-constraint-help-sequence="true" className="inline-flex w-max flex-nowrap items-center gap-1.5 whitespace-nowrap">
            {audience}
            {audience ? (
                <span className="px-0.5 text-[#9099A8]" aria-hidden="true">
                    →
                </span>
            ) : null}
            {example.parts?.map((part, index) => {
                if (part.type === 'text') return <span key={`${part.type}-${part.text}-${index}`}>{part.text}</span>;

                if (part.type === 'arrow') {
                    return (
                        <span key={`${part.type}-${index}`} className="px-0.5 text-[#9099A8]" aria-hidden="true">
                            →
                        </span>
                    );
                }

                if (part.type === 'dutyGroup') return <HelpDutyGroup key={`${part.type}-${index}`} duties={part.duties} />;

                if (part.type === 'dutyRun') return <HelpDutyRun key={`${part.type}-${index}`} duties={part.duties} />;

                if (part.type === 'assignment') {
                    return (
                        <span
                            key={`${part.type}-${part.person}-${index}`}
                            data-constraint-help-assignment="true"
                            className="inline-flex shrink-0 items-center gap-1"
                        >
                            <span className="inline-flex h-7 items-center rounded-[8px] bg-[#4B5565] px-2 font-apple text-[11px] font-bold whitespace-nowrap text-white">
                                {part.person}
                            </span>
                            <span className="px-0.5 text-[#9099A8]" aria-hidden="true">
                                →
                            </span>
                            <HelpDutyBadge duty={part.duty} />
                        </span>
                    );
                }

                return <HelpDutyBadge key={`${part.type}-${part.duty.value}-${index}`} duty={part.duty} showName={part.showName} />;
            })}
        </span>
    );
}

function ExampleRow({
    icon,
    label,
    example,
    audienceLabels,
    tone,
}: {
    icon: ReactNode;
    label: string;
    example: THelpExample;
    audienceLabels: string[];
    tone: 'good' | 'avoid' | 'note';
}) {
    const toneClassName = {
        good: 'bg-[#183D2E] text-[#F4FFF8]',
        avoid: 'bg-[#47272D] text-[#FFF7F8]',
        note: 'bg-[#343B48] text-[#F7F8FA]',
    }[tone];
    const labelClassName = {
        good: 'text-[#91E1B8]',
        avoid: 'text-[#FFB0BA]',
        note: 'text-[#D6DBE4]',
    }[tone];
    const iconSurfaceClassName = {
        good: 'bg-[#29B876]',
        avoid: 'bg-[#F05266]',
        note: 'bg-[#687487]',
    }[tone];

    return (
        <div data-constraint-help-example={tone} className={`rounded-[12px] px-3 py-2.5 ${toneClassName}`}>
            <div className="mb-1.5 flex items-center gap-1.5">
                <span className={`grid size-5 place-items-center rounded-full ${iconSurfaceClassName}`} aria-hidden="true">
                    {icon}
                </span>
                <span className={`font-apple text-[11px] font-bold ${labelClassName}`}>{label}</span>
            </div>
            <div className="overflow-x-auto pb-1 font-apple text-[12px] leading-5 font-semibold [scrollbar-color:#687487_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#687487] [&::-webkit-scrollbar-track]:bg-transparent">
                <HelpExampleContent example={example} audienceLabels={audienceLabels} />
            </div>
        </div>
    );
}

export function ConstraintRuleHelp({rule, ruleTitle, optionMap, rotationMode}: TConstraintRuleHelpProps) {
    const {t} = useTypedTranslation();
    const content = getConstraintHelpContent(rule, optionMap, rotationMode, t);
    const audienceLabels = getAudienceLabels(rule, optionMap, t);

    if (!content) return null;

    const isNote = content.secondTone === 'note';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label={t('page.makeShift.constraints.help.aria', {constraint: ruleTitle})}
                    data-constraint-help-trigger={rule.templateCode}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-[#8B95A7] transition-colors hover:bg-[#EEEAFE] hover:text-[#6555E8] focus-visible:bg-[#E5E0FF] focus-visible:text-[#4F3FD8] focus-visible:outline-none motion-reduce:transition-none"
                >
                    <Info className="size-[17px]" strokeWidth={2.2} aria-hidden="true" />
                </button>
            </TooltipTrigger>
            <TooltipContent
                side="top"
                align="end"
                sideOffset={10}
                collisionPadding={12}
                data-constraint-help-content={rule.templateCode}
                className="z-[1400] max-h-[calc(100vh-24px)] w-max max-w-[min(720px,calc(100vw-24px))] overflow-y-auto rounded-[16px] bg-[#252B36] p-4 text-left text-white motion-reduce:animate-none"
            >
                <p className="font-apple text-[12px] font-bold text-[#B9B0FF]">{t('page.makeShift.constraints.help.title')}</p>
                <p
                    data-constraint-help-description="true"
                    className="mt-1.5 w-[360px] max-w-full font-apple text-[13px] leading-[1.55] font-medium whitespace-normal text-[#F4F6F8]"
                >
                    {content.description}
                </p>
                <div className="mt-3 space-y-2">
                    <ExampleRow
                        tone="good"
                        label={content.goodLabel ?? t('page.makeShift.constraints.help.goodExample')}
                        example={content.good}
                        audienceLabels={audienceLabels}
                        icon={<Check className="size-3 text-white" strokeWidth={3} />}
                    />
                    <ExampleRow
                        tone={isNote ? 'note' : 'avoid'}
                        label={
                            content.secondLabel ??
                            (isNote ? t('page.makeShift.constraints.help.noteLabel') : t('page.makeShift.constraints.help.avoidExample'))
                        }
                        example={content.second}
                        audienceLabels={audienceLabels}
                        icon={
                            isNote ? (
                                <Info className="size-3 text-white" strokeWidth={3} />
                            ) : (
                                <X className="size-3 text-white" strokeWidth={3} />
                            )
                        }
                    />
                </div>
            </TooltipContent>
        </Tooltip>
    );
}
