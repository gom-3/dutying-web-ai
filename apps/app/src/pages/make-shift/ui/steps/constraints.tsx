import {cn} from '@dutying/utils/style';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ChevronDown, Plus, X} from 'lucide-react';
import {type ReactNode, memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import toast from 'react-hot-toast';
import {useTranslation} from 'react-i18next';
import {type TShiftTeam} from '@/entities';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuthStore from '@/features/auth/model/store';
import {hasNursePrecepteeRole, hasNursePreceptorRole} from '@/pages/member/model/nurse-role';
import {type TI18nKey, useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Skeleton} from '@/shared/ui/primitives/skeleton';
import {Switch} from '@/shared/ui/primitives/switch';
import {MAKE_SHIFT_CONSTRAINTS_OPTIMIZE_EVENT} from '../../model/make-shift-events';
import {isMakeShiftTeamReadyForWard, useMakeShiftStore} from '../../model/make-shift-store';
import {
    getShiftConstraintRuleCandidates,
    getShiftConstraintRules,
    putShiftConstraintRules,
    shiftConstraintRuleQueryKeys,
    type TShiftConstraintOption,
    type TShiftConstraintOptions,
    type TShiftConstraintRule,
    type TShiftConstraintRuleDraft,
    type TShiftConstraintRulesResponse,
    type TShiftConstraintSlot,
    type TShiftConstraintTemplate,
} from '../../model/shift-constraint-rules';

type TSelectOption = {
    value: string;
    label: string;
    kind?: 'duty' | 'nurse';
    shortName?: string;
    name?: string;
    color?: string;
    classification?: TShiftTypeLike['classification'];
    isOff?: boolean;
    isPreceptor?: boolean;
    isPreceptee?: boolean;
    raw?: TShiftConstraintOption;
};
type TTemplateCategory = string;
type TTypedT = ReturnType<typeof useTypedTranslation>['t'];
type TControlDef = {
    key: string;
    kind: 'select' | 'number';
    optionsKey?: string;
    min?: number;
    max?: number;
    values?: number[];
    prefix?: string;
    suffix?: string;
};
type TModalCategory = string;
type TSentencePart =
    | {type: 'text'; text: string}
    | {type: 'duty'; code: string}
    | {type: 'dutyPattern'; codes: string[]}
    | {type: 'control'; key: string}
    | {type: 'particle'; key: string; withBatchim: string; withoutBatchim: string};
type TSoftRuleTemplate = {
    id: string;
    category: TTemplateCategory;
    label: string;
    controls: TControlDef[];
    sentence: TSentencePart[];
    buildText: (params: Record<string, string>) => string;
    isRecommended?: boolean;
    sourceTemplate?: TShiftConstraintTemplate;
};
type TRulesUpdate = (prev: TShiftConstraintRuleDraft[]) => TShiftConstraintRuleDraft[];

type TShiftTypeLike = {
    wardShiftTypeId?: number;
    shortName?: string;
    name?: string;
    color?: string;
    isOff?: boolean;
    classification?: string;
    rotationSystem?: 'THREE' | 'TWO' | 'NONE';
    isActive?: boolean;
};
type TNurseLike = {
    nurseId?: number;
    name?: string;
    isPreceptor?: boolean | null;
    isPreceptee?: boolean | null;
    isWardManager?: boolean | null;
    memo?: string | null;
};
type TNurseRoleLike = {
    isPreceptor?: boolean | null;
    isPreceptee?: boolean | null;
    memo?: string | null;
};

const EMPTY_NURSES: TNurseLike[] = [];
const EMPTY_SHIFT_TYPES: TShiftTypeLike[] = [];
const EMPTY_SHIFT_CONSTRAINT_OPTIONS: TShiftConstraintOptions = {};

function hasPreceptorRole(nurse: TNurseRoleLike | null | undefined) {
    return hasNursePreceptorRole(nurse);
}

function hasPrecepteeRole(nurse: TNurseRoleLike | null | undefined) {
    return hasNursePrecepteeRole(nurse);
}

const CONSTRAINT_IMPORT_ICON_SRC = '/img/temp222.png';
const RECOMMENDED_MODAL_CATEGORY = 'RECOMMENDED';
const CATEGORY_LABEL_KEY_BY_CATEGORY: Record<string, TI18nKey> = {
    STAFFING: 'page.makeShift.constraints.category.staffing',
    STAFFING_COUNT: 'page.makeShift.constraints.category.staffing',
    FORBIDDEN: 'page.makeShift.constraints.category.forbidden',
    FORBIDDEN_PATTERN: 'page.makeShift.constraints.category.forbidden',
    WORK_REST: 'page.makeShift.constraints.category.workRest',
    PERSONAL: 'page.makeShift.constraints.category.personal',
    NURSE_LIMIT: 'page.makeShift.constraints.category.personal',
    COMBINATION: 'page.makeShift.constraints.category.combination',
    NURSE_COMBINATION: 'page.makeShift.constraints.category.combination',
    CORE: 'page.makeShift.constraints.category.recommended',
    IMPORTANT: 'page.makeShift.constraints.category.recommended',
    TWO_SHIFT: 'page.makeShift.constraints.category.twoShift',
};

function ConstraintModalPortal({children}: {children: ReactNode}) {
    if (typeof document === 'undefined') return <>{children}</>;

    return createPortal(children, document.body);
}

function getCategoryLabel(t: TTypedT, category: TModalCategory) {
    if (category === RECOMMENDED_MODAL_CATEGORY) return t('page.makeShift.constraints.category.recommended');

    const key = CATEGORY_LABEL_KEY_BY_CATEGORY[category];

    return key ? t(key) : category;
}

function isSkillConstraintCategory(category: string) {
    return category === 'SKILL' || category === 'PROFICIENCY';
}

const SKILL_CONSTRAINT_TEMPLATE_CODES = new Set([
    'NURSE_NOT_ALONE_N',
    'NEW_NURSE_NOT_ALONE_N',
    'MIN_PROFICIENCY_STAFF_BY_SHIFT',
    'SOFT_NEWBIE_NO_SOLO_N',
    'SOFT_MIN_SKILL_IN_DUTY',
]);

function isSkillConstraintTemplateCode(templateCode: string | null | undefined) {
    if (!templateCode) return false;

    return SKILL_CONSTRAINT_TEMPLATE_CODES.has(templateCode) || /(?:SKILL|PROFICIENCY)/i.test(templateCode);
}

function isSkillConstraintTemplate(template: Pick<TSoftRuleTemplate, 'id' | 'category' | 'controls'>) {
    return (
        isSkillConstraintCategory(template.category) ||
        isSkillConstraintTemplateCode(template.id) ||
        template.controls.some((control) => control.key === 'level' || control.optionsKey === 'level')
    );
}

function isVisibleConstraintRule(rule: Pick<TShiftConstraintRuleDraft, 'category' | 'templateCode'>) {
    return !isSkillConstraintCategory(rule.category) && !isSkillConstraintTemplateCode(rule.templateCode);
}

function resolveDutyStyle(optionOrCode: TSelectOption) {
    const code = optionOrCode.shortName ?? optionOrCode.label.split(' ')[0] ?? '';

    return {
        code,
        name: optionOrCode.name ?? optionOrCode.label,
        color: optionOrCode.color ?? '#8A94A6',
    };
}

function DutyTypeBadge({option}: {option: TSelectOption}) {
    const style = resolveDutyStyle(option);
    const showName = style.name && style.name !== style.code;

    return (
        <span
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[8px] px-2.5 font-apple text-[13px] font-bold text-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]"
            style={{backgroundColor: style.color}}
        >
            <span className="text-[14px] font-semibold">{style.code}</span>
            {showName ? <span className="text-[12px] font-medium opacity-90">{style.name}</span> : null}
        </span>
    );
}

function DutyPatternBadge({options}: {options: TSelectOption[]}) {
    if (!options.length) return null;

    return (
        <span className="inline-flex h-8 shrink-0 items-center overflow-hidden rounded-[9px] bg-gray-7 ring-1 ring-gray-6">
            {options.map((option, index) => {
                const style = resolveDutyStyle(option);

                return (
                    <span key={`${option.value}-${index}`} className="inline-flex h-full items-center">
                        {index > 0 ? <span className="px-1 font-apple text-[13px] font-bold text-gray-4">-</span> : null}
                        <span
                            className="inline-flex h-7 items-center gap-1 rounded-[8px] px-2 font-apple text-white"
                            style={{backgroundColor: style.color}}
                            title={style.name && style.name !== style.code ? `${style.code} ${style.name}` : style.code}
                        >
                            <span className="text-[14px] font-semibold">{style.code}</span>
                        </span>
                    </span>
                );
            })}
        </span>
    );
}

function RoleBadge({children}: {children: ReactNode}) {
    return (
        <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-[#EEF2FF] px-2 font-apple text-[10px] leading-none font-semibold text-[#4F46E5]">
            {children}
        </span>
    );
}

function SelectOptionContent({option, compact = false}: {option: TSelectOption; compact?: boolean}) {
    const {t} = useTypedTranslation();

    if (option.kind === 'duty') {
        return <DutyTypeBadge option={option} />;
    }

    if (option.kind !== 'nurse') {
        return <span className={compact ? 'max-w-[120px] truncate' : 'truncate'}>{option.label}</span>;
    }

    if (compact) {
        return <span className="max-w-[120px] truncate">{option.label}</span>;
    }

    const hasBadges = [option.isPreceptor, option.isPreceptee].some(Boolean);

    return (
        <span className={cn('flex min-w-0 items-center gap-2', compact ? 'max-w-[240px]' : 'w-full justify-between gap-3')}>
            <span className="min-w-0 truncate">{option.label}</span>
            {hasBadges ? (
                <span className="flex shrink-0 items-center gap-1">
                    {option.isPreceptor ? <RoleBadge>{t('page.makeShift.workers.column.preceptor')}</RoleBadge> : null}
                    {option.isPreceptee ? <RoleBadge>{t('page.makeShift.workers.column.preceptee')}</RoleBadge> : null}
                </span>
            ) : null}
        </span>
    );
}

const ALL_CONSTRAINT_TARGET_OPTION: TShiftConstraintOption = {type: 'ALL'};
const RECOMMENDED_DEFAULT_RULE_CODES = [
    'CORE_MAX_CONTINUOUS_WORK',
    'CORE_MIN_NIGHT_INTERVAL',
    'FORBID_N_THEN_D',
    'FORBID_N_THEN_E',
    'FORBID_E_THEN_D',
    'FORBID_E_THEN_N',
    'CORE_MAX_CONTINUOUS_NIGHT',
    'CORE_MIN_OFF_AFTER_NIGHT',
    'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
] as const;
const RECOMMENDED_DEFAULT_RULE_IDS = new Set<string>(RECOMMENDED_DEFAULT_RULE_CODES);
const HIDDEN_RECOMMENDED_RULE_IDS = new Set<string>([
    'CORE_EXCLUDE_CERTAIN_WORK_TYPES',
    'CORE_FORBIDDEN_DUTY_PATTERNS',
    'IMPORTANT_FORBIDDEN_DUTY_PATTERNS',
    'MAX_CONSECUTIVE_WORK_DAYS',
    'MAX_CONSECUTIVE_N',
    'MIN_OFF_AFTER_N',
    'MIN_STAFF_BY_SHIFT',
    'MAX_STAFF_BY_SHIFT',
    'MIN_STAFF_BY_DATE_SHIFT',
    'MIN_STAFF_BY_DAY_TYPE_SHIFT',
    'MIN_STAFF_WEEKEND_HOLIDAY_SHIFT',
    'NEW_NURSE_NOT_ALONE_N',
    'PRECEPTEE_NOT_ALONE_N',
]);
const MODAL_CATEGORY_BY_TEMPLATE_CODE: Record<string, TTemplateCategory> = {
    CORE_MAX_CONTINUOUS_WORK: 'WORK_REST',
    CORE_MIN_NIGHT_INTERVAL: 'WORK_REST',
    CORE_MAX_CONTINUOUS_NIGHT: 'FORBIDDEN_PATTERN',
    CORE_MIN_OFF_AFTER_NIGHT: 'WORK_REST',
    CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF: 'FORBIDDEN_PATTERN',
    TWO_SHIFT_MAX_LINES: 'TWO_SHIFT',
    CORE_MIN_REST_HOURS: 'TWO_SHIFT',
    MAX_MONTHLY_WORK_HOURS: 'TWO_SHIFT',
};
const TWO_SHIFT_CONFIGURATION_CODES = ['TWO_SHIFT_MAX_LINES', 'CORE_MIN_REST_HOURS', 'MAX_MONTHLY_WORK_HOURS'] as const;
const TWO_SHIFT_CONFIGURATION_CODE_SET = new Set<string>(TWO_SHIFT_CONFIGURATION_CODES);

function hasFinalConsonant(value: unknown) {
    const trimmed = String(value ?? '').trim();
    const lastChar = trimmed.charAt(trimmed.length - 1);

    if (!lastChar) return false;

    const code = lastChar.charCodeAt(0);

    if (code < 0xac00 || code > 0xd7a3) return false;

    return (code - 0xac00) % 28 !== 0;
}

const KO_PARTICLES = {
    topicWithBatchim: '\uC740',
    topicWithoutBatchim: '\uB294',
    subjectWithBatchim: '\uC774',
    subjectWithoutBatchim: '\uAC00',
    objectWithBatchim: '\uC744',
    objectWithoutBatchim: '\uB97C',
    pairWithBatchim: '\uACFC',
    pairWithoutBatchim: '\uC640',
};
const LEGACY_ALL_LABELS = new Set(['\uBAA8\uB4E0', '\uBAA8\uB4E0\uB0A0']);
const LEGACY_OFF_NAME = '\uC624\uD504';
const STAFFING_COUNT_TEMPLATE_CODES = new Set([
    'STAFF_COUNT_BY_SHIFT',
    'MIN_STAFF_BY_SHIFT',
    'MAX_STAFF_BY_SHIFT',
    'MIN_STAFF_BY_DATE_SHIFT',
    'MIN_STAFF_BY_DAY_TYPE_SHIFT',
    'MIN_STAFF_WEEKEND_HOLIDAY_SHIFT',
    'SOFT_MIN_STAFF_BY_DUTY',
    'SOFT_MAX_STAFF_BY_DUTY',
    'SOFT_MIN_STAFF_BY_DATE_DUTY',
    'SOFT_MIN_STAFF_WEEKEND_HOLIDAY',
]);
const MIN_STAFFING_COUNT_TEMPLATE_CODES = new Set([
    'MIN_STAFF_BY_SHIFT',
    'MIN_STAFF_BY_DATE_SHIFT',
    'MIN_STAFF_BY_DAY_TYPE_SHIFT',
    'MIN_STAFF_WEEKEND_HOLIDAY_SHIFT',
    'SOFT_MIN_STAFF_BY_DUTY',
    'SOFT_MIN_STAFF_BY_DATE_DUTY',
    'SOFT_MIN_STAFF_WEEKEND_HOLIDAY',
]);
const MAX_STAFFING_COUNT_TEMPLATE_CODES = new Set(['MAX_STAFF_BY_SHIFT', 'SOFT_MAX_STAFF_BY_DUTY']);

function getTemplateTranslationKey(templateId: string, property: 'label' | 'sentence') {
    return `page.makeShift.constraints.templates.${templateId}.${property}` as TI18nKey;
}

type TSoftRuleTemplateDefinition = Pick<TSoftRuleTemplate, 'id' | 'category' | 'controls'>;

const SOFT_RULE_TEMPLATE_DEFINITIONS: TSoftRuleTemplateDefinition[] = [
    {
        id: 'CORE_MAX_CONTINUOUS_WORK',
        category: 'WORK_REST',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'count', kind: 'number', min: 1, max: 31},
        ],
    },
    {
        id: 'CORE_MIN_NIGHT_INTERVAL',
        category: 'WORK_REST',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'count', kind: 'number', min: 1, max: 31},
        ],
    },
    {
        id: 'CORE_MAX_CONTINUOUS_NIGHT',
        category: 'FORBIDDEN_PATTERN',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'count', kind: 'number', min: 1, max: 31},
        ],
    },
    {
        id: 'CORE_MIN_OFF_AFTER_NIGHT',
        category: 'WORK_REST',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'count', kind: 'number', min: 1, max: 31},
        ],
    },
    {
        id: 'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
        category: 'FORBIDDEN',
        controls: [{key: 'target', kind: 'select', optionsKey: 'target'}],
    },
    {
        id: 'MIN_STAFF_BY_SHIFT',
        category: 'STAFFING',
        controls: [
            {key: 'shift', kind: 'select', optionsKey: 'duty'},
            {key: 'count', kind: 'number', min: 1, max: 100},
        ],
    },
    {
        id: 'MAX_STAFF_BY_SHIFT',
        category: 'STAFFING',
        controls: [
            {key: 'shift', kind: 'select', optionsKey: 'duty'},
            {key: 'count', kind: 'number', min: 1, max: 100},
        ],
    },
    {
        id: 'MIN_STAFF_BY_DATE_SHIFT',
        category: 'STAFFING',
        controls: [
            {key: 'date', kind: 'select', optionsKey: 'date'},
            {key: 'shift', kind: 'select', optionsKey: 'duty'},
            {key: 'count', kind: 'number', min: 1, max: 100},
        ],
    },
    {
        id: 'MIN_STAFF_WEEKEND_HOLIDAY_SHIFT',
        category: 'STAFFING',
        controls: [
            {key: 'shift', kind: 'select', optionsKey: 'duty'},
            {key: 'count', kind: 'number', min: 1, max: 100},
        ],
    },
    {
        id: 'MAX_CONSECUTIVE_WORK_DAYS',
        category: 'WORK_REST',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'count', kind: 'number', min: 1, max: 31},
        ],
    },
    {
        id: 'OFF_AFTER_CONSECUTIVE_WORK',
        category: 'WORK_REST',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'count', kind: 'number', min: 1, max: 31},
        ],
    },
    {
        id: 'MIN_OFF_AFTER_N',
        category: 'WORK_REST',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'count', kind: 'number', min: 1, max: 31},
        ],
    },
    {
        id: 'MIN_MONTHLY_OFF',
        category: 'WORK_REST',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'count', kind: 'number', min: 1, max: 31},
        ],
    },
    {
        id: 'NURSE_FORBID_WEEKEND',
        category: 'PERSONAL',
        controls: [{key: 'nurse', kind: 'select', optionsKey: 'nurse'}],
    },
    {
        id: 'NURSE_PREFER_SHIFT',
        category: 'PERSONAL',
        controls: [
            {key: 'nurse', kind: 'select', optionsKey: 'nurse'},
            {key: 'shift', kind: 'select', optionsKey: 'dutyStrict'},
        ],
    },
    {
        id: 'NURSE_AVOID_SHIFT',
        category: 'PERSONAL',
        controls: [
            {key: 'nurse', kind: 'select', optionsKey: 'nurse'},
            {key: 'shift', kind: 'select', optionsKey: 'dutyStrict'},
        ],
    },
    {
        id: 'IMPORTANT_MAX_WORK_STREAK',
        category: 'WORK_REST',
        controls: [{key: 'days', kind: 'number', values: [3, 4, 5, 6]}],
    },
    {
        id: 'IMPORTANT_MAX_SAME_DUTY_STREAK',
        category: 'WORK_REST',
        controls: [{key: 'days', kind: 'number', values: [3, 4, 5, 6]}],
    },
    {
        id: 'IMPORTANT_MIN_NIGHT_INTERVAL',
        category: 'WORK_REST',
        controls: [{key: 'days', kind: 'number', min: 3, max: 7}],
    },
    {
        id: 'IMPORTANT_MAX_NIGHT_STREAK',
        category: 'WORK_REST',
        controls: [{key: 'days', kind: 'number', values: [2, 3, 4, 5, 7]}],
    },
    {
        id: 'IMPORTANT_OFF_AFTER_NIGHT',
        category: 'WORK_REST',
        controls: [{key: 'days', kind: 'number', min: 1, max: 5}],
    },
    {
        id: 'IMPORTANT_NO_NIGHT_BEFORE_REQUEST_OFF',
        category: 'FORBIDDEN',
        controls: [],
    },
    {
        id: 'IMPORTANT_FORBIDDEN_DUTY_PATTERNS',
        category: 'FORBIDDEN',
        controls: [],
    },
    {
        id: 'SOFT_MIN_STAFF_BY_DUTY',
        category: 'STAFFING',
        controls: [
            {key: 'duty', kind: 'select', optionsKey: 'duty'},
            {key: 'count', kind: 'number', min: 1, max: 10},
        ],
    },
    {
        id: 'SOFT_MAX_STAFF_BY_DUTY',
        category: 'STAFFING',
        controls: [
            {key: 'duty', kind: 'select', optionsKey: 'duty'},
            {key: 'count', kind: 'number', min: 1, max: 10},
        ],
    },
    {
        id: 'SOFT_MIN_STAFF_BY_DATE_DUTY',
        category: 'STAFFING',
        controls: [
            {key: 'date', kind: 'select', optionsKey: 'date'},
            {key: 'duty', kind: 'select', optionsKey: 'duty'},
            {key: 'count', kind: 'number', min: 1, max: 10},
        ],
    },
    {
        id: 'SOFT_MIN_STAFF_WEEKEND_HOLIDAY',
        category: 'STAFFING',
        controls: [
            {key: 'duty', kind: 'select', optionsKey: 'duty'},
            {key: 'count', kind: 'number', min: 1, max: 10},
        ],
    },
    {
        id: 'SOFT_NO_N_TO_D',
        category: 'FORBIDDEN',
        controls: [{key: 'target', kind: 'select', optionsKey: 'target'}],
    },
    {
        id: 'SOFT_NO_N_TO_E',
        category: 'FORBIDDEN',
        controls: [{key: 'target', kind: 'select', optionsKey: 'target'}],
    },
    {
        id: 'SOFT_NO_E_TO_D',
        category: 'FORBIDDEN',
        controls: [{key: 'target', kind: 'select', optionsKey: 'target'}],
    },
    {
        id: 'SOFT_NO_E_TO_N',
        category: 'FORBIDDEN',
        controls: [{key: 'target', kind: 'select', optionsKey: 'target'}],
    },
    {
        id: 'SOFT_MAX_CONSECUTIVE_N',
        category: 'FORBIDDEN',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'count', kind: 'number', min: 2, max: 7},
        ],
    },
    {
        id: 'SOFT_MAX_CONSECUTIVE_WORK',
        category: 'WORK_REST',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'days', kind: 'number', min: 3, max: 15},
        ],
    },
    {
        id: 'SOFT_NEED_OFF_AFTER_CONSECUTIVE',
        category: 'WORK_REST',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'days', kind: 'number', min: 2, max: 15},
        ],
    },
    {
        id: 'SOFT_NEED_OFF_AFTER_N',
        category: 'WORK_REST',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'days', kind: 'number', min: 1, max: 5},
        ],
    },
    {
        id: 'SOFT_MIN_MONTHLY_OFF',
        category: 'WORK_REST',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'days', kind: 'number', min: 1, max: 15},
        ],
    },
    {
        id: 'SOFT_NO_WEEKEND_FOR_NURSE',
        category: 'PERSONAL',
        controls: [{key: 'nurse', kind: 'select', optionsKey: 'nurse'}],
    },
    {
        id: 'SOFT_NO_SAME_DUTY_PAIR',
        category: 'COMBINATION',
        controls: [
            {key: 'nurseA', kind: 'select', optionsKey: 'nurse'},
            {key: 'nurseB', kind: 'select', optionsKey: 'nurse'},
        ],
    },
    {
        id: 'SOFT_PREFER_SAME_DUTY_PAIR',
        category: 'COMBINATION',
        controls: [
            {key: 'nurseA', kind: 'select', optionsKey: 'nurse'},
            {key: 'nurseB', kind: 'select', optionsKey: 'nurse'},
        ],
    },
];
const DEFAULT_PARAMS_BY_TEMPLATE_CODE: Record<string, Record<string, unknown>> = {
    IMPORTANT_MAX_WORK_STREAK: {days: '3'},
    IMPORTANT_MAX_SAME_DUTY_STREAK: {days: '3'},
    IMPORTANT_MIN_NIGHT_INTERVAL: {days: '3'},
    IMPORTANT_MAX_NIGHT_STREAK: {days: '2'},
    IMPORTANT_OFF_AFTER_NIGHT: {days: '1'},
    IMPORTANT_NO_NIGHT_BEFORE_REQUEST_OFF: {},
    IMPORTANT_FORBIDDEN_DUTY_PATTERNS: {},
    CORE_MAX_CONTINUOUS_WORK: {target: ALL_CONSTRAINT_TARGET_OPTION, days: 5, maxDays: 5, maxContinuousWorkDays: 5, count: 5},
    CORE_MIN_NIGHT_INTERVAL: {target: ALL_CONSTRAINT_TARGET_OPTION, days: 5, minDays: 5, intervalDays: 5, count: 5},
    CORE_MAX_CONTINUOUS_NIGHT: {target: ALL_CONSTRAINT_TARGET_OPTION, count: 3},
    CORE_MIN_CONTINUOUS_NIGHT: {target: ALL_CONSTRAINT_TARGET_OPTION, count: 2},
    CORE_MIN_OFF_AFTER_NIGHT: {target: ALL_CONSTRAINT_TARGET_OPTION, count: 2},
    CORE_MAX_SAME_DUTY_STREAK: {days: '3', maxDays: '3'},
    CORE_MAX_NIGHT_STREAK: {days: '2', maxDays: '2'},
    CORE_OFF_AFTER_NIGHT: {days: '1', minOffDays: '1'},
    CORE_EXCLUDE_CERTAIN_WORK_TYPES: {target: ALL_CONSTRAINT_TARGET_OPTION},
    CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF: {target: ALL_CONSTRAINT_TARGET_OPTION},
    CORE_NO_NIGHT_BEFORE_REQUEST_OFF: {target: ALL_CONSTRAINT_TARGET_OPTION},
    CORE_FORBIDDEN_DUTY_PATTERNS: {target: ALL_CONSTRAINT_TARGET_OPTION},
    FORBID_N_THEN_D: {target: ALL_CONSTRAINT_TARGET_OPTION},
    FORBID_N_THEN_E: {target: ALL_CONSTRAINT_TARGET_OPTION},
    FORBID_E_THEN_D: {target: ALL_CONSTRAINT_TARGET_OPTION},
    FORBID_E_THEN_N: {target: ALL_CONSTRAINT_TARGET_OPTION},
    STAFF_COUNT_BY_SHIFT: {dateScope: {type: 'EVERYDAY'}, operator: {type: 'EXACT'}, count: 2},
    MIN_STAFF_BY_SHIFT: {count: '1'},
    MAX_STAFF_BY_SHIFT: {count: '1'},
    MIN_STAFF_BY_DATE_SHIFT: {count: '1'},
    MIN_STAFF_WEEKEND_HOLIDAY_SHIFT: {count: '1'},
    MAX_CONSECUTIVE_N: {count: '2'},
    MAX_CONSECUTIVE_WORK_DAYS: {count: '3'},
    OFF_AFTER_CONSECUTIVE_WORK: {count: '2'},
    MIN_OFF_AFTER_N: {count: '1'},
    MIN_MONTHLY_OFF: {count: '1'},
    TWO_SHIFT_MAX_LINES: {count: 2, unpaired: 1},
    CORE_MIN_REST_HOURS: {target: ALL_CONSTRAINT_TARGET_OPTION, count: 11},
    MAX_MONTHLY_WORK_HOURS: {target: ALL_CONSTRAINT_TARGET_OPTION, count: 230},
};
const OPTION_GROUP_TO_OPTION_MAP_KEY: Record<string, string> = {
    target: 'target',
    targets: 'target',
    TARGET: 'target',
    TARGETS: 'target',
    nurse: 'nurse',
    nurses: 'nurse',
    NURSE: 'nurse',
    NURSES: 'nurse',
    preceptor: 'preceptor',
    preceptors: 'preceptor',
    PRECEPTOR: 'preceptor',
    PRECEPTORS: 'preceptor',
    preceptee: 'preceptee',
    preceptees: 'preceptee',
    PRECEPTEE: 'preceptee',
    PRECEPTEES: 'preceptee',
    date: 'date',
    dates: 'date',
    DATE: 'date',
    DATES: 'date',
    day: 'date',
    days: 'date',
    DAY: 'date',
    DAYS: 'date',
    dayType: 'dayType',
    dayTypes: 'dayType',
    daytypes: 'dayType',
    DAY_TYPE: 'dayType',
    DAY_TYPES: 'dayType',
    DAYTYPES: 'dayType',
    dateScope: 'dateScope',
    dateScopes: 'dateScope',
    DATE_SCOPE: 'dateScope',
    DATE_SCOPES: 'dateScope',
    DATESCOPE: 'dateScope',
    DATESCOPES: 'dateScope',
    operator: 'staffCountOperator',
    operators: 'staffCountOperator',
    staffCountOperator: 'staffCountOperator',
    staffCountOperators: 'staffCountOperator',
    STAFF_COUNT_OPERATOR: 'staffCountOperator',
    STAFF_COUNT_OPERATORS: 'staffCountOperator',
    shift: 'duty',
    shifts: 'dutyStrict',
    shiftsWithAll: 'duty',
    dutyStrict: 'dutyStrict',
    DUTY_STRICT: 'dutyStrict',
    DUTYSTRICT: 'dutyStrict',
    SHIFT: 'duty',
    SHIFTS: 'duty',
    SHIFT_TYPE: 'duty',
    SHIFT_TYPES: 'duty',
    SHIFTS_WITH_ALL: 'duty',
};
const LEGACY_TEMPLATE_ALIAS_BY_TEMPLATE_CODE: Record<string, string> = {
    FORBID_N_THEN_D: 'SOFT_NO_N_TO_D',
    FORBID_N_THEN_E: 'SOFT_NO_N_TO_E',
    FORBID_E_THEN_D: 'SOFT_NO_E_TO_D',
    FORBID_E_THEN_N: 'SOFT_NO_E_TO_N',
    MAX_CONSECUTIVE_N: 'SOFT_MAX_CONSECUTIVE_N',
    NURSE_PAIR_NOT_SAME_SHIFT: 'SOFT_NO_SAME_DUTY_PAIR',
    NURSE_PAIR_PREFER_SAME_SHIFT: 'SOFT_PREFER_SAME_DUTY_PAIR',
};
const DUTY_PATTERN_CODES: Record<string, string[]> = {
    ND: ['N', 'D'],
    ED: ['E', 'D'],
    NE: ['N', 'E'],
    EN: ['E', 'N'],
    NOD: ['N', 'OFF', 'D'],
};

function isRecommendedTemplateCode(templateCode: string, category?: string) {
    if (HIDDEN_RECOMMENDED_RULE_IDS.has(templateCode)) return false;

    if (TWO_SHIFT_CONFIGURATION_CODE_SET.has(templateCode)) return false;

    const normalizedCategory = category?.toUpperCase();

    return (
        RECOMMENDED_DEFAULT_RULE_IDS.has(templateCode) ||
        templateCode.startsWith('IMPORTANT_') ||
        templateCode.startsWith('CORE_') ||
        normalizedCategory === 'CORE' ||
        normalizedCategory === 'IMPORTANT' ||
        normalizedCategory === RECOMMENDED_MODAL_CATEGORY
    );
}

function isHiddenAddModalTemplate(templateCode: string) {
    return HIDDEN_RECOMMENDED_RULE_IDS.has(templateCode);
}

function getTemplateModalCategory(templateCode: string, category: TTemplateCategory) {
    return MODAL_CATEGORY_BY_TEMPLATE_CODE[templateCode] ?? category;
}

function isRecommendedOnlyCategory(category: TModalCategory) {
    return category === RECOMMENDED_MODAL_CATEGORY || category === 'CORE' || category === 'IMPORTANT';
}

function isRecommendedDefaultRuleCode(templateCode: string) {
    return RECOMMENDED_DEFAULT_RULE_IDS.has(templateCode);
}

function isTemplateSelectable(template: TShiftConstraintTemplate) {
    return (
        template.severity === 'HARD' ||
        template.severity === 'SOFT' ||
        template.allowedSeverities.includes('HARD') ||
        template.allowedSeverities.includes('SOFT')
    );
}

function getOptionMapKey(optionGroup?: string) {
    if (!optionGroup) return undefined;

    return OPTION_GROUP_TO_OPTION_MAP_KEY[optionGroup] ?? OPTION_GROUP_TO_OPTION_MAP_KEY[optionGroup.toUpperCase()] ?? optionGroup;
}

function getControlKind(slot: TShiftConstraintSlot): TControlDef['kind'] {
    return slot.inputType.toUpperCase() === 'NUMBER' ? 'number' : 'select';
}

function createControlFromSlot(slot: TShiftConstraintSlot): TControlDef {
    const kind = getControlKind(slot);

    if (kind === 'number') {
        return {
            key: slot.key,
            kind,
            min: slot.min ?? 1,
            max: slot.max ?? slot.min ?? 10,
        };
    }

    return {
        key: slot.key,
        kind,
        optionsKey: getOptionMapKey(slot.optionGroup),
    };
}

function isAsciiLetter(value: string | undefined) {
    return Boolean(value && /[A-Za-z]/.test(value));
}

function createTextSentenceParts(text: string): TSentencePart[] {
    const parts: TSentencePart[] = [];
    const tokenPattern = /(NOD|OFF|\/?오프|ND|ED|NE|N나이트|D데이|E이브닝|D|E|N)/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenPattern.exec(text))) {
        const token = match[0];
        const start = match.index;
        const end = start + token.length;
        const prev = text[start - 1];
        const next = text[end];

        if (isAsciiLetter(prev) || isAsciiLetter(next)) continue;

        if (start > lastIndex) {
            parts.push({type: 'text', text: text.slice(lastIndex, start)});
        }

        const dutyCode = getLegacyDutyCode(token);

        if (DUTY_PATTERN_CODES[dutyCode]) {
            parts.push({type: 'dutyPattern', codes: DUTY_PATTERN_CODES[dutyCode]});
        } else {
            parts.push({type: 'duty', code: dutyCode});
        }

        lastIndex = end;
    }

    if (lastIndex < text.length) {
        parts.push({type: 'text', text: text.slice(lastIndex)});
    }

    return parts.length ? parts : [{type: 'text', text}];
}

function getLegacyDutyCode(token: string) {
    if (token.includes('오프')) return 'OFF';

    if (token.startsWith('N')) return 'N';

    if (token.startsWith('D')) return 'D';

    if (token.startsWith('E')) return 'E';

    return token;
}

function getLeadingParticle(text: string) {
    const particlePairs = [
        {withBatchim: KO_PARTICLES.topicWithBatchim, withoutBatchim: KO_PARTICLES.topicWithoutBatchim},
        {withBatchim: KO_PARTICLES.subjectWithBatchim, withoutBatchim: KO_PARTICLES.subjectWithoutBatchim},
        {withBatchim: KO_PARTICLES.objectWithBatchim, withoutBatchim: KO_PARTICLES.objectWithoutBatchim},
        {withBatchim: KO_PARTICLES.pairWithBatchim, withoutBatchim: KO_PARTICLES.pairWithoutBatchim},
    ];
    const firstChar = text.charAt(0);

    return particlePairs.find((particle) => particle.withBatchim === firstChar || particle.withoutBatchim === firstChar) ?? null;
}

function createSentenceFromPattern(displayTemplate: string, controls: TControlDef[]): TSentencePart[] {
    const parts: TSentencePart[] = [];
    const controlKeys = new Set(controls.map((control) => control.key));
    const pattern = /\{([^}]+)\}/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(displayTemplate))) {
        if (match.index > lastIndex) {
            parts.push(...createTextSentenceParts(displayTemplate.slice(lastIndex, match.index)));
        }

        const key = match[1]?.trim() ?? '';

        if (controlKeys.has(key)) {
            parts.push({type: 'control', key});

            const particle = getLeadingParticle(displayTemplate.slice(match.index + match[0].length));

            if (particle) {
                parts.push({type: 'particle', key, ...particle});
                lastIndex = match.index + match[0].length + 1;

                continue;
            }
        } else {
            parts.push({type: 'text', text: `{${key}}`});
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < displayTemplate.length) {
        parts.push(...createTextSentenceParts(displayTemplate.slice(lastIndex)));
    }

    return parts.length ? parts : [{type: 'text', text: displayTemplate}];
}

function createSentenceFromTemplate(template: TShiftConstraintTemplate, controls: TControlDef[]): TSentencePart[] {
    return createSentenceFromPattern(template.displayTemplate, controls);
}

function interpolateLocalizedPattern(pattern: string, params: Record<string, string>) {
    return pattern.replace(/\{([^}]+)\}/g, (_, key: string) => params[key.trim()] ?? '');
}

function canUseLegacySentence(legacyTemplate: TSoftRuleTemplate | undefined, controls: TControlDef[]) {
    if (!legacyTemplate) return false;

    const controlKeys = new Set(controls.map((control) => control.key));

    return legacyTemplate.sentence.every((part) => part.type !== 'control' || controlKeys.has(part.key));
}

function interpolateDisplayTemplate(displayTemplate: string, _controls: TControlDef[], params: Record<string, string>) {
    return displayTemplate.replace(/\{([^}]+)\}/g, (_, key: string) => params[key.trim()] ?? '');
}

function createLocalizedSoftRuleTemplate(definition: TSoftRuleTemplateDefinition, t: TTypedT): TSoftRuleTemplate {
    const sentencePattern = t(getTemplateTranslationKey(definition.id, 'sentence'));

    return {
        ...definition,
        label: t(getTemplateTranslationKey(definition.id, 'label')),
        sentence: createSentenceFromPattern(sentencePattern, definition.controls),
        buildText: (params) => interpolateLocalizedPattern(sentencePattern, params),
        isRecommended: isRecommendedTemplateCode(definition.id, definition.category),
    };
}

function createSoftRuleTemplates(templates: TShiftConstraintTemplate[], t: TTypedT) {
    const legacyTemplates = createLegacySoftRuleTemplates(t);

    return templates.filter(isTemplateSelectable).map<TSoftRuleTemplate>((template) => {
        const controls = template.slots.map(createControlFromSlot);
        const legacyTemplate = legacyTemplates.find(
            (item) => item.id === (LEGACY_TEMPLATE_ALIAS_BY_TEMPLATE_CODE[template.templateCode] ?? template.templateCode),
        );
        const sentence = canUseLegacySentence(legacyTemplate, controls)
            ? legacyTemplate!.sentence
            : createSentenceFromTemplate(template, controls);

        return {
            id: template.templateCode,
            category: getTemplateModalCategory(template.templateCode, template.category),
            label: legacyTemplate?.label ?? getCategoryLabel(t, template.category),
            controls,
            sentence,
            buildText: legacyTemplate?.buildText ?? ((params) => interpolateDisplayTemplate(template.displayTemplate, controls, params)),
            isRecommended: isRecommendedTemplateCode(template.templateCode, template.category),
            sourceTemplate: template,
        };
    });
}

function createLegacySoftRuleTemplates(t: TTypedT) {
    return SOFT_RULE_TEMPLATE_DEFINITIONS.map((template) => createLocalizedSoftRuleTemplate(template, t));
}

function createClientId(rule: {shiftConstraintRuleId?: number; templateCode: string}) {
    if (rule.shiftConstraintRuleId) return `saved-${rule.shiftConstraintRuleId}`;

    return `draft-${rule.templateCode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fromServerRules(rules: Omit<TShiftConstraintRuleDraft, 'clientId'>[]) {
    return rules.map((rule) => ({
        ...rule,
        isImportant: rule.severity === 'HARD',
        clientId: createClientId(rule),
    }));
}

function createRulesFromServer(serverRules: TShiftConstraintRule[]) {
    return fromServerRules(serverRules);
}

function getSelectOptionParamValue(option: TSelectOption | undefined) {
    return option?.raw ?? option?.value ?? option?.label ?? '';
}

function getDefaultParams(template: TSoftRuleTemplate, optionMap: Record<string, TSelectOption[]> = {}): Record<string, unknown> {
    const configuredDefaults = DEFAULT_PARAMS_BY_TEMPLATE_CODE[template.id] ?? {};
    const params: Record<string, unknown> = {};

    template.controls.forEach((control) => {
        if (configuredDefaults[control.key] != null) {
            params[control.key] = configuredDefaults[control.key];

            return;
        }

        if (control.kind === 'number') {
            params[control.key] = control.values?.[0] ?? control.min ?? 1;

            return;
        }

        params[control.key] = getSelectOptionParamValue(optionMap[control.optionsKey ?? '']?.[0]);
    });

    return params;
}

function normalizeNumberParams(template: TSoftRuleTemplate | undefined, params: Record<string, unknown>) {
    if (!template) return params;

    const next = {...params};

    template.controls.forEach((control) => {
        if (control.kind !== 'number') return;

        const value = next[control.key];

        if (typeof value === 'number') return;

        const numericValue = typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;

        if (Number.isFinite(numericValue)) {
            next[control.key] = numericValue;
        }
    });

    return next;
}

function toSavedRule(rule: TShiftConstraintRuleDraft, index: number, template?: TSoftRuleTemplate) {
    return {
        shiftConstraintRuleId: rule.shiftConstraintRuleId,
        templateCode: rule.templateCode,
        severity: rule.severity,
        sortOrder: index + 1,
        params: normalizeNumberParams(template, rule.params),
        selected: rule.selected !== false,
        isImportant: rule.severity === 'HARD',
    };
}

function toRulesQueryData(
    wardId: number,
    shiftTeamId: number,
    rules: TShiftConstraintRuleDraft[],
    previous?: TShiftConstraintRulesResponse,
): TShiftConstraintRulesResponse {
    return {
        schemaVersion: previous?.schemaVersion ?? 1,
        wardId,
        shiftTeamId,
        rules: rules.map((rule, index) => ({
            shiftConstraintRuleId: rule.shiftConstraintRuleId,
            templateCode: rule.templateCode,
            category: rule.category,
            severity: rule.severity,
            sortOrder: index + 1,
            params: rule.params,
            selected: rule.selected !== false,
            isImportant: rule.severity === 'HARD',
            displayText: rule.displayText,
            isValid: rule.isValid,
            invalidReason: rule.invalidReason,
        })),
    };
}

function getOptionKey(option: TShiftConstraintOption) {
    if (option.nurseId != null) return `nurse-${option.nurseId}`;

    if (option.wardShiftTypeId != null) return `shift-${option.wardShiftTypeId}`;

    if (option.day != null) return `day-${option.day}`;

    return `${option.type}-${option.label ?? option.name ?? option.code ?? ''}`;
}

function isConstraintOption(value: unknown): value is TShiftConstraintOption {
    return typeof value === 'object' && value !== null && 'type' in value;
}

function getValueLabel(value: unknown) {
    if (typeof value === 'number') return String(value);

    if (typeof value === 'string') return value;

    if (!isConstraintOption(value)) return '-';

    return value.label ?? value.name ?? value.code ?? value.type;
}

function normalizeDuplicateParamValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(normalizeDuplicateParamValue);

    if (!value || typeof value !== 'object') return value;

    if (isConstraintOption(value)) {
        return {
            type: value.type,
            nurseId: value.nurseId,
            wardShiftTypeId: value.wardShiftTypeId,
            day: value.day,
            code: value.code,
        };
    }

    return Object.fromEntries(
        Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entryValue]) => [key, normalizeDuplicateParamValue(entryValue)]),
    );
}

function stringifyDuplicateParams(params: Record<string, unknown>) {
    return JSON.stringify(normalizeDuplicateParamValue(params));
}

function getConstraintOptionType(value: unknown) {
    if (isConstraintOption(value) && typeof value.type === 'string') return value.type.trim().toUpperCase();

    if (typeof value === 'string') return value.trim().toUpperCase();

    return null;
}

function getConstraintOptionDay(value: unknown) {
    if (isConstraintOption(value) && typeof value.day === 'number') return value.day;

    if (typeof value === 'number' && Number.isInteger(value)) return value;

    if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value);

    return null;
}

function getDuplicateDateScopeKey(value: unknown) {
    const day = getConstraintOptionDay(value);
    const type = getConstraintOptionType(value) ?? (day != null ? 'DAY_OF_MONTH' : null);

    if (!type) return stringifyDuplicateParams({value});

    if (type === 'DAY_OF_MONTH') return day != null ? `DAY_OF_MONTH:${day}` : 'DAY_OF_MONTH';

    return type;
}

function getStaffingDuplicateDateScope(rule: TShiftConstraintRuleDraft) {
    if (rule.templateCode === 'STAFF_COUNT_BY_SHIFT') return getDuplicateDateScopeKey(rule.params.dateScope);

    if (rule.templateCode === 'MIN_STAFF_BY_DATE_SHIFT' || rule.templateCode === 'SOFT_MIN_STAFF_BY_DATE_DUTY') {
        return getDuplicateDateScopeKey(rule.params.date);
    }

    if (rule.templateCode === 'MIN_STAFF_BY_DAY_TYPE_SHIFT') return getDuplicateDateScopeKey(rule.params.date ?? rule.params.dayType);

    if (rule.templateCode === 'MIN_STAFF_WEEKEND_HOLIDAY_SHIFT' || rule.templateCode === 'SOFT_MIN_STAFF_WEEKEND_HOLIDAY') {
        return 'WEEKEND_OR_HOLIDAY';
    }

    return 'EVERYDAY';
}

function getStaffingDuplicateOperator(rule: TShiftConstraintRuleDraft) {
    if (rule.templateCode === 'STAFF_COUNT_BY_SHIFT') return getConstraintOptionType(rule.params.operator);

    if (MIN_STAFFING_COUNT_TEMPLATE_CODES.has(rule.templateCode)) return 'MIN';

    if (MAX_STAFFING_COUNT_TEMPLATE_CODES.has(rule.templateCode)) return 'MAX';

    return null;
}

function getStaffingDuplicateShift(rule: TShiftConstraintRuleDraft) {
    const value = rule.params.shift ?? rule.params.duty;

    if (isConstraintOption(value)) {
        if (value.wardShiftTypeId != null) return `SHIFT_ID:${value.wardShiftTypeId}`;

        if (value.code) return `SHIFT_CODE:${String(value.code).trim().toUpperCase()}`;

        if (value.type) return `SHIFT_TYPE:${String(value.type).trim().toUpperCase()}`;
    }

    if (typeof value === 'number' || typeof value === 'string') return String(value).trim().toUpperCase();

    return stringifyDuplicateParams({value});
}

function getStaffingDuplicateCount(rule: TShiftConstraintRuleDraft) {
    const value = rule.params.count;

    if (value == null || value === '') return null;

    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? String(numericValue) : String(value);
}

function getStaffingDuplicateKey(rule: TShiftConstraintRuleDraft) {
    if (!STAFFING_COUNT_TEMPLATE_CODES.has(rule.templateCode)) return null;

    const dateScope = getStaffingDuplicateDateScope(rule);
    const shift = getStaffingDuplicateShift(rule);
    const operator = getStaffingDuplicateOperator(rule);
    const count = getStaffingDuplicateCount(rule);

    if (!dateScope || !shift || !operator || count == null) return null;

    return ['STAFF_COUNT_BY_SHIFT', dateScope, shift, operator, count].join('|');
}

function getConstraintDuplicateKey(rule: TShiftConstraintRuleDraft) {
    const staffingDuplicateKey = getStaffingDuplicateKey(rule);

    if (staffingDuplicateKey) return staffingDuplicateKey;

    return [rule.templateCode, stringifyDuplicateParams(rule.params)].join('|');
}

function compactDuplicateRules(rules: TShiftConstraintRuleDraft[]) {
    const indexByKey = new Map<string, number>();
    const compacted: TShiftConstraintRuleDraft[] = [];

    let removedCount = 0;

    rules.forEach((rule) => {
        const key = getConstraintDuplicateKey(rule);
        const existingIndex = indexByKey.get(key);

        if (existingIndex == null) {
            indexByKey.set(key, compacted.length);
            compacted.push(rule);

            return;
        }

        removedCount += 1;

        const existingRule = compacted[existingIndex];
        const isImportant = [existingRule.isImportant, rule.isImportant].some(Boolean);

        compacted[existingIndex] = {
            ...existingRule,
            shiftConstraintRuleId: existingRule.shiftConstraintRuleId ?? rule.shiftConstraintRuleId,
            severity: isImportant ? 'HARD' : existingRule.severity,
            isImportant,
            isValid: existingRule.isValid ?? rule.isValid,
            invalidReason: existingRule.invalidReason ?? rule.invalidReason,
        };
    });

    return {
        removedCount,
        rules: compacted.map((rule, index) => ({...rule, sortOrder: index + 1})),
    };
}

function getRuleTitle(rule: TShiftConstraintRuleDraft, template?: TShiftConstraintTemplate) {
    if (rule.displayText) return rule.displayText;

    if (!template) return rule.templateCode;

    return template.displayTemplate.split('{')[0].trim() || template.templateCode;
}

function daysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
}

function uniqueByValue(options: TSelectOption[]) {
    const map = new Map<string, TSelectOption>();

    options.forEach((option) => {
        const existing = map.get(option.value);

        map.set(option.value, existing ? mergeSelectOptionDetails(existing, option) : option);
    });

    return Array.from(map.values());
}

function mergeConstraintOptionDetails(left: TShiftConstraintOption | undefined, right: TShiftConstraintOption | undefined) {
    if (!left) return right;

    if (!right) return left;

    return {
        ...left,
        label: left.label ?? right.label,
        name: left.name ?? right.name,
        nurseId: left.nurseId ?? right.nurseId,
        wardShiftTypeId: left.wardShiftTypeId ?? right.wardShiftTypeId,
        code: left.code ?? right.code,
        day: left.day ?? right.day,
        isPreceptor: left.isPreceptor === true || right.isPreceptor === true ? true : (left.isPreceptor ?? right.isPreceptor),
        isPreceptee: left.isPreceptee === true || right.isPreceptee === true ? true : (left.isPreceptee ?? right.isPreceptee),
    };
}

function mergeSelectOptionDetails(left: TSelectOption, right: TSelectOption): TSelectOption {
    return {
        ...left,
        kind: left.kind ?? right.kind,
        shortName: left.shortName ?? right.shortName,
        name: left.name ?? right.name,
        color: left.color ?? right.color,
        classification: left.classification ?? right.classification,
        isOff: left.isOff ?? right.isOff,
        isPreceptor: left.isPreceptor === true || right.isPreceptor === true ? true : (left.isPreceptor ?? right.isPreceptor),
        isPreceptee: left.isPreceptee === true || right.isPreceptee === true ? true : (left.isPreceptee ?? right.isPreceptee),
        raw: mergeConstraintOptionDetails(left.raw, right.raw),
    };
}

function normalizeShiftTypes(input: unknown): TShiftTypeLike[] {
    if (Array.isArray(input)) {
        return (input as TShiftTypeLike[]).filter((shiftType) => shiftType.isActive !== false);
    }

    if (input && typeof input === 'object') {
        const maybe = input as {shiftTypes?: unknown; wardShiftTypes?: unknown};

        if (Array.isArray(maybe.shiftTypes)) {
            return (maybe.shiftTypes as TShiftTypeLike[]).filter((shiftType) => shiftType.isActive !== false);
        }

        if (Array.isArray(maybe.wardShiftTypes)) {
            return (maybe.wardShiftTypes as TShiftTypeLike[]).filter((shiftType) => shiftType.isActive !== false);
        }
    }

    return EMPTY_SHIFT_TYPES;
}

function getCandidateOptionValue(option: TShiftConstraintOption) {
    if (isAllCandidateOption(option)) return 'ALL';

    if (option.nurseId != null) return String(option.nurseId);

    if (option.wardShiftTypeId != null) return String(option.wardShiftTypeId);

    if (option.day != null) return String(option.day);

    if (option.code) return option.code;

    if (option.type) return option.type;

    return option.label ?? option.name ?? option.type;
}

function isAllCandidateOption(option: TShiftConstraintOption) {
    const values = [option.type, option.code, option.label, option.name].filter(Boolean).map((value) => String(value).toUpperCase());

    return values.some((value) => value === 'ALL' || value.includes('ALL_') || LEGACY_ALL_LABELS.has(value));
}

function isAllSelectOption(option: TSelectOption) {
    return isAllCandidateOption(option.raw ?? {type: option.value, label: option.label, code: option.shortName, name: option.name});
}

function withoutAllSelectOptions(options: TSelectOption[]) {
    return options.filter((option) => !isAllSelectOption(option));
}

function getLocalizedAllOptionLabel(t: TTypedT, optionMapKey: string) {
    if (optionMapKey === 'target') return t('page.makeShift.constraints.option.allPeople');

    if (optionMapKey === 'date' || optionMapKey === 'dayType') return t('page.makeShift.constraints.option.allDays');

    return t('page.makeShift.constraints.option.all');
}

function getCandidateOptionLabel(t: TTypedT, option: TShiftConstraintOption, optionMapKey: string, shiftType?: TShiftTypeLike) {
    if (isAllCandidateOption(option)) return getLocalizedAllOptionLabel(t, optionMapKey);

    if (optionMapKey === 'date' && option.day != null) return t('page.makeShift.constraints.option.dayLabel', {day: option.day});

    if (optionMapKey === 'dateScope' && option.day != null) {
        return t('page.makeShift.constraints.option.monthlyDayLabel', {day: option.day});
    }

    if (option.label) return option.label;

    if (option.name) return option.name;

    if (option.code) return option.code;

    if (option.day != null) return t('page.makeShift.constraints.option.dayLabel', {day: option.day});

    return shiftType?.name ?? option.type;
}

function toSelectOption(option: TShiftConstraintOption, optionMapKey: string, shiftTypes: TShiftTypeLike[], t: TTypedT): TSelectOption {
    const shiftType =
        option.wardShiftTypeId != null ? shiftTypes.find((item) => item.wardShiftTypeId === option.wardShiftTypeId) : undefined;
    const isDuty = optionMapKey === 'duty' || optionMapKey === 'dutyStrict';
    const label = getCandidateOptionLabel(t, option, optionMapKey, shiftType);

    if (!isDuty) {
        const isNurse = option.nurseId != null;

        return {
            value: getCandidateOptionValue(option),
            label,
            kind: isNurse ? 'nurse' : undefined,
            isPreceptor: isNurse ? hasPreceptorRole(option) : undefined,
            isPreceptee: isNurse ? hasPrecepteeRole(option) : undefined,
            raw: option,
        };
    }

    const shortName = shiftType?.shortName ?? option.code ?? label.split(' ')[0] ?? label;
    const name = shiftType?.name ?? option.name ?? label;

    return {
        value: getCandidateOptionValue(option),
        label,
        kind: 'duty',
        shortName,
        name,
        color: shiftType?.color,
        classification: shiftType?.classification,
        isOff: shiftType?.isOff,
        raw: option,
    };
}

function getCandidateOptions(
    candidates: TShiftConstraintOptions,
    optionMapKey: string,
    candidateKeys: string[],
    fallback: TSelectOption[],
    shiftTypes: TShiftTypeLike[],
    t: TTypedT,
    options?: {includeFallback?: boolean},
) {
    const serverOptions = candidateKeys.flatMap((key) => candidates[key] ?? []);

    if (!serverOptions.length) return fallback;

    const resolvedServerOptions = serverOptions.map((option) => toSelectOption(option, optionMapKey, shiftTypes, t));

    return uniqueByValue(options?.includeFallback ? [...resolvedServerOptions, ...fallback] : resolvedServerOptions);
}

function mergeCandidateOptionMap(
    candidates: TShiftConstraintOptions,
    fallback: Record<string, TSelectOption[]>,
    shiftTypes: TShiftTypeLike[],
    t: TTypedT,
): Record<string, TSelectOption[]> {
    const duty = getCandidateOptions(
        candidates,
        'duty',
        ['shiftsWithAll', 'shifts', 'shiftTypes', 'SHIFT_TYPE', 'SHIFTS_WITH_ALL'],
        fallback.duty,
        shiftTypes,
        t,
        {includeFallback: true},
    );
    const nurse = getCandidateOptions(candidates, 'nurse', ['nurses', 'NURSES'], fallback.nurse, shiftTypes, t);
    const target = getCandidateOptions(candidates, 'target', ['targets', 'TARGETS'], fallback.target, shiftTypes, t, {
        includeFallback: true,
    });
    const date = withoutAllSelectOptions(getCandidateOptions(candidates, 'date', ['dates', 'DATES'], fallback.date, shiftTypes, t));
    const dayType = withoutAllSelectOptions(
        getCandidateOptions(
            candidates,
            'dayType',
            ['dayTypes', 'dayType', 'daytypes', 'DAY_TYPES', 'DAY_TYPE', 'DAYTYPES'],
            fallback.dayType ?? [],
            shiftTypes,
            t,
        ),
    );
    const dateScope = withoutAllSelectOptions(
        getCandidateOptions(
            candidates,
            'dateScope',
            ['dateScopes', 'dateScope', 'DATESCOPES', 'DATE_SCOPES', 'DATE_SCOPE'],
            fallback.dateScope ?? [],
            shiftTypes,
            t,
        ),
    );

    return {
        target,
        duty,
        date: date.length ? date : fallback.date,
        dayType,
        dateScope: dateScope.length ? dateScope : (fallback.dateScope ?? []),
        staffCountOperator: getCandidateOptions(
            candidates,
            'staffCountOperator',
            ['staffCountOperators', 'staffCountOperator', 'STAFF_COUNT_OPERATORS', 'STAFF_COUNT_OPERATOR'],
            fallback.staffCountOperator ?? [],
            shiftTypes,
            t,
        ),
        nurse,
        preceptor: getCandidateOptions(candidates, 'preceptor', ['preceptors', 'PRECEPTORS'], fallback.preceptor, shiftTypes, t),
        preceptee: getCandidateOptions(candidates, 'preceptee', ['preceptees', 'PRECEPTEES'], fallback.preceptee, shiftTypes, t),
        dutyStrict: duty.filter((option) => !isAllSelectOption(option)),
    };
}

function findDutyOptionByCode(options: TSelectOption[], code: string) {
    const normalizedCode = code.trim().toUpperCase();

    if (normalizedCode === 'OFF') {
        return (
            options.find((option) => option.classification === 'OFF') ??
            options.find((option) => option.isOff === true) ??
            options.find((option) => option.shortName?.toUpperCase() === 'OFF') ??
            options.find((option) => option.shortName?.toUpperCase() === 'O') ??
            options.find((option) => Boolean(option.name?.includes(LEGACY_OFF_NAME)) || option.name?.toUpperCase() === 'OFF')
        );
    }

    const classificationByCode: Record<string, TShiftTypeLike['classification']> = {
        D: 'DAY',
        E: 'EVENING',
        N: 'NIGHT',
    };

    return (
        options.find((option) => option.classification === classificationByCode[normalizedCode]) ??
        options.find((option) => option.shortName?.toUpperCase() === normalizedCode)
    );
}

function getOptionsForControl(
    control: TControlDef,
    template: TSoftRuleTemplate,
    params: Record<string, string>,
    optionMap: Record<string, TSelectOption[]>,
) {
    const options = optionMap[control.optionsKey ?? ''] ?? [];

    if (!template.category.includes('COMBINATION') || control.optionsKey !== 'nurse') return options;

    const controlIndex = template.controls.findIndex((item) => item.key === control.key);

    if (controlIndex <= 0) return options;

    const priorNurseLabels = new Set(
        template.controls
            .slice(0, controlIndex)
            .filter((item) => item.optionsKey === 'nurse')
            .map((item) => {
                const value = params[item.key];
                const selectedOption = options.find((option) => doesSelectOptionMatchValue(option, value));

                return selectedOption?.label ?? stringifyRuleParamValue(value);
            })
            .filter(Boolean),
    );

    if (!priorNurseLabels.size) return options;

    return options.filter((option) => !priorNurseLabels.has(option.label));
}

function doesSelectOptionMatchValue(option: TSelectOption, value: unknown) {
    if (isConstraintOption(value) && option.raw) {
        return getCandidateOptionValue(option.raw) === getCandidateOptionValue(value) && option.raw.type === value.type;
    }

    const stringValue = stringifyRuleParamValue(value);
    const candidates = [option.label, option.value, option.shortName, option.name].filter(Boolean).map(String);

    return candidates.includes(stringValue);
}

function stringifyRuleParamValue(value: unknown): string {
    if (value == null) return '';

    if (typeof value === 'string') return value;

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);

    if (isConstraintOption(value)) return getValueLabel(value);

    if (Array.isArray(value)) return value.map(stringifyRuleParamValue).filter(Boolean).join(', ');

    if (typeof value === 'object') {
        const maybe = value as Record<string, unknown>;
        const label = maybe.label ?? maybe.name ?? maybe.code ?? maybe.value ?? maybe.id;

        if (label != null) return stringifyRuleParamValue(label);
    }

    return '';
}

function getControlParamString(control: TControlDef, value: unknown, optionMap: Record<string, TSelectOption[]>) {
    const stringValue = stringifyRuleParamValue(value);

    if (control.kind === 'number') return stringValue;

    const options = optionMap[control.optionsKey ?? ''] ?? [];
    const matchedOption = options.find((option) => doesSelectOptionMatchValue(option, value));

    return matchedOption?.label ?? stringValue;
}

function normalizeSoftRuleParams(
    template: TSoftRuleTemplate,
    params: Record<string, unknown>,
    optionMap: Record<string, TSelectOption[]>,
): Record<string, string> {
    const normalized = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, stringifyRuleParamValue(value)])) as Record<
        string,
        string
    >;

    template.controls.forEach((control) => {
        normalized[control.key] = getControlParamString(control, params[control.key], optionMap);
    });

    return normalized;
}

function getControlDisplayValue(
    control: TControlDef | undefined,
    template: TSoftRuleTemplate,
    params: Record<string, string>,
    optionMap: Record<string, TSelectOption[]>,
) {
    if (!control) return '';

    if (control.kind === 'number') {
        return params[control.key] ?? String(control.values?.[0] ?? control.min ?? 1);
    }

    const options = getOptionsForControl(control, template, params, optionMap);
    const value = params[control.key];

    if (!value) return options[0]?.label ?? '';

    return options.find((option) => doesSelectOptionMatchValue(option, value))?.label ?? value;
}

function normalizeCombinationParams(
    template: TSoftRuleTemplate,
    params: Record<string, unknown>,
    optionMap: Record<string, TSelectOption[]>,
): Record<string, unknown> {
    if (!template.category.includes('COMBINATION')) return params;

    const nurseControls = template.controls.filter((control) => control.optionsKey === 'nurse');
    const nurseOptions = optionMap.nurse ?? [];

    if (nurseControls.length <= 1 || nurseOptions.length <= 1) return params;

    const nextParams = {...params};
    const selectedLabels = new Set<string>();

    nurseControls.forEach((control) => {
        const value = nextParams[control.key];

        if (!value) return;

        const selectedOption = nurseOptions.find((option) => doesSelectOptionMatchValue(option, value));
        const selectedLabel = selectedOption?.label ?? stringifyRuleParamValue(value);

        if (!selectedLabels.has(selectedLabel)) {
            nextParams[control.key] = selectedOption ? getSelectOptionParamValue(selectedOption) : value;
            selectedLabels.add(selectedLabel);

            return;
        }

        const replacement = nurseOptions.find((option) => !selectedLabels.has(option.label));

        if (!replacement) return;

        nextParams[control.key] = getSelectOptionParamValue(replacement);
        selectedLabels.add(replacement.label);
    });

    return nextParams;
}

type TInlineDropdownProps = {
    value: string;
    options: TSelectOption[];
    minWidth?: number;
    onChange: (option: TSelectOption) => void;
};

function InlineDropdown({value, options, minWidth = 72, onChange}: TInlineDropdownProps) {
    const [open, setOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{left: number; top?: number; bottom?: number; minWidth: number} | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const selected = options.find((option) => option.label === value || option.value === value) ?? options[0];
    const alignOptionsLeft = options.some((option) => option.kind === 'nurse');
    const buttonClassName =
        'inline-flex h-8 cursor-pointer items-center justify-between gap-1.5 rounded-[8px] bg-white px-2.5 font-apple text-[14px] font-semibold text-main-1 ring-1 ring-main-4 transition-[box-shadow,background-color] hover:bg-[#FBFAFF] focus-visible:ring-2 focus-visible:ring-main-1/25 focus-visible:outline-none';
    const updateMenuPosition = useCallback(() => {
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();
        const estimatedMenuHeight = Math.min(220, Math.max(44, options.length * 38 + 8));
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const nextOpenUpward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
        const menuMinWidth = Math.max(rect.width, minWidth);
        const viewportPadding = 12;
        const left = Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - menuMinWidth - viewportPadding));

        setOpenUpward(nextOpenUpward);
        setMenuPosition(
            nextOpenUpward
                ? {left, bottom: window.innerHeight - rect.top + 4, minWidth: menuMinWidth}
                : {left, top: rect.bottom + 4, minWidth: menuMinWidth},
        );
    }, [minWidth, options.length]);
    const toggleOpen = () => {
        if (!open) updateMenuPosition();

        setOpen((prev) => !prev);
    };

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (ref.current?.contains(event.target as Node) || menuRef.current?.contains(event.target as Node)) return;

            setOpen(false);
        };

        updateMenuPosition();
        document.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [open, updateMenuPosition]);

    const menuStyle = menuPosition
        ? {
              left: `${menuPosition.left}px`,
              minWidth: `${menuPosition.minWidth}px`,
              ...(openUpward ? {bottom: `${menuPosition.bottom}px`} : {top: `${menuPosition.top}px`}),
          }
        : undefined;

    return (
        <div ref={ref} className="relative inline-flex">
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={toggleOpen}
                className={buttonClassName}
                style={{minWidth}}
            >
                {selected ? <SelectOptionContent option={selected} compact /> : <span className="max-w-[120px] truncate">{value}</span>}
                <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && menuPosition && typeof document !== 'undefined'
                ? createPortal(
                      <div
                          ref={menuRef}
                          role="listbox"
                          style={menuStyle}
                          className={`fixed z-[2147483647] max-h-[220px] animate-in overflow-y-auto rounded-[10px] border border-gray-6 bg-white py-1 shadow-[0px_10px_28px_rgba(95,100,135,0.16)] duration-150 fade-in-0 zoom-in-95 ${
                              openUpward ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1'
                          }`}
                      >
                          {options.map((option) => {
                              const isSelected = option.label === selected?.label;

                              return (
                                  <button
                                      key={option.value}
                                      type="button"
                                      role="option"
                                      aria-selected={isSelected}
                                      className={cn(
                                          'flex w-full cursor-pointer items-center px-3 py-2 font-apple text-[14px] whitespace-nowrap transition-colors hover:bg-gray-7 focus-visible:outline-2 focus-visible:outline-main-1',
                                          alignOptionsLeft ? 'justify-start text-left' : 'justify-center text-center',
                                          isSelected ? 'bg-main-light font-semibold text-main-1' : 'text-sub-1',
                                      )}
                                      onClick={() => {
                                          onChange(option);
                                          setOpen(false);
                                      }}
                                  >
                                      <SelectOptionContent option={option} />
                                  </button>
                              );
                          })}
                      </div>,
                      document.body,
                  )
                : null}
        </div>
    );
}

type TSoftSentenceProps = {
    template: TSoftRuleTemplate;
    params: Record<string, unknown>;
    optionMap: Record<string, TSelectOption[]>;
    onParamChange: (key: string, value: unknown) => void;
};

function SoftSentence({template, params, optionMap, onParamChange}: TSoftSentenceProps) {
    const displayParams = useMemo(() => normalizeSoftRuleParams(template, params, optionMap), [optionMap, params, template]);

    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-7">
            {template.sentence.map((part, idx) => {
                if (part.type === 'text') {
                    return (
                        <span key={`${template.id}-text-${idx}`} className="font-apple text-[14px] font-medium text-sub-1">
                            {part.text}
                        </span>
                    );
                }

                if (part.type === 'duty') {
                    const option = findDutyOptionByCode([...(optionMap.duty ?? []), ...(optionMap.dutyStrict ?? [])], part.code);

                    if (!option) return null;

                    return <DutyTypeBadge key={`${template.id}-duty-${part.code}-${idx}`} option={option} />;
                }

                if (part.type === 'dutyPattern') {
                    const options = part.codes
                        .map((code) => findDutyOptionByCode([...(optionMap.duty ?? []), ...(optionMap.dutyStrict ?? [])], code))
                        .filter((option): option is TSelectOption => Boolean(option));

                    return <DutyPatternBadge key={`${template.id}-pattern-${idx}`} options={options} />;
                }

                if (part.type === 'particle') {
                    const control = template.controls.find((item) => item.key === part.key);
                    const particleValue = getControlDisplayValue(control, template, displayParams, optionMap);

                    return (
                        <span key={`${template.id}-particle-${idx}`} className="font-apple text-[14px] font-medium text-sub-1">
                            {hasFinalConsonant(particleValue) ? part.withBatchim : part.withoutBatchim}
                        </span>
                    );
                }

                const control = template.controls.find((item) => item.key === part.key);

                if (!control) return null;

                if (control.kind === 'number') {
                    const min = control.min ?? 1;
                    const max = control.max ?? min;
                    const values = control.values ?? Array.from({length: max - min + 1}, (_, i) => min + i);
                    const current = Number(getControlDisplayValue(control, template, displayParams, optionMap) || values[0] || min);

                    return (
                        <InlineDropdown
                            key={`${template.id}-${control.key}-${idx}`}
                            value={String(current)}
                            options={values.map((v) => ({value: String(v), label: String(v)}))}
                            minWidth={58}
                            onChange={(nextOption) => onParamChange(control.key, Number(nextOption.value))}
                        />
                    );
                }

                const options = getOptionsForControl(control, template, displayParams, optionMap);
                const selected = getControlDisplayValue(control, template, displayParams, optionMap);

                return (
                    <InlineDropdown
                        key={`${template.id}-${control.key}-${idx}`}
                        value={selected}
                        options={options}
                        minWidth={
                            control.optionsKey === 'date' || control.optionsKey === 'dayType' || control.optionsKey === 'dateScope'
                                ? 104
                                : control.optionsKey === 'target'
                                  ? 104
                                  : 72
                        }
                        onChange={(nextOption) => onParamChange(control.key, getSelectOptionParamValue(nextOption))}
                    />
                );
            })}
        </div>
    );
}

type TSlotControlProps = {
    slot: TShiftConstraintSlot;
    value: unknown;
    options: TShiftConstraintOptions;
    onChange: (value: unknown) => void;
};

function SlotControl({slot, value, options, onChange}: TSlotControlProps) {
    if (slot.inputType === 'NUMBER') {
        const numberValue = typeof value === 'number' ? value : (slot.min ?? 1);
        const values = Array.from({length: (slot.max ?? 10) - (slot.min ?? 1) + 1}, (_, i) => (slot.min ?? 1) + i);

        return (
            <InlineDropdown
                value={String(numberValue)}
                options={values.map((v) => ({value: String(v), label: String(v)}))}
                minWidth={58}
                onChange={(nextOption) => onChange(Number(nextOption.value))}
            />
        );
    }

    if (!slot.optionGroup) return null;

    const optionList = options[slot.optionGroup] ?? [];
    const selected = isConstraintOption(value) ? getValueLabel(value) : '';

    return (
        <InlineDropdown
            value={selected}
            options={optionList.map((option) => ({value: getOptionKey(option), label: getValueLabel(option)}))}
            minWidth={104}
            onChange={(nextOption) => {
                const next = optionList.find((option) => getValueLabel(option) === nextOption.label);

                if (next) onChange(next);
            }}
        />
    );
}

type TRuleRowProps = {
    rule: TShiftConstraintRuleDraft;
    template?: TShiftConstraintTemplate;
    softTemplate?: TSoftRuleTemplate;
    options: TShiftConstraintOptions;
    optionMap: Record<string, TSelectOption[]>;
    highlighted?: boolean;
    isImportant: boolean;
    isRecommended: boolean;
    onDelete: () => void;
    onToggleImportant: (next: boolean) => void;
    onParamChange: (key: string, value: unknown) => void;
    onSoftParamChange: (template: TSoftRuleTemplate, key: string, value: unknown) => void;
};

function ImportantToggle({
    checked,
    isRecommended,
    onChange,
}: {
    checked: boolean;
    isRecommended: boolean;
    onChange: (next: boolean) => void;
}) {
    const {t} = useTypedTranslation();

    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={checked ? t('page.makeShift.constraints.important.ariaRemove') : t('page.makeShift.constraints.important.ariaMark')}
            title={
                isRecommended
                    ? t('page.makeShift.constraints.important.recommendedTitle')
                    : t('page.makeShift.constraints.important.ariaMark')
            }
            onClick={() => onChange(!checked)}
            className={`mr-6 inline-flex h-6 min-w-10 shrink-0 cursor-pointer items-center justify-center rounded-full px-2.5 font-apple text-[12px] font-bold whitespace-nowrap ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-main-1/25 focus-visible:outline-none ${
                checked
                    ? 'bg-[#FFF3D6] text-[#B86E00] ring-[#FFD88A] hover:bg-[#FFE9AE]'
                    : 'bg-white text-gray-4 ring-gray-6 hover:bg-gray-7 hover:text-sub-1'
            }`}
        >
            {t('page.makeShift.constraints.important.label')}
        </button>
    );
}

const RuleRow = memo(function RuleRow({
    rule,
    template,
    softTemplate,
    options,
    optionMap,
    highlighted = false,
    isImportant,
    isRecommended,
    onDelete,
    onToggleImportant,
    onParamChange,
    onSoftParamChange,
}: TRuleRowProps) {
    const {t} = useTypedTranslation();
    const slots = template?.slots ?? [];

    return (
        <div
            className={`grid min-h-[52px] grid-cols-[minmax(0,1fr)_34px] items-center gap-3 rounded-[10px] bg-white px-3 py-2.5 transition-colors ${
                highlighted ? 'shadow-[0_0_0_2px_rgba(127,93,255,0.10)] ring-2 ring-main-1/55' : ''
            }`}
        >
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 pl-2">
                <ImportantToggle checked={isImportant} isRecommended={isRecommended} onChange={onToggleImportant} />
                {softTemplate ? (
                    <SoftSentence
                        template={softTemplate}
                        params={rule.params}
                        optionMap={optionMap}
                        onParamChange={(key, value) => onSoftParamChange(softTemplate, key, value)}
                    />
                ) : (
                    <p className="truncate font-apple text-[15px] font-medium text-sub-1">{getRuleTitle(rule, template)}</p>
                )}
                {!softTemplate && slots.length ? (
                    <div className="flex flex-wrap items-center gap-2">
                        {slots.map((slot) => (
                            <SlotControl
                                key={`${rule.clientId}-${slot.key}`}
                                slot={slot}
                                value={rule.params[slot.key]}
                                options={options}
                                onChange={(next) => onParamChange(slot.key, next)}
                            />
                        ))}
                    </div>
                ) : null}
            </div>

            <div className="flex items-center justify-end">
                <button
                    type="button"
                    onClick={onDelete}
                    className="grid size-7 place-items-center rounded-full text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1"
                    aria-label={t('page.makeShift.constraints.ruleAction.deleteAria')}
                >
                    <X className="size-4" />
                </button>
            </div>
        </div>
    );
});

type TSectionProps = {
    action?: React.ReactNode;
    children: React.ReactNode;
};

function Section({action, children}: TSectionProps) {
    const {t} = useTypedTranslation();

    return (
        <section className="mb-4">
            <div className="rounded-[18px] bg-[#F8F9FB] px-3 pt-5 pb-8">
                <div className="mb-5 flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3">
                    <span className="font-apple text-[13px] font-bold text-gray-4">{t('page.makeShift.constraints.listTitle')}</span>
                    {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
                </div>
                <div className="space-y-2.5">{children}</div>
            </div>
        </section>
    );
}

type TTwoShiftAutomationPanelProps = {
    enabled: boolean;
    rules: TShiftConstraintRuleDraft[];
    onEnabledChange: (enabled: boolean) => void;
    onRuleCountChange: (templateCode: (typeof TWO_SHIFT_CONFIGURATION_CODES)[number], count: number | null) => void;
};

function TwoShiftAutomationPanel({enabled, rules, onEnabledChange, onRuleCountChange}: TTwoShiftAutomationPanelProps) {
    const {t} = useTypedTranslation();
    const settings = [
        {
            templateCode: 'TWO_SHIFT_MAX_LINES' as const,
            label: t('page.makeShift.constraints.twoShift.maxLines'),
            unit: t('page.makeShift.constraints.twoShift.lineUnit'),
            min: 1,
            max: 20,
            fallback: 2,
            optional: false,
        },
        {
            templateCode: 'CORE_MIN_REST_HOURS' as const,
            label: t('page.makeShift.constraints.twoShift.minRestHours'),
            unit: t('page.makeShift.constraints.twoShift.hourUnit'),
            min: 1,
            max: 24,
            fallback: 11,
            optional: true,
        },
        {
            templateCode: 'MAX_MONTHLY_WORK_HOURS' as const,
            label: t('page.makeShift.constraints.twoShift.monthlyWorkHours'),
            unit: t('page.makeShift.constraints.twoShift.hourUnit'),
            min: 1,
            max: 400,
            fallback: 230,
            optional: true,
        },
    ];

    return (
        <section className="mb-4 rounded-[18px] bg-white px-[clamp(14px,1.5vw,22px)] py-5">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="font-apple text-[16px] font-bold text-sub-1">{t('page.makeShift.constraints.twoShift.title')}</p>
                    <p className="mt-1 font-apple text-[13px] leading-5 text-gray-3">
                        {t('page.makeShift.constraints.twoShift.description')}
                    </p>
                </div>
                <Switch
                    checked={enabled}
                    onCheckedChange={onEnabledChange}
                    aria-label={t('page.makeShift.constraints.twoShift.switchAria')}
                    className="shrink-0 data-[state=checked]:bg-main-1"
                />
            </div>
            {enabled ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {settings.map((setting) => {
                        const rule = rules.find((candidate) => candidate.templateCode === setting.templateCode);
                        const rawValue = Number(rule?.params.count ?? setting.fallback);
                        const value = rule && Number.isFinite(rawValue) ? rawValue : setting.optional ? '' : setting.fallback;

                        return (
                            <label key={setting.templateCode} className="rounded-[14px] bg-[#F8F9FB] px-4 py-3">
                                <span className="block min-h-10 font-apple text-[12px] leading-[18px] font-semibold text-gray-3">
                                    {setting.label}
                                </span>
                                <span className="mt-2 flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={setting.min}
                                        max={setting.max}
                                        value={value}
                                        placeholder={String(setting.fallback)}
                                        aria-label={setting.label}
                                        onChange={(event) => {
                                            if (setting.optional && event.target.value === '') {
                                                onRuleCountChange(setting.templateCode, null);

                                                return;
                                            }

                                            const nextValue = Math.min(
                                                setting.max,
                                                Math.max(setting.min, Number(event.target.value) || setting.min),
                                            );

                                            onRuleCountChange(setting.templateCode, nextValue);
                                        }}
                                        className="h-10 min-w-0 flex-1 rounded-[10px] border-0 bg-white px-3 text-right font-poppins text-[15px] font-semibold text-sub-1 ring-1 ring-gray-6 outline-none focus:ring-main-1"
                                    />
                                    <span className="shrink-0 font-apple text-[12px] font-semibold text-gray-3">{setting.unit}</span>
                                </span>
                            </label>
                        );
                    })}
                </div>
            ) : null}
            <p className="mt-3 font-apple text-[12px] leading-5 text-gray-4">{t('page.makeShift.constraints.twoShift.teamOnlyHint')}</p>
        </section>
    );
}

function ConstraintsSkeleton() {
    const {t} = useTypedTranslation();
    const rowWidths = ['w-10/12', 'w-8/12', 'w-9/12', 'w-7/12'];

    return (
        <section
            role="status"
            aria-busy="true"
            aria-label={t('page.makeShift.constraints.state.loading')}
            data-testid="make-shift-constraints-skeleton"
            className="mb-4"
        >
            <div className="rounded-[18px] bg-[#F8F9FB] px-3 pt-5 pb-8">
                <div className="mb-5 flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3">
                    <Skeleton className="h-4 w-24 rounded-full bg-gray-6" />
                    <div className="flex shrink-0 items-center gap-2">
                        <Skeleton className="size-9 rounded-full bg-white" />
                        <Skeleton className="h-9 w-24 rounded-full bg-main-4/70" />
                    </div>
                </div>
                <div className="space-y-2.5">
                    {rowWidths.map((widthClassName, index) => (
                        <div
                            key={index}
                            className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_34px] items-center gap-3 rounded-[10px] bg-white px-3 py-2.5"
                        >
                            <div className="flex min-w-0 items-center gap-3 pl-2">
                                <Skeleton className="h-6 w-10 shrink-0 rounded-full bg-[#FFF3D6]" />
                                <div className="min-w-0 flex-1">
                                    <Skeleton className={cn('h-4 rounded-full bg-gray-6', widthClassName)} />
                                    {index % 2 === 0 ? <Skeleton className="mt-2 h-3 w-5/12 rounded-full bg-gray-6/70" /> : null}
                                </div>
                            </div>
                            <Skeleton className="size-7 rounded-full bg-gray-7" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

type TConstraintImportButtonProps = {
    teams: TShiftTeam[];
    currentShiftTeamId: number | null | undefined;
    importingShiftTeamId: number | null;
    onImport: (shiftTeamId: number) => Promise<void>;
};

function ConstraintImportButton({teams, currentShiftTeamId, importingShiftTeamId, onImport}: TConstraintImportButtonProps) {
    const {t} = useTypedTranslation();
    const [open, setOpen] = useState(false);
    const [selectedShiftTeamId, setSelectedShiftTeamId] = useState<number | null>(null);
    const sourceTeams = useMemo(() => teams.filter((team) => team.shiftTeamId !== currentShiftTeamId), [currentShiftTeamId, teams]);
    const currentTeam = teams.find((team) => team.shiftTeamId === currentShiftTeamId);
    const hasMultipleTeams = teams.length >= 2;
    const disabled = currentShiftTeamId == null || !hasMultipleTeams || sourceTeams.length === 0 || importingShiftTeamId !== null;
    const title = hasMultipleTeams ? t('page.makeShift.constraints.import.title') : t('page.makeShift.constraints.import.disabledTitle');

    useEffect(() => {
        if (!open) return;

        if (selectedShiftTeamId !== null && sourceTeams.some((team) => team.shiftTeamId === selectedShiftTeamId)) return;

        setSelectedShiftTeamId(sourceTeams[0]?.shiftTeamId ?? null);
    }, [open, selectedShiftTeamId, sourceTeams]);

    useEffect(() => {
        if (disabled) {
            setOpen(false);
            setSelectedShiftTeamId(null);
        }
    }, [disabled]);

    const closeModal = () => {
        if (importingShiftTeamId !== null) return;

        setOpen(false);
    };
    const confirmImport = async () => {
        if (selectedShiftTeamId === null || importingShiftTeamId !== null) return;

        await onImport(selectedShiftTeamId);
        setOpen(false);
    };

    return (
        <>
            <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={t('page.makeShift.constraints.import.title')}
                title={title}
                disabled={disabled}
                onClick={() => setOpen(true)}
                className="grid size-9 cursor-pointer place-items-center rounded-full bg-white text-gray-4 transition-colors hover:bg-main-light hover:text-main-1 focus-visible:outline-2 focus-visible:outline-main-1 disabled:cursor-not-allowed disabled:bg-white disabled:opacity-40 disabled:hover:bg-white"
            >
                <img src={CONSTRAINT_IMPORT_ICON_SRC} alt="" aria-hidden="true" className="size-[15.2px] object-contain" />
            </button>

            {open ? (
                <ConstraintModalPortal>
                    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/30 px-4">
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="constraint-import-title"
                            className="w-full max-w-[400px] rounded-[16px] bg-white p-5"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p id="constraint-import-title" className="font-apple text-[20px] font-bold text-sub-1">
                                        {t('page.makeShift.constraints.import.modalTitle')}
                                    </p>
                                    <p className="mt-1 truncate font-apple text-[13px] text-gray-4">
                                        {t('page.makeShift.constraints.import.currentTeam', {
                                            teamName: currentTeam?.name ?? t('page.makeShift.constraints.import.selectedTeamFallback'),
                                        })}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1"
                                    aria-label={t('page.makeShift.constraints.modal.close')}
                                >
                                    <X className="size-5" />
                                </button>
                            </div>

                            <div className="mt-5">
                                <p className="mb-2 font-apple text-[12px] font-bold text-gray-4">
                                    {t('page.makeShift.constraints.import.teamLabel')}
                                </p>
                                <div className="space-y-1.5">
                                    {sourceTeams.map((team) => {
                                        const selected = team.shiftTeamId === selectedShiftTeamId;

                                        return (
                                            <button
                                                key={team.shiftTeamId}
                                                type="button"
                                                className={`flex h-10 w-full cursor-pointer items-center justify-between rounded-[9px] px-3 text-left font-apple transition-colors focus-visible:outline-2 focus-visible:outline-main-1 ${
                                                    selected
                                                        ? 'bg-[#F3F4F6] text-main-1'
                                                        : 'bg-[#F3F4F6] text-sub-2 hover:bg-[#EEF0F4] hover:text-sub-1'
                                                }`}
                                                onClick={() => setSelectedShiftTeamId(team.shiftTeamId)}
                                            >
                                                <span className="truncate text-[14px] font-semibold">{team.name}</span>
                                                {selected ? <span className="ml-3 size-1.5 shrink-0 rounded-full bg-main-1" /> : null}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="mt-5 flex gap-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="h-11 flex-1 cursor-pointer rounded-[10px] bg-[#F3F4F6] px-6 font-apple text-[15px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                                >
                                    {t('page.makeShift.constraints.import.cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void confirmImport()}
                                    disabled={selectedShiftTeamId === null || importingShiftTeamId !== null}
                                    className="h-11 flex-1 cursor-pointer rounded-[10px] bg-main-1 px-6 font-apple text-[15px] font-semibold text-white transition-colors hover:bg-[#5948F5] disabled:cursor-not-allowed disabled:bg-gray-5"
                                >
                                    {importingShiftTeamId !== null
                                        ? t('page.makeShift.constraints.import.loading')
                                        : t('page.makeShift.constraints.import.confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
                </ConstraintModalPortal>
            ) : null}
        </>
    );
}

type TConstraintsProps = {
    wardId?: number | null;
    shiftTeamId?: number | null;
    shiftTeams?: TShiftTeam[];
    year?: number;
    month?: number;
    variant?: 'flow' | 'settings';
};

type TSoftModalProps = {
    open: boolean;
    templates: TSoftRuleTemplate[];
    optionMap: Record<string, TSelectOption[]>;
    onClose: () => void;
    onAdd: (template: TSoftRuleTemplate, params: Record<string, unknown>) => void;
};

function SoftRuleModal({open, templates, optionMap, onClose, onAdd}: TSoftModalProps) {
    const {t} = useTypedTranslation();
    const recommendedTemplates = useMemo(() => templates.filter((template) => template.isRecommended), [templates]);
    const categories = useMemo<TModalCategory[]>(() => {
        const normalCategories = Array.from(
            new Set(templates.map((template) => template.category).filter((category) => !isRecommendedOnlyCategory(category))),
        );

        return recommendedTemplates.length ? [RECOMMENDED_MODAL_CATEGORY, ...normalCategories] : normalCategories;
    }, [recommendedTemplates.length, templates]);
    const [selectedCategory, setSelectedCategory] = useState<TModalCategory>(RECOMMENDED_MODAL_CATEGORY);
    const [draftParams, setDraftParams] = useState<Record<string, Record<string, unknown>>>({});

    useEffect(() => {
        if (!open) return;

        const next: Record<string, Record<string, unknown>> = {};

        templates.forEach((template) => {
            const params = getDefaultParams(template, optionMap);

            next[template.id] = normalizeCombinationParams(template, params, optionMap);
        });
        setDraftParams(next);
        setSelectedCategory(categories[0] ?? 'STAFFING');
    }, [categories, open, optionMap, templates]);

    if (!open) return null;

    const visibleTemplates = templates.filter((template) =>
        selectedCategory === RECOMMENDED_MODAL_CATEGORY ? template.isRecommended : template.category === selectedCategory,
    );

    return (
        <ConstraintModalPortal>
            <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/30 px-4">
                <div className="flex min-h-[640px] w-full max-w-[820px] flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)]">
                    <div className="flex items-start justify-between px-6 pt-6 pb-4">
                        <div>
                            <p className="font-apple text-[28px] font-bold text-sub-1">{t('page.makeShift.constraints.modal.title')}</p>
                            <p className="mt-1 font-apple text-[13px] font-medium text-gray-4">
                                {t('page.makeShift.constraints.modal.description')}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="grid size-8 cursor-pointer place-items-center rounded-full text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1"
                            aria-label={t('page.makeShift.constraints.modal.close')}
                        >
                            <X className="size-5" />
                        </button>
                    </div>

                    <div className="mx-6 flex flex-wrap gap-2 border-b border-gray-6 pb-3">
                        {categories.map((category) => (
                            <button
                                key={category}
                                type="button"
                                onClick={() => setSelectedCategory(category)}
                                className={`h-8 shrink-0 rounded-full px-3 font-apple text-[13px] font-semibold transition-colors ${
                                    selectedCategory === category
                                        ? 'bg-main-light text-main-1'
                                        : 'bg-gray-7 text-gray-4 hover:bg-gray-6/60 hover:text-sub-1'
                                }`}
                            >
                                {getCategoryLabel(t, category)}
                            </button>
                        ))}
                    </div>

                    <div className="mt-4 min-h-[430px] flex-1 space-y-2 overflow-y-auto px-6 pb-6">
                        {visibleTemplates.map((template) => {
                            const templateParams = draftParams[template.id] ?? {};

                            return (
                                <div
                                    key={template.id}
                                    className="flex items-center gap-3 rounded-[12px] bg-gray-7 px-4 py-3 transition-colors hover:bg-gray-6/70"
                                >
                                    <div className="min-w-0 flex-1">
                                        <SoftSentence
                                            template={template}
                                            params={templateParams}
                                            optionMap={optionMap}
                                            onParamChange={(key, value) =>
                                                setDraftParams((prev) => ({
                                                    ...prev,
                                                    [template.id]: normalizeCombinationParams(
                                                        template,
                                                        {...(prev[template.id] ?? {}), [key]: value},
                                                        optionMap,
                                                    ),
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => onAdd(template, templateParams)}
                                            className="grid size-8 cursor-pointer place-items-center rounded-full bg-main-1 text-white transition-colors hover:bg-main-1-hover focus-visible:ring-2 focus-visible:ring-main-1/25 focus-visible:outline-none"
                                            aria-label={t('page.makeShift.constraints.modal.addAria')}
                                            title={t('page.makeShift.constraints.modal.addTitle')}
                                        >
                                            <Plus className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </ConstraintModalPortal>
    );
}

type TRecommendedRuleWarning = {
    rule: TShiftConstraintRuleDraft;
    action: 'unmark' | 'delete';
};

type TRecommendedRuleWarningModalProps = {
    warning: TRecommendedRuleWarning | null;
    onClose: () => void;
    onConfirm: () => void;
};

function RecommendedRuleWarningModal({warning, onClose, onConfirm}: TRecommendedRuleWarningModalProps) {
    const {t} = useTypedTranslation();

    if (!warning) return null;

    const isDelete = warning.action === 'delete';

    return (
        <ConstraintModalPortal>
            <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/30 px-4">
                <div className="w-full max-w-[420px] rounded-[18px] bg-white p-5 shadow-[0_24px_56px_rgba(15,23,42,0.22)]">
                    <p className="font-apple text-[20px] font-bold text-sub-1">
                        {isDelete
                            ? t('page.makeShift.constraints.warning.deleteTitle')
                            : t('page.makeShift.constraints.warning.unmarkTitle')}
                    </p>
                    <p className="mt-2 font-apple text-[14px] leading-6 text-gray-4">
                        {t('page.makeShift.constraints.warning.description')}{' '}
                        {isDelete
                            ? t('page.makeShift.constraints.warning.deleteDescription')
                            : t('page.makeShift.constraints.warning.unmarkDescription')}
                    </p>
                    <div className="mt-5 flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-11 flex-1 cursor-pointer rounded-[10px] bg-[#F3F4F6] px-6 font-apple text-[16px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                        >
                            {t('page.makeShift.constraints.warning.keep')}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            className="h-11 flex-1 cursor-pointer rounded-[10px] bg-[#D14343] px-6 font-apple text-[16px] font-semibold text-white transition-colors hover:bg-[#BD3434]"
                        >
                            {isDelete
                                ? t('page.makeShift.constraints.warning.deleteConfirm')
                                : t('page.makeShift.constraints.warning.unmarkConfirm')}
                        </button>
                    </div>
                </div>
            </div>
        </ConstraintModalPortal>
    );
}

export function Constraints({
    wardId: wardIdProp,
    shiftTeamId,
    shiftTeams: shiftTeamsProp,
    year: yearProp,
    month: monthProp,
    variant = 'flow',
}: TConstraintsProps = {}) {
    const {t} = useTypedTranslation();
    const {i18n} = useTranslation();
    const queryClient = useQueryClient();
    const authWardId = useAuthStore((s) => s.wardId);
    const storeWardId = useMakeShiftStore((s) => s.wardId);
    const storeShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const storeShiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const storeShiftTeamsStatus = useMakeShiftStore((s) => s.shiftTeamsStatus);
    const storeYear = useMakeShiftStore((s) => s.year);
    const storeMonth = useMakeShiftStore((s) => s.month);
    const wardId = wardIdProp ?? authWardId;
    const currentShiftTeamId = shiftTeamId ?? storeShiftTeamId;
    const availableShiftTeams = shiftTeamsProp ?? storeShiftTeams;
    const year = yearProp ?? storeYear;
    const month = monthProp ?? storeMonth;
    const hasExplicitWardTeam = wardIdProp != null && shiftTeamId != null;
    const hasWardTeam = wardId !== null && wardId !== undefined && currentShiftTeamId !== null && currentShiftTeamId !== undefined;
    const enabled =
        hasWardTeam &&
        (hasExplicitWardTeam ||
            isMakeShiftTeamReadyForWard(
                {wardId: storeWardId, shiftTeams: storeShiftTeams, shiftTeamsStatus: storeShiftTeamsStatus},
                wardId,
                currentShiftTeamId,
            ));
    const frameClassName = variant === 'settings' ? 'flex min-w-0 flex-col' : 'flex min-w-0 flex-col items-end';
    const surfaceWidthClassName =
        variant === 'settings'
            ? 'w-full'
            : 'w-full min-w-[720px] max-w-[920px] min-[1400px]:min-w-[740px] min-[1400px]:max-w-[1000px] min-[1600px]:min-w-[920px] min-[1600px]:max-w-[1088px]';
    const surfacePaddingYClassName = variant === 'settings' ? 'py-[clamp(10px,1.1vw,16px)]' : 'py-0';
    const [rules, setRules] = useState<TShiftConstraintRuleDraft[]>([]);
    const rulesRef = useRef<TShiftConstraintRuleDraft[]>([]);
    const [softModalOpen, setSoftModalOpen] = useState(false);
    const [highlightedRuleId, setHighlightedRuleId] = useState<string | null>(null);
    const [recommendedWarning, setRecommendedWarning] = useState<TRecommendedRuleWarning | null>(null);
    const [importingShiftTeamId, setImportingShiftTeamId] = useState<number | null>(null);
    const saveRulesRequestSeqRef = useRef(0);
    const languageQueryKey = i18n.resolvedLanguage ?? i18n.language ?? 'default';
    const rulesQueryKey = shiftConstraintRuleQueryKeys.rules(wardId ?? -1, currentShiftTeamId ?? -1, languageQueryKey);
    const candidatesQuery = useQuery({
        queryKey: shiftConstraintRuleQueryKeys.candidates(wardId ?? -1, currentShiftTeamId ?? -1, languageQueryKey),
        queryFn: () => getShiftConstraintRuleCandidates(wardId ?? -1, currentShiftTeamId ?? -1),
        enabled,
        retry: false,
        refetchOnWindowFocus: false,
    });
    const rulesQuery = useQuery({
        queryKey: rulesQueryKey,
        queryFn: () => getShiftConstraintRules(wardId ?? -1, currentShiftTeamId ?? -1),
        enabled,
        refetchOnWindowFocus: false,
    });
    const nurseQuery = useQuery({
        ...wardQueryOptions.shiftTeamNurses(wardId ?? -1, currentShiftTeamId ?? -1),
        enabled,
    });
    const shiftTypeQuery = useQuery({
        ...wardQueryOptions.shiftTypes(wardId ?? -1),
        enabled: wardId !== null && wardId !== undefined,
    });
    const templates = candidatesQuery.data?.templates ?? [];
    const softTemplates = useMemo(
        () => createSoftRuleTemplates(templates, t).filter((template) => !isSkillConstraintTemplate(template)),
        [t, templates],
    );
    const templateByCode = useMemo(() => new Map(templates.map((template) => [template.templateCode, template] as const)), [templates]);
    const softTemplateByCode = useMemo(() => new Map(softTemplates.map((template) => [template.id, template] as const)), [softTemplates]);
    const options = candidatesQuery.data?.options ?? EMPTY_SHIFT_CONSTRAINT_OPTIONS;
    const nurses: TNurseLike[] = Array.isArray(nurseQuery.data) ? nurseQuery.data : EMPTY_NURSES;
    const shiftTypes = normalizeShiftTypes(shiftTypeQuery.data);
    const supportsTwoShift =
        shiftTypes.some((shiftType) => shiftType.rotationSystem === 'TWO' && shiftType.classification === 'DAY') &&
        shiftTypes.some((shiftType) => shiftType.rotationSystem === 'TWO' && shiftType.classification === 'NIGHT');
    const addableSoftTemplates = useMemo(
        () =>
            softTemplates.filter(
                (template) =>
                    !isHiddenAddModalTemplate(template.id) &&
                    !isSkillConstraintTemplate(template) &&
                    (supportsTwoShift || !TWO_SHIFT_CONFIGURATION_CODE_SET.has(template.id)),
            ),
        [softTemplates, supportsTwoShift],
    );
    const optionMap = useMemo(() => {
        const dutyOptions = uniqueByValue([
            {value: 'ALL_DUTY', label: t('page.makeShift.constraints.option.all'), raw: {type: 'ALL'}},
            ...shiftTypes
                .filter((shiftType) => shiftType.wardShiftTypeId != null && (shiftType.shortName ?? shiftType.name))
                .map((shiftType) => ({
                    value: String(shiftType.wardShiftTypeId),
                    label: `${shiftType.shortName ?? shiftType.name} ${shiftType.name ?? shiftType.shortName ?? ''}`.trim(),
                    kind: 'duty' as const,
                    shortName: shiftType.shortName ?? shiftType.name,
                    name: shiftType.name,
                    color: shiftType.color,
                    raw: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: shiftType.wardShiftTypeId},
                    classification: shiftType.classification,
                    isOff: shiftType.isOff,
                })),
        ]);
        const dateOptions = Array.from({length: daysInMonth(year, month)}, (_, idx) => ({
            value: String(idx + 1),
            label: t('page.makeShift.constraints.option.dayLabel', {day: idx + 1}),
            raw: {type: 'DAY_OF_MONTH', day: idx + 1},
        }));
        const dateScopeOptions = [
            {value: 'EVERYDAY', label: t('page.makeShift.constraints.option.everyday'), raw: {type: 'EVERYDAY'}},
            {value: 'WEEKDAY', label: t('page.makeShift.constraints.option.weekday'), raw: {type: 'WEEKDAY'}},
            {
                value: 'WEEKEND_OR_HOLIDAY',
                label: t('page.makeShift.constraints.option.weekendOrHoliday'),
                raw: {type: 'WEEKEND_OR_HOLIDAY'},
            },
            ...Array.from({length: daysInMonth(year, month)}, (_, idx) => ({
                value: `DAY_OF_MONTH-${idx + 1}`,
                label: t('page.makeShift.constraints.option.monthlyDayLabel', {day: idx + 1}),
                raw: {type: 'DAY_OF_MONTH', day: idx + 1},
            })),
        ];
        const staffCountOperatorOptions = [
            {value: 'MIN', label: t('page.makeShift.constraints.option.staffCountOperator.min'), raw: {type: 'MIN'}},
            {value: 'MAX', label: t('page.makeShift.constraints.option.staffCountOperator.max'), raw: {type: 'MAX'}},
            {value: 'EXACT', label: t('page.makeShift.constraints.option.staffCountOperator.exact'), raw: {type: 'EXACT'}},
        ];
        const toNurseOption = (nurse: TNurseLike): TSelectOption => ({
            value: String(nurse.nurseId),
            label: String(nurse.name),
            kind: 'nurse',
            isPreceptor: hasPreceptorRole(nurse),
            isPreceptee: hasPrecepteeRole(nurse),
            raw: {
                type: 'NURSE',
                nurseId: nurse.nurseId,
                isPreceptor: hasPreceptorRole(nurse),
                isPreceptee: hasPrecepteeRole(nurse),
            },
        });
        const nurseOptions = nurses.filter((nurse) => nurse.nurseId != null && nurse.name).map(toNurseOption);
        const preceptorOptions = nurses
            .filter((nurse) => nurse.nurseId != null && nurse.name && hasPreceptorRole(nurse))
            .map(toNurseOption);
        const precepteeOptions = nurses
            .filter((nurse) => nurse.nurseId != null && nurse.name && hasPrecepteeRole(nurse))
            .map(toNurseOption);
        const fallbackOptionMap = {
            target: [
                {value: 'ALL', label: t('page.makeShift.constraints.option.allPeople'), raw: ALL_CONSTRAINT_TARGET_OPTION},
                ...nurseOptions,
            ],
            duty: dutyOptions,
            date: dateOptions,
            dayType: [],
            dateScope: dateScopeOptions,
            staffCountOperator: staffCountOperatorOptions,
            nurse: nurseOptions,
            preceptor: preceptorOptions,
            preceptee: precepteeOptions,
            dutyStrict: dutyOptions.filter((option) => option.value !== 'ALL_DUTY'),
        } as Record<string, TSelectOption[]>;

        return {
            ...mergeCandidateOptionMap(options, fallbackOptionMap, shiftTypes, t),
        };
    }, [nurses, options, shiftTypes, t, year, month]);
    const {mutate: mutateSaveRules} = useMutation({
        mutationKey: shiftConstraintRuleQueryKeys.save(wardId, currentShiftTeamId),
        mutationFn: ({rules}: {rules: TShiftConstraintRuleDraft[]; requestId: number}) => {
            if (!enabled || wardId == null || currentShiftTeamId == null) {
                throw new Error('Cannot save shift constraint rules without a ward and shift team.');
            }

            return putShiftConstraintRules(wardId, currentShiftTeamId, {
                rules: rules.map((rule, index) => toSavedRule(rule, index, softTemplateByCode.get(rule.templateCode))),
            });
        },
        onMutate: async ({rules}) => {
            if (!enabled || wardId == null || currentShiftTeamId == null) return {previousRules: undefined};

            await queryClient.cancelQueries({queryKey: rulesQueryKey});

            const previousRules = queryClient.getQueryData<TShiftConstraintRulesResponse>(rulesQueryKey);

            queryClient.setQueryData(rulesQueryKey, toRulesQueryData(wardId, currentShiftTeamId, rules, previousRules));

            return {previousRules};
        },
        onSuccess: (response, variables) => {
            if (variables.requestId !== saveRulesRequestSeqRef.current) return;

            queryClient.setQueryData(rulesQueryKey, response);

            const savedRules = createRulesFromServer(response.rules).filter(isVisibleConstraintRule);

            rulesRef.current = savedRules;
            setRules(savedRules);

            if (wardId != null && currentShiftTeamId != null) {
                void queryClient.invalidateQueries({
                    queryKey: ['ward', wardId, 'shift-team', currentShiftTeamId, 'schedule-workspace'],
                });
            }
        },
        onError: (_error, variables, context) => {
            if (variables.requestId !== saveRulesRequestSeqRef.current) return;

            if (context?.previousRules) {
                queryClient.setQueryData(rulesQueryKey, context.previousRules);

                const previousRules = createRulesFromServer(context.previousRules.rules).filter(isVisibleConstraintRule);

                rulesRef.current = previousRules;
                setRules(previousRules);
            } else {
                void queryClient.invalidateQueries({queryKey: rulesQueryKey});
                rulesRef.current = [];
                setRules([]);
            }

            toast.error(t('page.makeShift.constraints.toast.saveFailed'));
        },
    });
    const persistRules = useCallback(
        (nextRules: TShiftConstraintRuleDraft[]) => {
            if (!enabled || wardId == null || currentShiftTeamId == null) return;

            const requestId = saveRulesRequestSeqRef.current + 1;

            saveRulesRequestSeqRef.current = requestId;
            mutateSaveRules({rules: nextRules, requestId});
        },
        [currentShiftTeamId, enabled, mutateSaveRules, wardId],
    );
    const replaceRules = useCallback(
        (nextRules: TShiftConstraintRuleDraft[], options: {sync?: boolean} = {}) => {
            const normalizedRules = nextRules.filter(isVisibleConstraintRule).map((rule, index) => ({...rule, sortOrder: index + 1}));

            rulesRef.current = normalizedRules;
            setRules(normalizedRules);

            if (options.sync !== false) {
                persistRules(normalizedRules);
            }
        },
        [persistRules],
    );
    const updateRules = useCallback(
        (updater: TRulesUpdate) => {
            replaceRules(updater(rulesRef.current));
        },
        [replaceRules],
    );
    const upsertTwoShiftConfigurationRule = (
        templateCode: (typeof TWO_SHIFT_CONFIGURATION_CODES)[number],
        overrides: Record<string, unknown> = {},
    ) => {
        updateRules((prev) => {
            const existing = prev.find((rule) => rule.templateCode === templateCode);
            const template = softTemplateByCode.get(templateCode);
            const nextRule = {
                clientId: existing?.clientId ?? createClientId({templateCode}),
                shiftConstraintRuleId: existing?.shiftConstraintRuleId,
                templateCode,
                category: template?.category ?? 'TWO_SHIFT',
                severity: 'HARD' as const,
                sortOrder: existing?.sortOrder ?? prev.length + 1,
                params: {
                    ...(DEFAULT_PARAMS_BY_TEMPLATE_CODE[templateCode] ?? {}),
                    ...(existing?.params ?? {}),
                    ...overrides,
                },
                selected: true,
                isImportant: true,
                displayText: existing?.displayText,
                isValid: true,
                invalidReason: null,
            } satisfies TShiftConstraintRuleDraft;

            return existing ? prev.map((rule) => (rule.clientId === existing.clientId ? nextRule : rule)) : [...prev, nextRule];
        });
    };
    const setTwoShiftAutomationEnabled = (nextEnabled: boolean) => {
        if (!supportsTwoShift) return;

        if (nextEnabled) {
            upsertTwoShiftConfigurationRule('TWO_SHIFT_MAX_LINES');

            return;
        }

        updateRules((prev) => prev.filter((rule) => !TWO_SHIFT_CONFIGURATION_CODE_SET.has(rule.templateCode)));
    };
    const updateTwoShiftRuleCount = (templateCode: (typeof TWO_SHIFT_CONFIGURATION_CODES)[number], count: number | null) => {
        if (count == null && templateCode !== 'TWO_SHIFT_MAX_LINES') {
            updateRules((prev) => prev.filter((rule) => rule.templateCode !== templateCode));

            return;
        }

        upsertTwoShiftConfigurationRule(templateCode, {count});
    };

    useEffect(() => {
        if (!rulesQuery.data || candidatesQuery.isPending) return;

        replaceRules(createRulesFromServer(rulesQuery.data.rules), {sync: false});
    }, [candidatesQuery.isPending, replaceRules, rulesQuery.data]);

    useEffect(() => {
        rulesRef.current = rules;
    }, [rules]);

    const optimizeDuplicateRules = useCallback(() => {
        const result = compactDuplicateRules(rulesRef.current);

        if (!result.removedCount) return 0;

        replaceRules(result.rules);
        setHighlightedRuleId(null);
        toast.success(t('page.makeShift.constraints.toast.duplicatesRemoved', {count: result.removedCount}));

        return result.removedCount;
    }, [replaceRules, t]);

    useEffect(() => {
        if (variant !== 'flow') return;

        const handleOptimize = () => {
            optimizeDuplicateRules();
        };

        window.addEventListener(MAKE_SHIFT_CONSTRAINTS_OPTIMIZE_EVENT, handleOptimize);

        return () => window.removeEventListener(MAKE_SHIFT_CONSTRAINTS_OPTIMIZE_EVENT, handleOptimize);
    }, [optimizeDuplicateRules, variant]);

    const twoShiftAutomationEnabled = rules.some(
        (rule) => rule.templateCode === 'TWO_SHIFT_MAX_LINES' && rule.selected !== false && Number(rule.params.count ?? 0) > 0,
    );
    const softRules = rules.filter(
        (rule) =>
            (rule.severity === 'SOFT' || rule.severity === 'HARD') &&
            rule.selected !== false &&
            isVisibleConstraintRule(rule) &&
            !TWO_SHIFT_CONFIGURATION_CODE_SET.has(rule.templateCode),
    );
    const isLoading = candidatesQuery.isPending || rulesQuery.isPending || shiftTypeQuery.isPending;
    const isLoadError = rulesQuery.isError;
    const softRuleViewModels = useMemo(
        () =>
            softRules.map((rule) => ({
                rule,
                template: templateByCode.get(rule.templateCode),
                softTemplate: softTemplateByCode.get(rule.templateCode),
                highlighted: highlightedRuleId === rule.clientId,
                isImportant: rule.severity === 'HARD',
                isRecommended: isRecommendedTemplateCode(rule.templateCode, rule.category),
            })),
        [highlightedRuleId, softRules, softTemplateByCode, templateByCode],
    );
    const addSoftRule = (template: TSoftRuleTemplate, params: Record<string, unknown>) => {
        const normalizedParams = normalizeNumberParams(template, normalizeCombinationParams(template, params, optionMap));

        if (TWO_SHIFT_CONFIGURATION_CODE_SET.has(template.id)) {
            if (!supportsTwoShift) return;

            upsertTwoShiftConfigurationRule(template.id as (typeof TWO_SHIFT_CONFIGURATION_CODES)[number], normalizedParams);
            setSoftModalOpen(false);
            toast.success(t('page.makeShift.constraints.toast.added'));

            return;
        }

        const displayParams = normalizeSoftRuleParams(template, normalizedParams, optionMap);
        const isRecommended = Boolean(template.isRecommended);
        const nextRule: TShiftConstraintRuleDraft = {
            clientId: createClientId({templateCode: template.id}),
            templateCode: template.id,
            category: template.category,
            severity: isRecommended ? 'HARD' : 'SOFT',
            sortOrder: softRules.length + 1,
            params: normalizedParams,
            selected: true,
            isImportant: isRecommended,
            displayText: template.buildText(displayParams),
            isValid: true,
            invalidReason: null,
        };
        const duplicateRule = rulesRef.current
            .filter((rule) => rule.selected !== false)
            .find((rule) => getConstraintDuplicateKey(rule) === getConstraintDuplicateKey(nextRule));

        if (duplicateRule) {
            setHighlightedRuleId(duplicateRule.clientId);
            setSoftModalOpen(false);
            toast.success(t('page.makeShift.constraints.toast.duplicateSkipped'));

            window.setTimeout(() => {
                setHighlightedRuleId((current) => (current === duplicateRule.clientId ? null : current));
            }, 1800);

            return;
        }

        updateRules((prev) => {
            const selected = prev.filter((r) => r.selected !== false);
            const hidden = prev.filter((r) => r.selected === false && r.templateCode !== nextRule.templateCode);
            const nextSelected = [...selected, nextRule].map((r, idx) => ({...r, sortOrder: idx + 1}));

            return [...nextSelected, ...hidden];
        });
        setHighlightedRuleId(nextRule.clientId);
        setSoftModalOpen(false);
        toast.success(t('page.makeShift.constraints.toast.added'));

        window.setTimeout(() => {
            setHighlightedRuleId((current) => (current === nextRule.clientId ? null : current));
        }, 1800);
    };
    const importRulesFromTeam = useCallback(
        async (sourceShiftTeamId: number) => {
            if (!enabled || !wardId || currentShiftTeamId == null || importingShiftTeamId !== null) return;

            const sourceTeam = availableShiftTeams.find((team) => team.shiftTeamId === sourceShiftTeamId);

            try {
                setImportingShiftTeamId(sourceShiftTeamId);

                const response = await queryClient.fetchQuery({
                    queryKey: shiftConstraintRuleQueryKeys.rules(wardId, sourceShiftTeamId),
                    queryFn: () => getShiftConstraintRules(wardId, sourceShiftTeamId),
                });
                const next = createRulesFromServer(response.rules)
                    .filter(isVisibleConstraintRule)
                    .filter((rule) => supportsTwoShift || !TWO_SHIFT_CONFIGURATION_CODE_SET.has(rule.templateCode))
                    .map((rule, index) => ({
                        ...rule,
                        shiftConstraintRuleId: undefined,
                        clientId: createClientId({templateCode: rule.templateCode}),
                        sortOrder: index + 1,
                    }));

                replaceRules(next);
                setHighlightedRuleId(null);
                toast.success(
                    t('page.makeShift.constraints.toast.imported', {
                        teamName: sourceTeam?.name ?? t('page.makeShift.constraints.import.sourceTeamFallback'),
                    }),
                );
            } catch {
                toast.error(t('page.makeShift.constraints.toast.importFailed'));
            } finally {
                setImportingShiftTeamId(null);
            }
        },
        [availableShiftTeams, currentShiftTeamId, enabled, importingShiftTeamId, queryClient, replaceRules, supportsTwoShift, t, wardId],
    );
    const updateRuleParam = useCallback(
        (clientId: string, key: string, value: unknown) => {
            updateRules((prev) =>
                prev.map((item) => (item.clientId === clientId ? {...item, params: {...item.params, [key]: value}} : item)),
            );
        },
        [updateRules],
    );
    const updateSoftRuleParamByClientId = useCallback(
        (clientId: string, template: TSoftRuleTemplate, key: string, value: unknown) => {
            updateRules((prev) =>
                prev.map((item) => {
                    if (item.clientId !== clientId) return item;

                    const nextParams = normalizeCombinationParams(template, {...item.params, [key]: value}, optionMap);
                    const displayParams = normalizeSoftRuleParams(template, nextParams, optionMap);

                    return {
                        ...item,
                        params: nextParams,
                        displayText: template.buildText(displayParams),
                    };
                }),
            );
        },
        [optionMap, updateRules],
    );
    const setRuleImportant = useCallback(
        (clientId: string, isImportant: boolean) => {
            updateRules((prev) =>
                prev.map((item) => (item.clientId === clientId ? {...item, severity: isImportant ? 'HARD' : 'SOFT', isImportant} : item)),
            );
        },
        [updateRules],
    );
    const toggleRuleImportant = useCallback(
        (rule: TShiftConstraintRuleDraft, nextImportant: boolean) => {
            if (!nextImportant && isRecommendedDefaultRuleCode(rule.templateCode)) {
                setRecommendedWarning({rule, action: 'unmark'});

                return;
            }

            setRuleImportant(rule.clientId, nextImportant);
        },
        [setRuleImportant],
    );
    const removeRule = useCallback(
        (rule: TShiftConstraintRuleDraft) => {
            if (isRecommendedDefaultRuleCode(rule.templateCode)) {
                setRecommendedWarning({rule, action: 'delete'});

                return;
            }

            updateRules((prev) => prev.filter((item) => item.clientId !== rule.clientId));
        },
        [updateRules],
    );
    const confirmRecommendedWarning = () => {
        if (!recommendedWarning) return;

        if (recommendedWarning.action === 'delete') {
            updateRules((prev) => prev.filter((item) => item.clientId !== recommendedWarning.rule.clientId));
            toast.success(t('page.makeShift.constraints.toast.recommendedDeleted'));
        } else {
            setRuleImportant(recommendedWarning.rule.clientId, false);
            toast.success(t('page.makeShift.constraints.toast.importantUnmarked'));
        }

        setRecommendedWarning(null);
    };

    if (!enabled) {
        return (
            <div className={frameClassName}>
                <div className={`${surfaceWidthClassName} rounded-[18px] bg-white px-5 py-5 font-apple text-[14px] text-gray-4`}>
                    {t('page.makeShift.constraints.state.teamRequired')}
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={frameClassName}>
                <div
                    className={`${surfaceWidthClassName} min-w-0 rounded-[18px] bg-white px-[clamp(14px,1.5vw,22px)] ${surfacePaddingYClassName}`}
                >
                    <ConstraintsSkeleton />
                </div>
            </div>
        );
    }

    if (isLoadError) {
        return (
            <div className={frameClassName}>
                <div className={`${surfaceWidthClassName} rounded-[18px] bg-white px-5 py-5 font-apple text-[14px] text-gray-4`}>
                    {t('page.makeShift.constraints.state.loadError')}
                </div>
            </div>
        );
    }

    return (
        <>
            <div className={frameClassName}>
                <div
                    className={`${surfaceWidthClassName} min-w-0 rounded-[18px] bg-white px-[clamp(14px,1.5vw,22px)] ${surfacePaddingYClassName}`}
                >
                    {supportsTwoShift ? (
                        <TwoShiftAutomationPanel
                            enabled={twoShiftAutomationEnabled}
                            rules={rules}
                            onEnabledChange={setTwoShiftAutomationEnabled}
                            onRuleCountChange={updateTwoShiftRuleCount}
                        />
                    ) : null}
                    <Section
                        action={
                            <>
                                <ConstraintImportButton
                                    teams={availableShiftTeams}
                                    currentShiftTeamId={currentShiftTeamId}
                                    importingShiftTeamId={importingShiftTeamId}
                                    onImport={importRulesFromTeam}
                                />
                                <button
                                    id="make_constraint_add_button"
                                    type="button"
                                    onClick={() => setSoftModalOpen(true)}
                                    className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-[#6C5CFF] px-4 font-apple text-[13px] font-bold text-white transition-colors hover:bg-[#5948F5] focus-visible:ring-2 focus-visible:ring-main-1/25 focus-visible:outline-none"
                                >
                                    <Plus className="size-4" />
                                    {t('page.makeShift.constraints.action.add')}
                                </button>
                            </>
                        }
                    >
                        <div className="space-y-2.5">
                            {softRuleViewModels.length ? (
                                softRuleViewModels.map(({rule, template, softTemplate, highlighted, isImportant, isRecommended}) => (
                                    <RuleRow
                                        key={rule.clientId}
                                        rule={rule}
                                        template={template}
                                        softTemplate={softTemplate}
                                        options={options}
                                        optionMap={optionMap}
                                        highlighted={highlighted}
                                        isImportant={isImportant}
                                        isRecommended={isRecommended}
                                        onDelete={() => removeRule(rule)}
                                        onToggleImportant={(nextImportant) => toggleRuleImportant(rule, nextImportant)}
                                        onParamChange={(key, value) => updateRuleParam(rule.clientId, key, value)}
                                        onSoftParamChange={(softTemplate, key, value) =>
                                            updateSoftRuleParamByClientId(rule.clientId, softTemplate, key, value)
                                        }
                                    />
                                ))
                            ) : (
                                <div className="rounded-[10px] bg-white px-4 py-5 text-center font-apple text-[13px] font-medium text-gray-4">
                                    {t('page.makeShift.constraints.empty')}
                                </div>
                            )}
                        </div>
                    </Section>
                </div>
            </div>

            <SoftRuleModal
                open={softModalOpen}
                templates={addableSoftTemplates}
                optionMap={optionMap}
                onClose={() => setSoftModalOpen(false)}
                onAdd={addSoftRule}
            />
            <RecommendedRuleWarningModal
                warning={recommendedWarning}
                onClose={() => setRecommendedWarning(null)}
                onConfirm={confirmRecommendedWarning}
            />
        </>
    );
}
