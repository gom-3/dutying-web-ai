import type {TWardRotationMode} from '@dutying/domain';
import {cn} from '@dutying/utils/style';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ChevronDown, Plus, TriangleAlert, X} from 'lucide-react';
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
    type TShiftConstraintSeverity,
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
    hasShiftAvailabilityConfig?: boolean;
    canThreeShift?: boolean;
    canTwoShift?: boolean;
    divisionNum?: number;
    disabledReasonKey?: TI18nKey;
    raw?: TShiftConstraintOption;
};
type TTemplateCategory = string;
type TTypedT = ReturnType<typeof useTypedTranslation>['t'];
type TControlDef = {
    key: string;
    kind: 'select' | 'multiSelect' | 'number' | 'time';
    label?: string;
    optionsKey?: string;
    min?: number;
    max?: number;
    values?: number[];
    prefix?: string;
    suffix?: string;
    defaultValue?: string | number | null;
};
type TModalCategory = string;
type TSentencePart =
    | {type: 'text'; text: string}
    | {type: 'duty'; code: string}
    | {type: 'dutyPattern'; codes: string[]}
    | {type: 'dutyClassification'; classification: string}
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
    targetLockedToAll?: boolean;
    sourceTemplate?: TShiftConstraintTemplate;
};
type TRulesUpdate = (prev: TShiftConstraintRuleDraft[]) => TShiftConstraintRuleDraft[];
type TTimeOption = {
    value: string;
    label: string;
};

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
    divisionNum?: number | null;
    isPreceptor?: boolean | null;
    isPreceptee?: boolean | null;
    isWardManager?: boolean | null;
    memo?: string | null;
    nurseShiftTypes?: {
        wardShiftTypeId?: number;
        isPossible?: boolean;
    }[];
};
type TNurseRoleLike = {
    isPreceptor?: boolean | null;
    isPreceptee?: boolean | null;
    memo?: string | null;
};

const EMPTY_NURSES: TNurseLike[] = [];
const EMPTY_SHIFT_TYPES: TShiftTypeLike[] = [];
const EMPTY_SHIFT_CONSTRAINT_OPTIONS: TShiftConstraintOptions = {};
const SERVER_WARNING_MESSAGE_PREFIX = 'shiftConstraintRule.warning.';
const SAVED_RULE_WARNING_FALLBACK_MESSAGES: Record<string, string> = {
    MAX_WORK_BELOW_WORK_OFF_TRIGGER:
        '최대 연속 근무와 휴무 규칙이 서로 맞지 않아 휴무 규칙이 적용되지 않을 수 있어요. 두 조건의 일수를 다시 확인해 주세요.',
    EXACT_ONE_WITH_HARD_PRECEPTEE_COVERAGE:
        '같은 근무와 적용일의 정확 인원이 1명이라 프리셉티를 다른 간호사와 함께 배정할 수 없어요. 정확 인원을 늘리거나 프리셉티 단독 근무 금지를 권장으로 바꿔 주세요.',
    NURSE_SHIFT_PREFER_AVOID_CONFLICT:
        '같은 간호사의 같은 근무에 선호와 회피가 동시에 설정되어 있어요. 둘 중 하나를 삭제하거나 서로 다른 근무로 바꿔 주세요.',
};
const INLINE_TIME_OPTION_INTERVAL_MINUTES = 30;
const INLINE_TIME_MENU_MAX_HEIGHT = 240;
const INLINE_TIME_MENU_VIEWPORT_PADDING = 12;
const MIXED_OPERATION_POLICY_TEMPLATE_CODE = 'MIXED_OPERATION_POLICY';
const NURSE_SPECIFIC_MIXED_IMPORT_TEMPLATE_CODES = new Set(['MIXED_ROTATION_PARTICIPATION']);
const NURSE_REFERENCE_PARAM_KEYS = new Set(['nurse', 'nurseA', 'nurseB', 'nurseIds', 'preceptor', 'preceptee']);
const CONTROL_ACCESSIBLE_LABEL_KEY_BY_PARAM: Record<string, TI18nKey> = {
    nurseIds: 'page.makeShift.constraints.accessibility.field.nurses',
    count: 'page.makeShift.constraints.accessibility.field.count',
    workCount: 'page.makeShift.constraints.accessibility.field.workCount',
    offCount: 'page.makeShift.constraints.accessibility.field.offCount',
    unpairedMax: 'page.makeShift.constraints.accessibility.field.unpairedMax',
    minRestMinutes: 'page.makeShift.constraints.accessibility.field.minRestMinutes',
    maxMinutes: 'page.makeShift.constraints.accessibility.field.maxMinutes',
    maxDifference: 'page.makeShift.constraints.accessibility.field.maxDifference',
    startTime: 'page.makeShift.constraints.accessibility.field.startTime',
    endTime: 'page.makeShift.constraints.accessibility.field.endTime',
};

function hasPreceptorRole(nurse: TNurseRoleLike | null | undefined) {
    return hasNursePreceptorRole(nurse);
}

function hasPrecepteeRole(nurse: TNurseRoleLike | null | undefined) {
    return hasNursePrecepteeRole(nurse);
}

function getSavedRuleWarningMessage(warning: {code: string; message?: string | null}) {
    if (warning.message && !warning.message.startsWith(SERVER_WARNING_MESSAGE_PREFIX)) {
        return warning.message;
    }

    return SAVED_RULE_WARNING_FALLBACK_MESSAGES[warning.code] ?? '저장됐지만 확인이 필요한 제약조건이 있어요. 조건을 다시 확인해 주세요.';
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
    MIXED_PARTICIPATION: 'page.makeShift.constraints.category.mixedParticipation',
    CORE: 'page.makeShift.constraints.category.recommended',
    IMPORTANT: 'page.makeShift.constraints.category.recommended',
    TWO_SHIFT: 'page.makeShift.constraints.category.twoShift',
};

function ConstraintModalPortal({children}: {children: ReactNode}) {
    if (typeof document === 'undefined') return <>{children}</>;

    return createPortal(children, document.body);
}

function getCategoryLabel(t: TTypedT, category: TModalCategory, rotationMode: TWardRotationMode = 'THREE') {
    if (category === RECOMMENDED_MODAL_CATEGORY) return t('page.makeShift.constraints.category.recommended');

    if (category === 'MIXED_BALANCE') return '공정성';

    if (rotationMode !== 'MIXED' && category === 'WORK_REST') return t('page.makeShift.constraints.category.workRestStreaks');

    if (rotationMode !== 'MIXED' && (category === 'FORBIDDEN' || category === 'FORBIDDEN_PATTERN')) {
        return t('page.makeShift.constraints.category.nightTransition');
    }

    const key = CATEGORY_LABEL_KEY_BY_CATEGORY[category];

    return key ? t(key) : category;
}

function isRemovedSkillOrRoleCategory(category: string) {
    return category === 'SKILL' || category === 'PROFICIENCY' || category === 'ROLE_COVERAGE';
}

const REMOVED_SKILL_OR_ROLE_TEMPLATE_CODES = new Set([
    'NURSE_NOT_ALONE_N',
    'NEW_NURSE_NOT_ALONE_N',
    'MIN_PROFICIENCY_STAFF_BY_SHIFT',
    'SOFT_NEWBIE_NO_SOLO_N',
    'SOFT_MIN_SKILL_IN_DUTY',
    'PRECEPTEE_NOT_ALONE_SHIFT',
    'PRECEPTOR_PRECEPTEE_SAME_SHIFT',
    'MIN_CHARGE_NURSE_BY_SHIFT',
]);

function isRemovedSkillOrRoleTemplateCode(templateCode: string | null | undefined) {
    if (!templateCode) return false;

    return REMOVED_SKILL_OR_ROLE_TEMPLATE_CODES.has(templateCode) || /(?:SKILL|PROFICIENCY)/i.test(templateCode);
}

function isRemovedSkillOrRoleTemplate(template: Pick<TSoftRuleTemplate, 'id' | 'category' | 'controls'>) {
    return (
        isRemovedSkillOrRoleCategory(template.category) ||
        isRemovedSkillOrRoleTemplateCode(template.id) ||
        template.controls.some((control) => control.key === 'level' || control.optionsKey === 'level')
    );
}

function isVisibleConstraintRule(rule: Pick<TShiftConstraintRuleDraft, 'category' | 'templateCode'>) {
    return (
        rule.templateCode !== MIXED_OPERATION_POLICY_TEMPLATE_CODE &&
        !isRemovedSkillOrRoleCategory(rule.category) &&
        !isRemovedSkillOrRoleTemplateCode(rule.templateCode)
    );
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
    const displayName = style.name || style.code;

    return (
        <span
            className="inline-flex h-7 shrink-0 items-center rounded-[8px] px-2.5 font-apple text-[13px] font-bold text-white"
            style={{backgroundColor: style.color}}
        >
            <span className="text-[13px] font-semibold">{displayName}</span>
        </span>
    );
}

function DutyPatternBadge({options}: {options: TSelectOption[]}) {
    if (!options.length) return null;

    return (
        <span className="inline-flex h-8 shrink-0 items-center overflow-hidden rounded-[9px] bg-gray-7">
            {options.map((option, index) => {
                const style = resolveDutyStyle(option);

                return (
                    <span key={`${option.value}-${index}`} className="inline-flex h-full items-center">
                        {index > 0 ? <span className="px-1 font-apple text-[13px] font-bold text-gray-4">-</span> : null}
                        <span
                            className="inline-flex h-7 items-center rounded-[8px] px-2 font-apple text-white"
                            style={{backgroundColor: style.color}}
                            title={style.name || style.code}
                        >
                            <span className="text-[13px] font-semibold">{style.name || style.code}</span>
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
    'FORBID_N_THEN_D',
    'FORBID_N_THEN_E',
    'FORBID_E_THEN_D',
    'CORE_MIN_OFF_AFTER_NIGHT',
    'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
] as const;
const RECOMMENDED_DEFAULT_RULE_IDS = new Set<string>(RECOMMENDED_DEFAULT_RULE_CODES);
const THREE_SHIFT_NON_RECOMMENDED_RULE_CODES = new Set([
    'STAFF_COUNT_BY_SHIFT',
    'CORE_MAX_CONTINUOUS_WORK',
    'CORE_MIN_NIGHT_INTERVAL',
    'CORE_MAX_CONTINUOUS_NIGHT',
    'FORBID_E_THEN_N',
]);
const THREE_SHIFT_RECOMMENDED_RULE_ORDER = [
    'CORE_MIN_OFF_AFTER_NIGHT',
    'FORBID_N_THEN_D',
    'FORBID_N_THEN_E',
    'FORBID_E_THEN_D',
    'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
] as const;
const THREE_SHIFT_RECOMMENDED_RULE_CODES = new Set<string>(THREE_SHIFT_RECOMMENDED_RULE_ORDER);
const TWO_SHIFT_RECOMMENDED_RULE_ORDER = [
    'TWO_SHIFT_NIGHT_THEN_CONTINUATION',
    'TWO_SHIFT_NIGHT_CONTINUATION_AFTER_MIN_OFF',
    'TWO_SHIFT_NIGHT_PAIR_MIN_OFF',
    'FORBID_N_THEN_D',
    'CORE_MAX_CONTINUOUS_WORK',
    'CORE_MAX_CONTINUOUS_NIGHT',
    'CORE_MIN_CONTINUOUS_NIGHT',
    'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
] as const;
const TWO_SHIFT_RECOMMENDED_RULE_CODES = new Set<string>(TWO_SHIFT_RECOMMENDED_RULE_ORDER);
const FIXED_TWO_SHIFT_NIGHT_TEMPLATE_CODES = new Set([
    'TWO_SHIFT_NIGHT_THEN_CONTINUATION',
    'TWO_SHIFT_NIGHT_CONTINUATION_MIN_OFF',
    'TWO_SHIFT_NIGHT_PAIR_MIN_OFF',
]);
const FIXED_TWO_SHIFT_NIGHT_CONTINUATION_TEMPLATE_CODES = new Set([
    'TWO_SHIFT_NIGHT_THEN_CONTINUATION',
    'TWO_SHIFT_NIGHT_CONTINUATION_MIN_OFF',
    'TWO_SHIFT_NIGHT_CONTINUATION_AFTER_MIN_OFF',
]);
const TWO_SHIFT_NIGHT_RECOVERY_TEMPLATE_CODES = new Set([
    'TWO_SHIFT_NIGHT_THEN_CONTINUATION',
    'TWO_SHIFT_NIGHT_CONTINUATION_AFTER_MIN_OFF',
    'TWO_SHIFT_NIGHT_CONTINUATION_MIN_OFF',
    'TWO_SHIFT_NIGHT_PAIR_MIN_OFF',
]);
const MIXED_SHIFT_RECOMMENDED_RULE_ORDER = [
    'FORBID_N_THEN_D',
    'FORBID_N_THEN_E',
    'FORBID_E_THEN_D',
    'CORE_MIN_OFF_AFTER_NIGHT',
    'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
] as const;
const MIXED_SHIFT_RECOMMENDED_RULE_CODES = new Set<string>(MIXED_SHIFT_RECOMMENDED_RULE_ORDER);
const THREE_SHIFT_LEGACY_DEFAULT_RULE_CODES = new Set<string>(RECOMMENDED_DEFAULT_RULE_CODES);
const MIXED_SHIFT_LEGACY_DEFAULT_RULE_CODES = new Set([
    'CORE_MAX_CONTINUOUS_WORK',
    'CORE_MIN_NIGHT_INTERVAL',
    'FORBID_N_THEN_D',
    'FORBID_N_THEN_E',
    'FORBID_E_THEN_D',
    'FORBID_E_THEN_N',
    'CORE_MAX_CONTINUOUS_NIGHT',
    'CORE_MIN_OFF_AFTER_NIGHT',
    'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
]);
const MIXED_SHIFT_REMOVED_LEGACY_DEFAULT_RULE_CODES = new Set([
    'CORE_MAX_CONTINUOUS_WORK',
    'CORE_MIN_NIGHT_INTERVAL',
    'FORBID_E_THEN_N',
    'CORE_MAX_CONTINUOUS_NIGHT',
]);
const TWO_SHIFT_LEGACY_DEFAULT_RULE_CODES = new Set(['CORE_MAX_CONTINUOUS_WORK', 'CORE_MAX_CONTINUOUS_NIGHT', 'CORE_MIN_CONTINUOUS_NIGHT']);
const MIXED_SHIFT_TEMPLATE_CODES = new Set([
    'MIXED_ROTATION_PARTICIPATION',
    'MIXED_DAILY_COMPOSITION',
    'TWO_SHIFT_DAILY_LINES',
    'TWO_SHIFT_ASSIGNMENT_COUNT',
    'TIME_WINDOW_STAFF_COUNT',
    'MIN_REST_BETWEEN_SHIFTS',
    'MAX_WORK_MINUTES_BY_PERIOD',
    'MIXED_SHIFT_WORKLOAD_BALANCE',
]);
const TARGET_SOFT_ONLY_TEMPLATE_CODES = new Set(['TWO_SHIFT_DAILY_LINES', 'TWO_SHIFT_ASSIGNMENT_COUNT']);
const NURSE_SHIFT_PREFERENCE_SOFT_ONLY_TEMPLATE_CODES = new Set(['NURSE_PREFER_SHIFT', 'NURSE_AVOID_SHIFT']);
const TWO_SHIFT_VISIBLE_RULE_CODES = new Set([
    'STAFF_COUNT_BY_SHIFT',
    'CORE_MAX_CONTINUOUS_WORK',
    'MIN_OFF_AFTER_CONSECUTIVE_WORK',
    'AVOID_ISOLATED_WORK_DAY',
    'AVOID_ISOLATED_OFF_DAY',
    'CORE_MAX_CONTINUOUS_NIGHT',
    'CORE_MIN_CONTINUOUS_NIGHT',
    'TWO_SHIFT_NIGHT_THEN_CONTINUATION',
    'TWO_SHIFT_NIGHT_CONTINUATION_AFTER_MIN_OFF',
    'TWO_SHIFT_NIGHT_PAIR_MIN_OFF',
    'MAX_MONTHLY_NIGHT_COUNT',
    'FORBID_N_THEN_D',
    'NURSE_MAX_WEEKEND_HOLIDAY_SHIFTS',
    'NURSE_FORBID_WEEKEND',
    'NURSE_PREFER_SHIFT',
    'NURSE_AVOID_SHIFT',
    'NURSE_PAIR_NOT_SAME_SHIFT',
    'NURSE_PAIR_PREFER_SAME_SHIFT',
]);
const THREE_SHIFT_VISIBLE_RULE_CODES = new Set([
    'STAFF_COUNT_BY_SHIFT',
    'CORE_MAX_CONTINUOUS_WORK',
    'MIN_OFF_AFTER_CONSECUTIVE_WORK',
    'AVOID_ISOLATED_WORK_DAY',
    'AVOID_ISOLATED_OFF_DAY',
    'CORE_MIN_NIGHT_INTERVAL',
    'CORE_MAX_CONTINUOUS_NIGHT',
    'CORE_MIN_CONTINUOUS_NIGHT',
    'CORE_MIN_OFF_AFTER_NIGHT',
    'FORBID_N_THEN_D',
    'FORBID_N_THEN_E',
    'FORBID_E_THEN_D',
    'FORBID_E_THEN_N',
    'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
    'NURSE_MAX_WEEKEND_HOLIDAY_SHIFTS',
    'NURSE_FORBID_WEEKEND',
    'NURSE_PREFER_SHIFT',
    'NURSE_AVOID_SHIFT',
    'NURSE_PAIR_NOT_SAME_SHIFT',
    'NURSE_PAIR_PREFER_SAME_SHIFT',
]);
const MIXED_SHIFT_VISIBLE_RULE_CODES = new Set([
    'STAFF_COUNT_BY_SHIFT',
    'CORE_MAX_CONTINUOUS_WORK',
    'MIN_OFF_AFTER_CONSECUTIVE_WORK',
    'AVOID_ISOLATED_WORK_DAY',
    'AVOID_ISOLATED_OFF_DAY',
    'CORE_MIN_NIGHT_INTERVAL',
    'CORE_MAX_CONTINUOUS_NIGHT',
    'CORE_MIN_CONTINUOUS_NIGHT',
    'CORE_MIN_OFF_AFTER_NIGHT',
    'FORBID_N_THEN_D',
    'FORBID_N_THEN_E',
    'FORBID_E_THEN_D',
    'FORBID_E_THEN_N',
    'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
    'NURSE_FORBID_WEEKEND',
    'NURSE_PREFER_SHIFT',
    'NURSE_AVOID_SHIFT',
    'NURSE_PAIR_NOT_SAME_SHIFT',
    'NURSE_PAIR_PREFER_SAME_SHIFT',
    'MIXED_ROTATION_PARTICIPATION',
    'MIXED_DAILY_COMPOSITION',
    'TWO_SHIFT_DAILY_LINES',
    'TWO_SHIFT_ASSIGNMENT_COUNT',
    'TIME_WINDOW_STAFF_COUNT',
    'MIN_REST_BETWEEN_SHIFTS',
    'MAX_WORK_MINUTES_BY_PERIOD',
    'MIXED_SHIFT_WORKLOAD_BALANCE',
]);
const ROTATION_MODAL_CATEGORY_ORDER = ['STAFFING_COUNT', 'WORK_REST', 'FORBIDDEN_PATTERN', 'NURSE_LIMIT', 'NURSE_COMBINATION'];
const MIXED_MODAL_CATEGORY_ORDER = [
    'MIXED_PARTICIPATION',
    'STAFFING_COUNT',
    'WORK_REST',
    'NURSE_LIMIT',
    'MIXED_BALANCE',
    'FORBIDDEN_PATTERN',
    'NURSE_COMBINATION',
];
const HIDDEN_RECOMMENDED_RULE_IDS = new Set<string>([
    'CORE_EXCLUDE_CERTAIN_WORK_TYPES',
    'CORE_FORBIDDEN_DUTY_PATTERNS',
    'IMPORTANT_FORBIDDEN_DUTY_PATTERNS',
    'MAX_CONSECUTIVE_WORK_DAYS',
    'MAX_CONSECUTIVE_N',
    'MIN_OFF_AFTER_N',
    'MIN_STAFF_BY_SHIFT',
    'MAX_STAFF_BY_SHIFT',
    'EXACT_STAFF_BY_SHIFT',
    'MIN_STAFF_BY_DATE_SHIFT',
    'MIN_STAFF_BY_DAY_TYPE_SHIFT',
    'MIN_STAFF_WEEKEND_HOLIDAY_SHIFT',
    'NEW_NURSE_NOT_ALONE_N',
    'PRECEPTEE_NOT_ALONE_N',
]);
const MODAL_CATEGORY_BY_TEMPLATE_CODE: Record<string, TTemplateCategory> = {
    STAFF_COUNT_BY_SHIFT: 'STAFFING_COUNT',
    CORE_MAX_CONTINUOUS_WORK: 'WORK_REST',
    MIN_OFF_AFTER_CONSECUTIVE_WORK: 'WORK_REST',
    AVOID_ISOLATED_WORK_DAY: 'WORK_REST',
    AVOID_ISOLATED_OFF_DAY: 'WORK_REST',
    CORE_MIN_NIGHT_INTERVAL: 'FORBIDDEN_PATTERN',
    CORE_MAX_CONTINUOUS_NIGHT: 'FORBIDDEN_PATTERN',
    CORE_MIN_CONTINUOUS_NIGHT: 'FORBIDDEN_PATTERN',
    CORE_MIN_OFF_AFTER_NIGHT: 'FORBIDDEN_PATTERN',
    TWO_SHIFT_NIGHT_THEN_CONTINUATION: 'FORBIDDEN_PATTERN',
    TWO_SHIFT_NIGHT_CONTINUATION_AFTER_MIN_OFF: 'WORK_REST',
    MAX_MONTHLY_NIGHT_COUNT: 'FORBIDDEN_PATTERN',
    FORBID_N_THEN_D: 'FORBIDDEN_PATTERN',
    FORBID_N_THEN_E: 'FORBIDDEN_PATTERN',
    FORBID_E_THEN_D: 'FORBIDDEN_PATTERN',
    FORBID_E_THEN_N: 'FORBIDDEN_PATTERN',
    CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF: 'FORBIDDEN_PATTERN',
    NURSE_MAX_WEEKEND_HOLIDAY_SHIFTS: 'NURSE_LIMIT',
    NURSE_FORBID_WEEKEND: 'NURSE_LIMIT',
    NURSE_PREFER_SHIFT: 'NURSE_LIMIT',
    NURSE_AVOID_SHIFT: 'NURSE_LIMIT',
    NURSE_PAIR_NOT_SAME_SHIFT: 'NURSE_COMBINATION',
    NURSE_PAIR_PREFER_SAME_SHIFT: 'NURSE_COMBINATION',
    MIXED_ROTATION_PARTICIPATION: 'MIXED_PARTICIPATION',
    MIXED_DAILY_COMPOSITION: 'STAFFING_COUNT',
    TWO_SHIFT_DAILY_LINES: 'STAFFING_COUNT',
    TWO_SHIFT_ASSIGNMENT_COUNT: 'NURSE_LIMIT',
    TIME_WINDOW_STAFF_COUNT: 'STAFFING_COUNT',
    MIN_REST_BETWEEN_SHIFTS: 'WORK_REST',
    MAX_WORK_MINUTES_BY_PERIOD: 'WORK_REST',
    MIXED_SHIFT_WORKLOAD_BALANCE: 'MIXED_BALANCE',
};
const RETIRED_TWO_SHIFT_CONFIGURATION_CODES = new Set([
    'TWO_SHIFT_MAX_LINES',
    'CORE_MIN_REST_HOURS',
    'MAX_MONTHLY_WORK_HOURS',
    'TWO_SHIFT_NIGHT_CONTINUATION_MIN_OFF',
    'TWO_SHIFT_NIGHT_PAIR',
    'TWO_SHIFT_NIGHT_CONTINUATION_MIN_OFF',
]);
const THREE_SHIFT_LEGACY_VISIBLE_RULE_CODES = new Set(['MAX_CONSECUTIVE_WORK_DAYS', 'OFF_AFTER_CONSECUTIVE_WORK']);

function isSavedRuleVisibleForRotation(templateCode: string, rotationMode: TWardRotationMode) {
    if (rotationMode === 'TWO') return TWO_SHIFT_VISIBLE_RULE_CODES.has(templateCode);

    if (rotationMode === 'THREE') {
        return THREE_SHIFT_VISIBLE_RULE_CODES.has(templateCode) || THREE_SHIFT_LEGACY_VISIBLE_RULE_CODES.has(templateCode);
    }

    return MIXED_SHIFT_VISIBLE_RULE_CODES.has(templateCode);
}

function isRuleImportableForRotation(templateCode: string, rotationMode: TWardRotationMode) {
    if (rotationMode === 'TWO') return TWO_SHIFT_VISIBLE_RULE_CODES.has(templateCode);

    if (rotationMode === 'THREE') return THREE_SHIFT_VISIBLE_RULE_CODES.has(templateCode);

    return MIXED_SHIFT_VISIBLE_RULE_CODES.has(templateCode);
}

function containsNurseReference(value: unknown, paramKey?: string): boolean {
    if (paramKey && NURSE_REFERENCE_PARAM_KEYS.has(paramKey)) return true;

    if (Array.isArray(value)) return value.some((item) => containsNurseReference(item));

    if (!value || typeof value !== 'object') return false;

    const record = value as Record<string, unknown>;

    if (
        record.nurseId != null ||
        String(record.type ?? '')
            .trim()
            .toUpperCase() === 'NURSE'
    )
        return true;

    return Object.entries(record).some(([key, entryValue]) => containsNurseReference(entryValue, key));
}

function isNurseSpecificImportRule(rule: TShiftConstraintRuleDraft) {
    return NURSE_SPECIFIC_MIXED_IMPORT_TEMPLATE_CODES.has(rule.templateCode) || containsNurseReference(rule.params);
}

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
    'EXACT_STAFF_BY_SHIFT',
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
const EXACT_STAFFING_COUNT_TEMPLATE_CODES = new Set(['EXACT_STAFF_BY_SHIFT', 'SOFT_EXACT_STAFF_BY_DUTY']);

function getTemplateTranslationKey(templateId: string, property: 'label' | 'sentence') {
    return `page.makeShift.constraints.templates.${templateId}.${property}` as TI18nKey;
}

function getMixedTemplateFallbackLabel(templateId: string) {
    const labelByTemplateId: Record<string, string> = {
        MIXED_DAILY_COMPOSITION: '혼합교대 편성',
        TWO_SHIFT_DAILY_LINES: '2교대 라인 수',
        TWO_SHIFT_ASSIGNMENT_COUNT: '2교대 배정 횟수',
        TIME_WINDOW_STAFF_COUNT: '시간대별 필요 인원',
        MIN_REST_BETWEEN_SHIFTS: '근무 간 휴식',
        MAX_WORK_MINUTES_BY_PERIOD: '기간별 최대 근무시간',
        MIXED_SHIFT_WORKLOAD_BALANCE: '혼합교대 부담 균형',
    };

    return labelByTemplateId[templateId];
}

function getTranslatedTemplatePattern(t: TTypedT, templateId: string) {
    const key = getTemplateTranslationKey(templateId, 'sentence');
    const translated = t(key);

    return translated === key ? null : translated;
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
        id: 'CORE_MIN_CONTINUOUS_NIGHT',
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
        id: 'MIN_OFF_AFTER_CONSECUTIVE_WORK',
        category: 'WORK_REST',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'workCount', kind: 'number', min: 1, max: 31},
            {key: 'offCount', kind: 'number', min: 1, max: 31},
        ],
    },
    {
        id: 'AVOID_ISOLATED_WORK_DAY',
        category: 'WORK_REST',
        controls: [{key: 'target', kind: 'select', optionsKey: 'target'}],
    },
    {
        id: 'AVOID_ISOLATED_OFF_DAY',
        category: 'WORK_REST',
        controls: [{key: 'target', kind: 'select', optionsKey: 'target'}],
    },
    {
        id: 'NURSE_MAX_WEEKEND_HOLIDAY_SHIFTS',
        category: 'NURSE_LIMIT',
        controls: [
            {key: 'target', kind: 'select', optionsKey: 'target'},
            {key: 'shift', kind: 'select', optionsKey: 'duty'},
            {key: 'period', kind: 'select', optionsKey: 'period'},
            {key: 'count', kind: 'number', min: 0, max: 31},
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
    MIN_OFF_AFTER_CONSECUTIVE_WORK: {target: ALL_CONSTRAINT_TARGET_OPTION, workCount: 5, offCount: 2},
    AVOID_ISOLATED_WORK_DAY: {target: ALL_CONSTRAINT_TARGET_OPTION},
    AVOID_ISOLATED_OFF_DAY: {target: ALL_CONSTRAINT_TARGET_OPTION},
    MAX_DAY_NIGHT_TRANSITIONS: {target: ALL_CONSTRAINT_TARGET_OPTION, direction: {type: 'BOTH'}, period: {type: 'MONTH'}, count: 4},
    NURSE_MAX_WEEKEND_HOLIDAY_SHIFTS: {
        target: ALL_CONSTRAINT_TARGET_OPTION,
        shift: {type: 'ALL'},
        period: {type: 'MONTH'},
        count: 4,
    },
    MIXED_ROTATION_PARTICIPATION: {
        target: ALL_CONSTRAINT_TARGET_OPTION,
        participationMode: {type: 'FALLBACK_TWO'},
        dateScope: {type: 'EVERYDAY'},
    },
    TIME_WINDOW_STAFF_COUNT: {
        dateScope: {type: 'EVERYDAY'},
        startTime: '07:00',
        endTime: '15:00',
        operator: {type: 'MIN'},
        count: 1,
    },
};
const TWO_SHIFT_DEFAULT_PARAMS_BY_TEMPLATE_CODE: Record<string, Record<string, unknown>> = {
    CORE_MAX_CONTINUOUS_WORK: {days: 4, maxDays: 4, maxContinuousWorkDays: 4, count: 4},
    CORE_MAX_CONTINUOUS_NIGHT: {count: 3},
    CORE_MIN_CONTINUOUS_NIGHT: {count: 1},
    TWO_SHIFT_NIGHT_CONTINUATION_AFTER_MIN_OFF: {count: 1},
    TWO_SHIFT_NIGHT_PAIR_MIN_OFF: {count: 2},
};
const TWO_SHIFT_SENTENCE_TEMPLATE_ID_BY_CODE: Record<string, string> = {
    CORE_MAX_CONTINUOUS_NIGHT: 'TWO_SHIFT_MAX_CONTINUOUS_NIGHT',
    CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF: 'TWO_SHIFT_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
};
const MIXED_SHIFT_SENTENCE_TEMPLATE_ID_BY_CODE: Record<string, string> = {
    CORE_MIN_NIGHT_INTERVAL: 'MIXED_CORE_MIN_NIGHT_INTERVAL',
    CORE_MAX_CONTINUOUS_NIGHT: 'MIXED_CORE_MAX_CONTINUOUS_NIGHT',
    CORE_MIN_CONTINUOUS_NIGHT: 'MIXED_CORE_MIN_CONTINUOUS_NIGHT',
    CORE_MIN_OFF_AFTER_NIGHT: 'MIXED_CORE_MIN_OFF_AFTER_NIGHT',
    FORBID_N_THEN_D: 'MIXED_FORBID_N_THEN_D',
    FORBID_N_THEN_E: 'MIXED_FORBID_N_THEN_E',
    FORBID_E_THEN_D: 'MIXED_FORBID_E_THEN_D',
    FORBID_E_THEN_N: 'MIXED_FORBID_E_THEN_N',
    CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF: 'MIXED_CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
};

function getSentenceTemplateId(templateCode: string, rotationMode: TWardRotationMode) {
    if (rotationMode === 'TWO') return TWO_SHIFT_SENTENCE_TEMPLATE_ID_BY_CODE[templateCode] ?? templateCode;

    if (rotationMode === 'MIXED') return MIXED_SHIFT_SENTENCE_TEMPLATE_ID_BY_CODE[templateCode] ?? templateCode;

    return templateCode;
}

const OPTION_GROUP_TO_OPTION_MAP_KEY: Record<string, string> = {
    target: 'target',
    targets: 'target',
    TARGET: 'target',
    TARGETS: 'target',
    nightShift: 'nightShift',
    nightShifts: 'nightShift',
    NIGHT_SHIFT: 'nightShift',
    NIGHT_SHIFTS: 'nightShift',
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
    direction: 'transitionDirection',
    transitionDirections: 'transitionDirection',
    TRANSITION_DIRECTION: 'transitionDirection',
    TRANSITION_DIRECTIONS: 'transitionDirection',
    period: 'period',
    periods: 'period',
    PERIOD: 'period',
    PERIODS: 'period',
    shift: 'duty',
    shifts: 'dutyStrict',
    shiftsWithAll: 'duty',
    twoShiftNight: 'twoShiftNight',
    twoShiftNights: 'twoShiftNight',
    TWO_SHIFT_NIGHT: 'twoShiftNight',
    TWO_SHIFT_NIGHTS: 'twoShiftNight',
    twoShiftNightContinuation: 'twoShiftNightContinuation',
    twoShiftNightContinuations: 'twoShiftNightContinuation',
    TWO_SHIFT_NIGHT_CONTINUATION: 'twoShiftNightContinuation',
    TWO_SHIFT_NIGHT_CONTINUATIONS: 'twoShiftNightContinuation',
    offShift: 'offShift',
    offShifts: 'offShift',
    OFF_SHIFT: 'offShift',
    OFF_SHIFTS: 'offShift',
    dutyStrict: 'dutyStrict',
    DUTY_STRICT: 'dutyStrict',
    DUTYSTRICT: 'dutyStrict',
    SHIFT: 'duty',
    SHIFTS: 'duty',
    SHIFT_TYPE: 'duty',
    SHIFT_TYPES: 'duty',
    SHIFTS_WITH_ALL: 'duty',
    strategy: 'strategy',
    strategies: 'strategy',
    mixedStrategies: 'strategy',
    mixedCompositions: 'mixedComposition',
    lineOperator: 'lineOperator',
    lineOperators: 'lineOperator',
    mixedLineOperators: 'lineOperator',
    assignmentAggregation: 'assignmentAggregation',
    assignmentAggregations: 'assignmentAggregation',
    mixedAssignmentAggregations: 'assignmentAggregation',
    twoShiftScope: 'twoShiftScope',
    twoShiftScopes: 'twoShiftScope',
    mixedTwoShiftScopes: 'twoShiftScope',
    workloadMetric: 'workloadMetric',
    workloadMetrics: 'workloadMetric',
    mixedWorkloadMetrics: 'workloadMetric',
    STRATEGY: 'strategy',
    STRATEGIES: 'strategy',
    participationMode: 'participationMode',
    participationModes: 'participationMode',
    mixedParticipationModes: 'participationMode',
    PARTICIPATION_MODE: 'participationMode',
    PARTICIPATION_MODES: 'participationMode',
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
const DUTY_CLASSIFICATION_BY_PLACEHOLDER: Record<string, string> = {
    nightShift: 'NIGHT',
    eveningShift: 'EVENING',
};
const DUTY_CLASSIFICATION_FALLBACK_BY_CLASSIFICATION: Record<string, string> = {
    DAY: 'D',
    EVENING: 'E',
    NIGHT: 'N',
};

function isRecommendedTemplateCode(templateCode: string, _category?: string, rotationMode: TWardRotationMode = 'THREE') {
    if (rotationMode === 'TWO') return TWO_SHIFT_RECOMMENDED_RULE_CODES.has(templateCode);

    if (rotationMode === 'THREE') return THREE_SHIFT_RECOMMENDED_RULE_CODES.has(templateCode);

    return MIXED_SHIFT_RECOMMENDED_RULE_CODES.has(templateCode);
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

function isRecommendedDefaultRuleCode(templateCode: string, rotationMode: TWardRotationMode = 'THREE') {
    if (rotationMode === 'TWO') return TWO_SHIFT_RECOMMENDED_RULE_CODES.has(templateCode);

    if (rotationMode === 'MIXED') return MIXED_SHIFT_RECOMMENDED_RULE_CODES.has(templateCode);

    return RECOMMENDED_DEFAULT_RULE_IDS.has(templateCode);
}

function isNurseShiftPreferenceSoftOnlyRule(templateCode: string) {
    return NURSE_SHIFT_PREFERENCE_SOFT_ONLY_TEMPLATE_CODES.has(templateCode);
}

function hasLegacyRecommendedDefaults(rules: TShiftConstraintRuleDraft[], rotationMode: TWardRotationMode) {
    const existingTemplateCodes = new Set(rules.map((rule) => rule.templateCode));
    const baseline =
        rotationMode === 'TWO'
            ? TWO_SHIFT_LEGACY_DEFAULT_RULE_CODES
            : rotationMode === 'MIXED'
              ? MIXED_SHIFT_LEGACY_DEFAULT_RULE_CODES
              : THREE_SHIFT_LEGACY_DEFAULT_RULE_CODES;

    return [...baseline].every((templateCode) => existingTemplateCodes.has(templateCode));
}

function isLegacyThreeShiftNightIntervalDefault(rule: TShiftConstraintRuleDraft, rotationMode: TWardRotationMode) {
    return (
        rotationMode === 'THREE' &&
        rule.templateCode === 'CORE_MIN_NIGHT_INTERVAL' &&
        rule.severity === 'HARD' &&
        getConstraintOptionType(rule.params.target) === 'ALL' &&
        Number(rule.params.count) === 5
    );
}

function isRemovedLegacyMixedDefault(rule: TShiftConstraintRuleDraft, rotationMode: TWardRotationMode) {
    if (
        rotationMode !== 'MIXED' ||
        !MIXED_SHIFT_REMOVED_LEGACY_DEFAULT_RULE_CODES.has(rule.templateCode) ||
        rule.severity !== 'HARD' ||
        getConstraintOptionType(rule.params.target) !== 'ALL'
    ) {
        return false;
    }

    if (rule.templateCode === 'FORBID_E_THEN_N') return true;

    const expectedCount =
        rule.templateCode === 'CORE_MAX_CONTINUOUS_WORK' || rule.templateCode === 'CORE_MIN_NIGHT_INTERVAL'
            ? 5
            : rule.templateCode === 'CORE_MAX_CONTINUOUS_NIGHT'
              ? 3
              : null;

    return expectedCount !== null && Number(rule.params.count) === expectedCount;
}

function isTemplateSelectable(template: TShiftConstraintTemplate) {
    const hasSelectableSeverity =
        template.severity === 'HARD' ||
        template.severity === 'SOFT' ||
        template.allowedSeverities.includes('HARD') ||
        template.allowedSeverities.includes('SOFT');

    if (MIXED_SHIFT_TEMPLATE_CODES.has(template.templateCode)) {
        return template.supportedInValidator && hasSelectableSeverity;
    }

    return template.supportedInGenerator && template.supportedInValidator && hasSelectableSeverity;
}

function getOptionMapKey(optionGroup?: string) {
    if (!optionGroup) return undefined;

    return OPTION_GROUP_TO_OPTION_MAP_KEY[optionGroup] ?? OPTION_GROUP_TO_OPTION_MAP_KEY[optionGroup.toUpperCase()] ?? optionGroup;
}

function getControlKind(slot: TShiftConstraintSlot): TControlDef['kind'] {
    const inputType = slot.inputType.toUpperCase();

    if (inputType === 'NUMBER') return 'number';

    if (inputType === 'TIME') return 'time';

    return inputType === 'MULTI_SELECT' ? 'multiSelect' : 'select';
}

function createControlFromSlot(slot: TShiftConstraintSlot): TControlDef {
    const kind = getControlKind(slot);

    if (kind === 'number') {
        return {
            key: slot.key,
            kind,
            label: slot.label,
            min: slot.min ?? 1,
            max: slot.max ?? slot.min ?? 10,
            defaultValue: slot.defaultValue,
        };
    }

    if (kind === 'time') {
        return {
            key: slot.key,
            kind,
            label: slot.label,
            defaultValue: slot.defaultValue,
        };
    }

    return {
        key: slot.key,
        kind,
        label: slot.label,
        optionsKey: getOptionMapKey(slot.optionGroup),
        defaultValue: slot.defaultValue,
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
        } else if (DUTY_CLASSIFICATION_BY_PLACEHOLDER[key]) {
            parts.push({type: 'dutyClassification', classification: DUTY_CLASSIFICATION_BY_PLACEHOLDER[key]});
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
    return pattern.replace(/\{([^}]+)\}/g, (_, key: string) => {
        const normalizedKey = key.trim();

        if (DUTY_CLASSIFICATION_BY_PLACEHOLDER[normalizedKey]) {
            return DUTY_CLASSIFICATION_FALLBACK_BY_CLASSIFICATION[DUTY_CLASSIFICATION_BY_PLACEHOLDER[normalizedKey]] ?? normalizedKey;
        }

        return params[normalizedKey] ?? '';
    });
}

function canUseLegacySentence(legacyTemplate: TSoftRuleTemplate | undefined, controls: TControlDef[]) {
    if (!legacyTemplate) return false;

    const controlKeys = new Set(controls.map((control) => control.key));

    return legacyTemplate.sentence.every((part) => part.type !== 'control' || controlKeys.has(part.key));
}

function interpolateDisplayTemplate(displayTemplate: string, _controls: TControlDef[], params: Record<string, string>) {
    return displayTemplate.replace(/\{([^}]+)\}/g, (_, key: string) => {
        const normalizedKey = key.trim();

        if (DUTY_CLASSIFICATION_BY_PLACEHOLDER[normalizedKey]) {
            return DUTY_CLASSIFICATION_FALLBACK_BY_CLASSIFICATION[DUTY_CLASSIFICATION_BY_PLACEHOLDER[normalizedKey]] ?? normalizedKey;
        }

        return params[normalizedKey] ?? '';
    });
}

function createLocalizedSoftRuleTemplate(
    definition: TSoftRuleTemplateDefinition,
    t: TTypedT,
    rotationMode: TWardRotationMode = 'THREE',
): TSoftRuleTemplate {
    const sentenceTemplateId = getSentenceTemplateId(definition.id, rotationMode);
    const sentencePattern = t(getTemplateTranslationKey(sentenceTemplateId, 'sentence'));

    return {
        ...definition,
        label: t(getTemplateTranslationKey(definition.id, 'label')),
        sentence: createSentenceFromPattern(sentencePattern, definition.controls),
        buildText: (params) => interpolateLocalizedPattern(sentencePattern, params),
        isRecommended: isRecommendedTemplateCode(definition.id, definition.category, rotationMode),
    };
}

function createSoftRuleTemplates(templates: TShiftConstraintTemplate[], t: TTypedT, rotationMode: TWardRotationMode = 'THREE') {
    const legacyTemplates = createLegacySoftRuleTemplates(t, rotationMode);

    return templates.filter(isTemplateSelectable).map<TSoftRuleTemplate>((template) => {
        const baseControls = template.slots.map(createControlFromSlot).map((control) => {
            if (template.templateCode === 'STAFF_COUNT_BY_SHIFT' && control.key === 'shift') {
                return {...control, optionsKey: 'dutyStrict'};
            }

            return control;
        });
        const controls = baseControls;
        const legacyTemplate = legacyTemplates.find(
            (item) => item.id === (LEGACY_TEMPLATE_ALIAS_BY_TEMPLATE_CODE[template.templateCode] ?? template.templateCode),
        );
        const sentenceTemplateId = getSentenceTemplateId(template.templateCode, rotationMode);
        const localizedSentencePattern = getTranslatedTemplatePattern(t, sentenceTemplateId);
        const baseSentence = localizedSentencePattern
            ? createSentenceFromPattern(localizedSentencePattern, controls)
            : canUseLegacySentence(legacyTemplate, controls)
              ? legacyTemplate!.sentence
              : createSentenceFromTemplate(template, controls);
        const sentence = baseSentence;
        const baseBuildText =
            template.templateCode === 'STAFF_COUNT_BY_SHIFT'
                ? (params: Record<string, string>) => {
                      const interpolation = {
                          dateScope: params.dateScope ?? '',
                          shift: params.shift ?? '',
                          count: params.count ?? '',
                      };

                      if (params.operator === t('page.makeShift.constraints.option.staffCountOperator.min')) {
                          return t('page.makeShift.constraints.staffCountText.min', interpolation);
                      }

                      if (params.operator === t('page.makeShift.constraints.option.staffCountOperator.max')) {
                          return t('page.makeShift.constraints.staffCountText.max', interpolation);
                      }

                      if (params.operator === t('page.makeShift.constraints.option.staffCountOperator.exact')) {
                          return t('page.makeShift.constraints.staffCountText.exact', interpolation);
                      }

                      return interpolateDisplayTemplate(template.displayTemplate, controls, params);
                  }
                : localizedSentencePattern
                  ? (params: Record<string, string>) => interpolateLocalizedPattern(localizedSentencePattern, params)
                  : (legacyTemplate?.buildText ??
                    ((params: Record<string, string>) => interpolateDisplayTemplate(template.displayTemplate, controls, params)));
        const buildText = baseBuildText;

        return {
            id: template.templateCode,
            category: getTemplateModalCategory(template.templateCode, template.category),
            label:
                legacyTemplate?.label ??
                (MIXED_SHIFT_TEMPLATE_CODES.has(template.templateCode)
                    ? (getMixedTemplateFallbackLabel(template.templateCode) ?? t(getTemplateTranslationKey(template.templateCode, 'label')))
                    : getCategoryLabel(t, template.category)),
            controls,
            sentence,
            buildText,
            isRecommended: isRecommendedTemplateCode(template.templateCode, template.category, rotationMode),
            sourceTemplate: template,
        };
    });
}

function createLegacySoftRuleTemplates(t: TTypedT, rotationMode: TWardRotationMode = 'THREE') {
    return SOFT_RULE_TEMPLATE_DEFINITIONS.map((template) => createLocalizedSoftRuleTemplate(template, t, rotationMode));
}

function createClientId(rule: {shiftConstraintRuleId?: number; templateCode: string}) {
    if (rule.shiftConstraintRuleId) return `saved-${rule.shiftConstraintRuleId}`;

    return `draft-${rule.templateCode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getConstraintRuleRowId(clientId: string) {
    return `constraint-rule-${clientId}`;
}

function fromServerRules(rules: Omit<TShiftConstraintRuleDraft, 'clientId'>[]) {
    return rules.map((rule) => {
        const severity = isNurseShiftPreferenceSoftOnlyRule(rule.templateCode) ? 'SOFT' : rule.severity;

        return {
            ...rule,
            severity,
            isImportant: severity === 'HARD',
            clientId: createClientId(rule),
        };
    });
}

function createRulesFromServer(serverRules: TShiftConstraintRule[]) {
    return fromServerRules(serverRules).filter((rule) => !RETIRED_TWO_SHIFT_CONFIGURATION_CODES.has(rule.templateCode));
}

function getSelectOptionParamValue(option: TSelectOption | undefined) {
    if (!option?.raw) return option?.value ?? option?.label ?? '';

    const value: TShiftConstraintOption = {type: option.raw.type};

    if (option.raw.nurseId != null) value.nurseId = option.raw.nurseId;

    if (option.raw.divisionNum != null) value.divisionNum = option.raw.divisionNum;

    if (option.raw.wardShiftTypeId != null) value.wardShiftTypeId = option.raw.wardShiftTypeId;

    if (option.raw.day != null) value.day = option.raw.day;

    if (option.raw.code) value.code = option.raw.code;

    if (option.raw.value) value.value = option.raw.value;

    return value;
}

function getRequiredMixedNurseMode(template: TSoftRuleTemplate, params: Record<string, unknown>) {
    if (template.id === 'MIXED_ROTATION_PARTICIPATION') {
        return getConstraintOptionType(params.participationMode) ?? 'FALLBACK_TWO';
    }

    return null;
}

function isNurseOptionEligibleForMode(option: TSelectOption, requiredMode: string | null) {
    if (!requiredMode || option.kind !== 'nurse') return true;

    if (requiredMode === 'THREE_ONLY') return option.canThreeShift !== false;

    if (requiredMode === 'TWO_ONLY') return option.canTwoShift !== false;

    if (requiredMode === 'FLEX' || requiredMode === 'FALLBACK_TWO') {
        return option.canThreeShift !== false && option.canTwoShift !== false;
    }

    return true;
}

function getNurseUnavailableReasonKey(requiredMode: string | null): TI18nKey | undefined {
    if (requiredMode === 'THREE_ONLY') return 'page.makeShift.constraints.mixed.nurseUnavailable.threeShift';

    if (requiredMode === 'TWO_ONLY') return 'page.makeShift.constraints.mixed.nurseUnavailable.twoShift';

    if (requiredMode === 'FLEX' || requiredMode === 'FALLBACK_TWO') {
        return 'page.makeShift.constraints.mixed.nurseUnavailable.bothShifts';
    }

    return undefined;
}

function getNurseOptionUnavailableReasonKey(option: TSelectOption, requiredMode: string | null) {
    if (option.hasShiftAvailabilityConfig === false) return 'page.makeShift.constraints.mixed.nurseUnavailable.notConfigured';

    return getNurseUnavailableReasonKey(requiredMode);
}

function getTargetNurseOptions(option: TSelectOption, nurseOptions: TSelectOption[]) {
    const type = getConstraintOptionType(option.raw) ?? option.value;

    if (type === 'ALL') return nurseOptions;

    if (type === 'DIVISION') {
        const divisionNum = option.raw?.divisionNum;

        return nurseOptions.filter((nurseOption) => nurseOption.divisionNum === divisionNum);
    }

    if (type === 'NURSE') {
        return nurseOptions.filter((nurseOption) => nurseOption.raw?.nurseId === option.raw?.nurseId || nurseOption.value === option.value);
    }

    return [];
}

function getTargetOptionUnavailableReasonKey(
    option: TSelectOption,
    requiredMode: string | null,
    nurseOptions: TSelectOption[],
): TI18nKey | undefined {
    if (!requiredMode) return undefined;

    const targetNurseOptions = getTargetNurseOptions(option, nurseOptions);

    if (!targetNurseOptions.length) return 'page.makeShift.constraints.mixed.validation.selectEligibleNurse';

    const unavailableNurse = targetNurseOptions.find((nurseOption) => !isNurseOptionEligibleForMode(nurseOption, requiredMode));

    return unavailableNurse ? getNurseOptionUnavailableReasonKey(unavailableNurse, requiredMode) : undefined;
}

function getEligibleNurseOptions(template: TSoftRuleTemplate, params: Record<string, unknown>, options: TSelectOption[]) {
    const requiredMode = getRequiredMixedNurseMode(template, params);

    return options.filter((option) => isNurseOptionEligibleForMode(option, requiredMode));
}

function getControlAccessibleLabel(t: TTypedT, template: TSoftRuleTemplate, control: TControlDef) {
    const fallbackKey: TI18nKey =
        control.kind === 'multiSelect'
            ? 'page.makeShift.constraints.accessibility.field.selection'
            : control.kind === 'time'
              ? 'page.makeShift.constraints.accessibility.field.time'
              : control.kind === 'number'
                ? 'page.makeShift.constraints.accessibility.field.number'
                : 'page.makeShift.constraints.accessibility.field.selection';
    const fieldLabel = t(CONTROL_ACCESSIBLE_LABEL_KEY_BY_PARAM[control.key] ?? fallbackKey);

    return t('page.makeShift.constraints.accessibility.fieldLabel', {
        constraint: template.label,
        field: fieldLabel,
    });
}

function getNumberBounds(
    template: TSoftRuleTemplate,
    control: TControlDef,
    optionMap: Record<string, TSelectOption[]>,
    params: Record<string, unknown> = {},
) {
    let min = control.min ?? 1;
    let max = control.max ?? min;

    const usesTeamSize = control.key === 'count' && template.id === 'STAFF_COUNT_BY_SHIFT';

    if (usesTeamSize) {
        const operator = getConstraintOptionType(params.operator);

        min = template.id === 'STAFF_COUNT_BY_SHIFT' && operator === 'MIN' ? 1 : 0;

        const nurseCount = new Set(
            (optionMap.nurse ?? []).map((option) => option.raw?.nurseId).filter((nurseId): nurseId is number => nurseId != null),
        ).size;

        if (nurseCount > 0) max = nurseCount;
    }

    return {min, max: Math.max(min, max)};
}

function getDefaultParams(
    template: TSoftRuleTemplate,
    optionMap: Record<string, TSelectOption[]> = {},
    rotationMode: TWardRotationMode = 'THREE',
): Record<string, unknown> {
    const configuredDefaults = {
        ...(DEFAULT_PARAMS_BY_TEMPLATE_CODE[template.id] ?? {}),
        ...(rotationMode === 'TWO' ? (TWO_SHIFT_DEFAULT_PARAMS_BY_TEMPLATE_CODE[template.id] ?? {}) : {}),
    };
    const params: Record<string, unknown> = {};

    template.controls.forEach((control) => {
        const configuredDefault = configuredDefaults[control.key];
        const configuredDefaultType = getConstraintOptionType(configuredDefault);
        const controlOptions = optionMap[control.optionsKey ?? ''] ?? [];
        const isConfiguredSelectDefaultAllowed =
            control.kind !== 'select' ||
            !controlOptions.length ||
            controlOptions.some((option) => getConstraintOptionType(option.raw ?? option.value) === configuredDefaultType);

        if (configuredDefault != null && isConfiguredSelectDefaultAllowed) {
            params[control.key] = configuredDefault;

            return;
        }

        if (control.kind === 'number') {
            params[control.key] = control.values?.[0] ?? control.min ?? 1;

            return;
        }

        if (control.kind === 'time') {
            params[control.key] = control.defaultValue ?? (control.key === 'endTime' ? '15:00' : '07:00');

            return;
        }

        if (control.kind === 'multiSelect') {
            const availableOptions = getEligibleNurseOptions(
                template,
                {...configuredDefaults, ...params},
                optionMap[control.optionsKey ?? ''] ?? [],
            );

            params[control.key] = availableOptions.slice(0, 1).map(getSelectOptionParamValue);

            return;
        }

        params[control.key] = control.defaultValue ?? getSelectOptionParamValue(optionMap[control.optionsKey ?? '']?.[0]);
    });

    template.controls.forEach((control) => {
        if (control.kind !== 'number') return;

        const {min, max} = getNumberBounds(template, control, optionMap, params);
        const value = Number(params[control.key]);

        params[control.key] = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
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

function clampNumberParams(template: TSoftRuleTemplate, params: Record<string, unknown>, optionMap: Record<string, TSelectOption[]>) {
    const next = normalizeNumberParams(template, params);

    template.controls.forEach((control) => {
        if (control.kind !== 'number') return;

        const value = Number(next[control.key]);
        const {min, max} = getNumberBounds(template, control, optionMap, next);

        next[control.key] = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
    });

    return next;
}

const RULE_PARAM_PRESENTATION_KEYS = new Set(['label', 'name', 'shortName', 'color']);

function sanitizeRuleParamValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sanitizeRuleParamValue);

    if (!value || typeof value !== 'object') return value;

    if (isConstraintOption(value)) {
        const record = value as Record<string, unknown>;
        const sanitized: Record<string, unknown> = {type: value.type};

        if (value.nurseId != null) sanitized.nurseId = value.nurseId;

        if (value.divisionNum != null) sanitized.divisionNum = value.divisionNum;

        if (value.wardShiftTypeId != null) sanitized.wardShiftTypeId = value.wardShiftTypeId;

        if (value.day != null) sanitized.day = value.day;

        if (value.code && value.type !== 'WARD_SHIFT_TYPE') sanitized.code = value.code;

        if (value.value) sanitized.value = value.value;

        Object.entries(record).forEach(([key, entryValue]) => {
            if (key === 'type' || key === 'code' || RULE_PARAM_PRESENTATION_KEYS.has(key)) return;

            if (entryValue == null || key in sanitized) return;

            sanitized[key] = sanitizeRuleParamValue(entryValue);
        });

        return sanitized;
    }

    return Object.fromEntries(
        Object.entries(value)
            .filter(([key]) => !RULE_PARAM_PRESENTATION_KEYS.has(key))
            .map(([key, entryValue]) => [key, sanitizeRuleParamValue(entryValue)]),
    );
}

function sortNurseIdParams(value: unknown) {
    if (!Array.isArray(value)) return value;

    return [...value].sort((left, right) => {
        const leftId = isConstraintOption(left) ? left.nurseId : Number(left);
        const rightId = isConstraintOption(right) ? right.nurseId : Number(right);

        if (leftId == null || !Number.isFinite(leftId)) return 1;

        if (rightId == null || !Number.isFinite(rightId)) return -1;

        return leftId - rightId;
    });
}

function sanitizeRuleParams(params: Record<string, unknown>) {
    const sanitized = sanitizeRuleParamValue(params) as Record<string, unknown>;

    if ('nurseIds' in sanitized) sanitized.nurseIds = sortNurseIdParams(sanitized.nurseIds);

    return sanitized;
}

function toSavedRule(rule: TShiftConstraintRuleDraft, index: number, template?: TSoftRuleTemplate) {
    const severity = isNurseShiftPreferenceSoftOnlyRule(rule.templateCode) ? 'SOFT' : rule.severity;

    return {
        shiftConstraintRuleId: rule.shiftConstraintRuleId,
        templateCode: rule.templateCode,
        severity,
        sortOrder: index + 1,
        params: sanitizeRuleParams(normalizeNumberParams(template, rule.params)),
        selected: rule.selected !== false,
        isImportant: severity === 'HARD',
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
        ...(previous?.warnings !== undefined ? {warnings: previous.warnings} : {}),
        rules: rules.map((rule, index) => ({
            shiftConstraintRuleId: rule.shiftConstraintRuleId,
            templateCode: rule.templateCode,
            category: rule.category,
            severity: isNurseShiftPreferenceSoftOnlyRule(rule.templateCode) ? 'SOFT' : rule.severity,
            sortOrder: index + 1,
            params: rule.params,
            selected: rule.selected !== false,
            isImportant: isNurseShiftPreferenceSoftOnlyRule(rule.templateCode) ? false : rule.severity === 'HARD',
            displayText: rule.displayText,
            isValid: rule.isValid,
            invalidReason: rule.invalidReason,
        })),
    };
}

function getOptionKey(option: TShiftConstraintOption) {
    if (option.nurseId != null) return `nurse-${option.nurseId}`;

    if (option.divisionNum != null) return `division-${option.divisionNum}`;

    if (option.wardShiftTypeId != null) return `shift-${option.wardShiftTypeId}`;

    if (option.day != null) return `day-${option.day}`;

    return `${option.type}-${option.value ?? option.label ?? option.name ?? option.code ?? ''}`;
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
            value: value.value,
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

function getEffectiveAllowedSeverities(
    template: TShiftConstraintTemplate | undefined,
    params: Record<string, unknown>,
): TShiftConstraintSeverity[] {
    if (template && isNurseShiftPreferenceSoftOnlyRule(template.templateCode)) {
        return ['SOFT'];
    }

    if (template && TARGET_SOFT_ONLY_TEMPLATE_CODES.has(template.templateCode) && getConstraintOptionType(params.operator) === 'TARGET') {
        return ['SOFT'];
    }

    const allowedSeverities = Array.from(
        new Set((template?.allowedSeverities ?? []).filter((severity) => severity === 'HARD' || severity === 'SOFT')),
    );

    return allowedSeverities.length ? allowedSeverities : ['HARD', 'SOFT'];
}

function normalizeRuleSeverity(
    rule: TShiftConstraintRuleDraft,
    template: TShiftConstraintTemplate | undefined,
    _rotationMode: TWardRotationMode,
): TShiftConstraintRuleDraft {
    if (isNurseShiftPreferenceSoftOnlyRule(rule.templateCode)) {
        return {
            ...rule,
            severity: 'SOFT',
            isImportant: false,
        };
    }

    const allowedSeverities = getEffectiveAllowedSeverities(template, rule.params);
    const severity = allowedSeverities.includes(rule.severity) ? rule.severity : (allowedSeverities[0] ?? rule.severity);

    return {
        ...rule,
        severity,
        isImportant: severity === 'HARD',
    };
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

    if (EXACT_STAFFING_COUNT_TEMPLATE_CODES.has(rule.templateCode)) return 'EXACT';

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

function hasStaffingCountConflict(rules: TShiftConstraintRuleDraft[], candidate: TShiftConstraintRuleDraft) {
    const candidateScope = getStaffingDuplicateDateScope(candidate);
    const candidateShift = getStaffingDuplicateShift(candidate);
    const relevantRules = [...rules, candidate].filter(
        (rule) =>
            STAFFING_COUNT_TEMPLATE_CODES.has(rule.templateCode) &&
            getStaffingDuplicateDateScope(rule) === candidateScope &&
            getStaffingDuplicateShift(rule) === candidateShift,
    );
    const valuesByOperator = new Map<string, number[]>();

    relevantRules.forEach((rule) => {
        const operator = getStaffingDuplicateOperator(rule);
        const count = Number(getStaffingDuplicateCount(rule));

        if (!operator || !Number.isFinite(count)) return;

        valuesByOperator.set(operator, [...(valuesByOperator.get(operator) ?? []), count]);
    });

    const minimum = Math.max(...(valuesByOperator.get('MIN') ?? [Number.NEGATIVE_INFINITY]));
    const maximum = Math.min(...(valuesByOperator.get('MAX') ?? [Number.POSITIVE_INFINITY]));
    const exactValues = new Set(valuesByOperator.get('EXACT') ?? []);

    if (Array.from(valuesByOperator.values()).some((values) => new Set(values).size > 1)) return true;

    if (minimum > maximum || exactValues.size > 1) return true;

    const exact = exactValues.values().next().value as number | undefined;

    return exact != null && (exact < minimum || exact > maximum);
}

function getSemanticDuplicateCount(value: unknown) {
    if (value == null || value === '') return null;

    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : String(value).trim();
}

function getAliasConstraintDuplicateKey(rule: TShiftConstraintRuleDraft) {
    const target = rule.params.target ?? ALL_CONSTRAINT_TARGET_OPTION;

    if (rule.templateCode === 'MAX_CONSECUTIVE_WORK_DAYS' || rule.templateCode === 'CORE_MAX_CONTINUOUS_WORK') {
        const count = getSemanticDuplicateCount(
            rule.params.count ?? rule.params.maxContinuousWorkDays ?? rule.params.maxDays ?? rule.params.days,
        );

        return count == null ? null : ['CORE_MAX_CONTINUOUS_WORK', stringifyDuplicateParams({target, count})].join('|');
    }

    if (rule.templateCode === 'MAX_CONSECUTIVE_N' || rule.templateCode === 'CORE_MAX_CONTINUOUS_NIGHT') {
        const count = getSemanticDuplicateCount(rule.params.count ?? rule.params.maxDays ?? rule.params.days);

        return count == null ? null : ['CORE_MAX_CONTINUOUS_NIGHT', stringifyDuplicateParams({target, count})].join('|');
    }

    if (rule.templateCode === 'MIN_OFF_AFTER_N' || rule.templateCode === 'CORE_MIN_OFF_AFTER_NIGHT') {
        const count = getSemanticDuplicateCount(rule.params.count ?? rule.params.minOffDays ?? rule.params.days);

        return count == null ? null : ['CORE_MIN_OFF_AFTER_NIGHT', stringifyDuplicateParams({target, count})].join('|');
    }

    if (rule.templateCode === 'OFF_AFTER_CONSECUTIVE_WORK' || rule.templateCode === 'MIN_OFF_AFTER_CONSECUTIVE_WORK') {
        const workCount = getSemanticDuplicateCount(
            rule.templateCode === 'OFF_AFTER_CONSECUTIVE_WORK' ? rule.params.count : rule.params.workCount,
        );
        const offCount = getSemanticDuplicateCount(rule.templateCode === 'OFF_AFTER_CONSECUTIVE_WORK' ? 1 : rule.params.offCount);

        return workCount == null || offCount == null
            ? null
            : ['MIN_OFF_AFTER_CONSECUTIVE_WORK', stringifyDuplicateParams({target, workCount, offCount})].join('|');
    }

    if (rule.templateCode === 'NURSE_FORBID_WEEKEND' || rule.templateCode === 'NURSE_MAX_WEEKEND_HOLIDAY_SHIFTS') {
        const isLegacy = rule.templateCode === 'NURSE_FORBID_WEEKEND';
        const weekendTarget = isLegacy ? (rule.params.nurse ?? rule.params.target) : rule.params.target;
        const shift = isLegacy ? {type: 'ALL'} : rule.params.shift;
        const period = isLegacy ? {type: 'MONTH'} : rule.params.period;
        const count = getSemanticDuplicateCount(isLegacy ? 0 : rule.params.count);

        if (weekendTarget == null || shift == null || period == null || count == null) return null;

        return ['NURSE_MAX_WEEKEND_HOLIDAY_SHIFTS', stringifyDuplicateParams({target: weekendTarget, shift, period, count})].join('|');
    }

    return null;
}

function getConstraintDuplicateKey(rule: TShiftConstraintRuleDraft) {
    const staffingDuplicateKey = getStaffingDuplicateKey(rule);

    if (staffingDuplicateKey) return staffingDuplicateKey;

    const aliasDuplicateKey = getAliasConstraintDuplicateKey(rule);

    if (aliasDuplicateKey) return aliasDuplicateKey;

    if (rule.templateCode === 'NURSE_PAIR_NOT_SAME_SHIFT' || rule.templateCode === 'NURSE_PAIR_PREFER_SAME_SHIFT') {
        const nursePair = [rule.params.nurseA, rule.params.nurseB]
            .map((value) => stringifyDuplicateParams({value}))
            .sort()
            .join('|');
        const rest = Object.fromEntries(Object.entries(rule.params).filter(([key]) => key !== 'nurseA' && key !== 'nurseB'));

        return [rule.templateCode, nursePair, stringifyDuplicateParams(rest)].join('|');
    }

    if (MIXED_SHIFT_TEMPLATE_CODES.has(rule.templateCode) && Array.isArray(rule.params.nurseIds)) {
        return [rule.templateCode, stringifyDuplicateParams({...rule.params, nurseIds: sortNurseIdParams(rule.params.nurseIds)})].join('|');
    }

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
        hasShiftAvailabilityConfig: left.hasShiftAvailabilityConfig ?? right.hasShiftAvailabilityConfig,
        canThreeShift: left.canThreeShift ?? right.canThreeShift,
        canTwoShift: left.canTwoShift ?? right.canTwoShift,
        divisionNum: left.divisionNum ?? right.divisionNum,
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

    if (option.divisionNum != null) return `DIVISION:${option.divisionNum}`;

    if (option.wardShiftTypeId != null) return String(option.wardShiftTypeId);

    if (option.day != null) return String(option.day);

    if (option.value) return option.value;

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
    if (optionMapKey === 'target') {
        return t('page.makeShift.constraints.option.allPeople');
    }

    if (optionMapKey === 'date' || optionMapKey === 'dayType') return t('page.makeShift.constraints.option.allDays');

    return t('page.makeShift.constraints.option.all');
}

function getLocalizedTypedOptionLabel(t: TTypedT, option: TShiftConstraintOption, optionMapKey: string) {
    const type = (option.value ?? option.code ?? option.type).trim().toUpperCase();

    if (optionMapKey === 'dateScope' || optionMapKey === 'dayType') {
        const dateScopeKeyByType: Record<string, TI18nKey> = {
            EVERYDAY: 'page.makeShift.constraints.option.everyday',
            WEEKDAY: 'page.makeShift.constraints.option.weekday',
            WEEKEND: 'page.makeShift.constraints.option.weekend',
            HOLIDAY: 'page.makeShift.constraints.option.holiday',
            WEEKEND_OR_HOLIDAY: 'page.makeShift.constraints.option.weekendOrHoliday',
            MONDAY: 'page.makeShift.constraints.option.weekdayName.monday',
            TUESDAY: 'page.makeShift.constraints.option.weekdayName.tuesday',
            WEDNESDAY: 'page.makeShift.constraints.option.weekdayName.wednesday',
            THURSDAY: 'page.makeShift.constraints.option.weekdayName.thursday',
            FRIDAY: 'page.makeShift.constraints.option.weekdayName.friday',
            SATURDAY: 'page.makeShift.constraints.option.weekdayName.saturday',
            SUNDAY: 'page.makeShift.constraints.option.weekdayName.sunday',
        };
        const key = dateScopeKeyByType[type];

        if (key) return t(key);
    }

    if (optionMapKey === 'staffCountOperator' || optionMapKey === 'lineOperator') {
        const operatorKeyByType: Record<string, TI18nKey> = {
            MIN: 'page.makeShift.constraints.option.staffCountOperator.min',
            MAX: 'page.makeShift.constraints.option.staffCountOperator.max',
            EXACT: 'page.makeShift.constraints.option.staffCountOperator.exact',
            TARGET: 'page.makeShift.constraints.option.staffCountOperator.target',
        };
        const key = operatorKeyByType[type];

        if (key) return t(key);
    }

    const mixedOptionKeyByMap: Record<string, Record<string, TI18nKey>> = {
        strategy: {
            THREE_BASE_FALLBACK_TWO: 'page.makeShift.constraints.mixed.strategy.threeBaseFallbackTwo',
            PLANNED_MIXED: 'page.makeShift.constraints.mixed.strategy.plannedMixed',
            PLANNED_MIXED_WITH_FALLBACK: 'page.makeShift.constraints.mixed.strategy.plannedMixedWithFallback',
        },
        participationMode: {
            THREE_ONLY: 'page.makeShift.constraints.mixed.participation.threeOnly',
            TWO_ONLY: 'page.makeShift.constraints.mixed.participation.twoOnly',
            FLEX: 'page.makeShift.constraints.mixed.participation.flex',
            FALLBACK_TWO: 'page.makeShift.constraints.mixed.participation.fallbackTwo',
        },
    };
    const mixedKey = mixedOptionKeyByMap[optionMapKey]?.[type];

    if (mixedKey) return t(mixedKey);

    const mixedFallbackLabelByMap: Record<string, Record<string, string>> = {
        mixedComposition: {
            BALANCED: '균형 편성',
            THREE_FIRST: '3교대 우선',
            TWO_FIRST: '2교대 우선',
            CLOSED: '폐쇄형',
            OPEN: '개방형',
        },
        assignmentAggregation: {
            PER_NURSE: '간호사별',
            GROUP_TOTAL: '그룹 합계',
        },
        twoShiftScope: {
            ALL_TWO: '모든 2교대',
            TWO_DAY: '2교대 주간',
            TWO_NIGHT: '2교대 야간',
        },
        workloadMetric: {
            TWO_ASSIGNMENTS: '2교대 횟수',
            WEEKEND_TWO_ASSIGNMENTS: '주말 2교대 횟수',
        },
    };
    const mixedFallbackLabel = mixedFallbackLabelByMap[optionMapKey]?.[type];

    if (mixedFallbackLabel) return mixedFallbackLabel;

    if (optionMapKey === 'period') {
        const periodKeyByType: Record<string, TI18nKey> = {
            DAY: 'page.makeShift.constraints.option.period.day',
            WEEK: 'page.makeShift.constraints.option.period.week',
            ROLLING_7_DAYS: 'page.makeShift.constraints.option.period.rollingSevenDays',
            MONTH: 'page.makeShift.constraints.option.period.month',
        };
        const key = periodKeyByType[type];

        if (key) return t(key);
    }

    if (optionMapKey === 'transitionDirection') {
        const transitionKeyByType: Record<string, TI18nKey> = {
            DAY_TO_NIGHT: 'page.makeShift.constraints.option.transition.dayToNight',
            NIGHT_TO_DAY: 'page.makeShift.constraints.option.transition.nightToDay',
            BOTH: 'page.makeShift.constraints.option.transition.both',
        };
        const key = transitionKeyByType[type];

        if (key) return t(key);
    }

    return null;
}

function getCandidateOptionLabel(t: TTypedT, option: TShiftConstraintOption, optionMapKey: string, shiftType?: TShiftTypeLike) {
    if (isAllCandidateOption(option)) return getLocalizedAllOptionLabel(t, optionMapKey);

    if (optionMapKey === 'date' && option.day != null) return t('page.makeShift.constraints.option.dayLabel', {day: option.day});

    if (optionMapKey === 'dateScope' && option.day != null) {
        return t('page.makeShift.constraints.option.monthlyDayLabel', {day: option.day});
    }

    const localizedLabel = getLocalizedTypedOptionLabel(t, option, optionMapKey);

    if (localizedLabel) return localizedLabel;

    if (option.label) return option.label;

    if (option.name) return option.name;

    if (option.code) return option.code;

    if (option.day != null) return t('page.makeShift.constraints.option.dayLabel', {day: option.day});

    return shiftType?.name ?? option.type;
}

function toSelectOption(option: TShiftConstraintOption, optionMapKey: string, shiftTypes: TShiftTypeLike[], t: TTypedT): TSelectOption {
    const shiftType =
        option.wardShiftTypeId != null ? shiftTypes.find((item) => item.wardShiftTypeId === option.wardShiftTypeId) : undefined;
    const isNamedTwoShiftDuty =
        optionMapKey === 'nightShift' ||
        optionMapKey === 'twoShiftNight' ||
        optionMapKey === 'twoShiftNightContinuation' ||
        optionMapKey === 'offShift';
    const isDuty = optionMapKey === 'duty' || optionMapKey === 'dutyStrict' || isNamedTwoShiftDuty;
    const label = isNamedTwoShiftDuty
        ? (shiftType?.name ?? option.name ?? getCandidateOptionLabel(t, option, optionMapKey, shiftType))
        : getCandidateOptionLabel(t, option, optionMapKey, shiftType);

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
        classification: shiftType?.classification ?? option.classification,
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
    const allTargetCandidates = getCandidateOptions(candidates, 'target', ['targets', 'TARGETS'], fallback.target, shiftTypes, t, {
        includeFallback: true,
    });
    const target = allTargetCandidates.filter((option) => {
        const type = option.raw?.type?.toUpperCase();

        return type !== 'ROTATING' && type !== 'NIGHT_DEDICATED';
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
    const transitionDirection = getCandidateOptions(
        candidates,
        'transitionDirection',
        ['transitionDirections', 'TRANSITION_DIRECTIONS'],
        fallback.transitionDirection ?? [],
        shiftTypes,
        t,
    );
    const period = getCandidateOptions(candidates, 'period', ['periods', 'PERIODS'], fallback.period ?? [], shiftTypes, t);
    const twoShiftNight = getCandidateOptions(
        candidates,
        'twoShiftNight',
        ['twoShiftNights', 'TWO_SHIFT_NIGHTS'],
        duty.filter((option) => option.classification === 'NIGHT'),
        shiftTypes,
        t,
    );
    const nightShift = getCandidateOptions(
        candidates,
        'nightShift',
        ['nightShifts', 'NIGHT_SHIFTS'],
        duty.filter((option) => option.classification === 'NIGHT'),
        shiftTypes,
        t,
    );
    const twoShiftNightContinuation = getCandidateOptions(
        candidates,
        'twoShiftNightContinuation',
        ['twoShiftNightContinuations', 'TWO_SHIFT_NIGHT_CONTINUATIONS'],
        duty.filter((option) => option.classification === 'NIGHT_CONTINUATION'),
        shiftTypes,
        t,
    );
    const offShift = getCandidateOptions(
        candidates,
        'offShift',
        ['offShifts', 'OFF_SHIFTS'],
        duty.filter((option) => option.classification === 'OFF' || option.isOff),
        shiftTypes,
        t,
    );
    const mixedOptions = (optionMapKey: string, candidateKeys: string[], includeFallback = false) =>
        getCandidateOptions(candidates, optionMapKey, candidateKeys, fallback[optionMapKey] ?? [], shiftTypes, t, {
            includeFallback,
        });

    return {
        target,
        duty,
        dutyReference: fallback.dutyReference ?? [],
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
        transitionDirection,
        period,
        nightShift,
        twoShiftNight,
        twoShiftNightContinuation,
        offShift,
        participationMode: mixedOptions(
            'participationMode',
            ['mixedParticipationModes', 'participationModes', 'PARTICIPATION_MODES'],
            true,
        ),
        strategy: mixedOptions('strategy', ['mixedStrategies', 'strategies', 'STRATEGIES'], true),
        mixedComposition: mixedOptions('mixedComposition', ['mixedCompositions', 'compositions', 'COMPOSITIONS'], true),
        lineOperator: mixedOptions('lineOperator', ['mixedLineOperators', 'lineOperators', 'LINE_OPERATORS'], true),
        assignmentAggregation: mixedOptions(
            'assignmentAggregation',
            ['mixedAssignmentAggregations', 'assignmentAggregations', 'ASSIGNMENT_AGGREGATIONS'],
            true,
        ),
        twoShiftScope: mixedOptions('twoShiftScope', ['mixedTwoShiftScopes', 'twoShiftScopes', 'TWO_SHIFT_SCOPES'], true),
        workloadMetric: mixedOptions('workloadMetric', ['mixedWorkloadMetrics', 'workloadMetrics', 'WORKLOAD_METRICS'], true),
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
    params: Record<string, unknown>,
    optionMap: Record<string, TSelectOption[]>,
) {
    const options = optionMap[control.optionsKey ?? ''] ?? [];
    const requiredMixedNurseMode =
        control.kind === 'multiSelect' && control.optionsKey === 'nurse' ? getRequiredMixedNurseMode(template, params) : null;
    const requiredMixedTargetMode =
        control.kind === 'select' && control.optionsKey === 'target' && template.id === 'MIXED_ROTATION_PARTICIPATION'
            ? getRequiredMixedNurseMode(template, params)
            : null;
    const resolvedOptions = requiredMixedNurseMode
        ? options.map((option) =>
              isNurseOptionEligibleForMode(option, requiredMixedNurseMode)
                  ? option
                  : {...option, disabledReasonKey: getNurseOptionUnavailableReasonKey(option, requiredMixedNurseMode)},
          )
        : requiredMixedTargetMode
          ? options.map((option) => {
                const disabledReasonKey = getTargetOptionUnavailableReasonKey(option, requiredMixedTargetMode, optionMap.nurse ?? []);

                return disabledReasonKey ? {...option, disabledReasonKey} : option;
            })
          : options;

    if (template.targetLockedToAll && control.optionsKey === 'target') {
        return resolvedOptions.filter(isAllSelectOption);
    }

    if (!template.category.includes('COMBINATION') || control.optionsKey !== 'nurse') return resolvedOptions;

    const controlIndex = template.controls.findIndex((item) => item.key === control.key);

    if (controlIndex <= 0) return resolvedOptions;

    const priorNurseLabels = new Set(
        template.controls
            .slice(0, controlIndex)
            .filter((item) => item.optionsKey === 'nurse')
            .map((item) => {
                const value = params[item.key];
                const selectedOption = resolvedOptions.find((option) => doesSelectOptionMatchValue(option, value));

                return selectedOption?.label ?? stringifyRuleParamValue(value);
            })
            .filter(Boolean),
    );

    if (!priorNurseLabels.size) return resolvedOptions;

    return resolvedOptions.filter((option) => !priorNurseLabels.has(option.label));
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

    if (control.kind === 'number' || control.kind === 'time') return stringValue;

    const options = optionMap[control.optionsKey ?? ''] ?? [];

    if (control.kind === 'multiSelect' && Array.isArray(value)) {
        return value
            .map((item) => options.find((option) => doesSelectOptionMatchValue(option, item))?.label ?? stringifyRuleParamValue(item))
            .filter(Boolean)
            .join(', ');
    }

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

    if (control.kind === 'number' || control.kind === 'time') {
        return params[control.key] ?? String(control.values?.[0] ?? control.min ?? 1);
    }

    const options = getOptionsForControl(control, template, params, optionMap);
    const value = params[control.key];

    if (!value) return options[0]?.label ?? '';

    return options.find((option) => doesSelectOptionMatchValue(option, value))?.label ?? value;
}

function getFixedTwoShiftDutyOption(template: TSoftRuleTemplate, control: TControlDef, optionMap: Record<string, TSelectOption[]>) {
    if (control.kind !== 'select') return undefined;

    if (FIXED_TWO_SHIFT_NIGHT_TEMPLATE_CODES.has(template.id) && control.key === 'nightShift' && control.optionsKey === 'twoShiftNight') {
        const options = optionMap.twoShiftNight ?? [];

        return options.find((option) => option.classification === 'NIGHT') ?? options[0];
    }

    if (
        FIXED_TWO_SHIFT_NIGHT_CONTINUATION_TEMPLATE_CODES.has(template.id) &&
        control.key === 'nightContinuationShift' &&
        control.optionsKey === 'twoShiftNightContinuation'
    ) {
        const options = optionMap.twoShiftNightContinuation ?? [];

        return options.find((option) => option.classification === 'NIGHT_CONTINUATION') ?? options[0];
    }

    return undefined;
}

function normalizeCombinationParams(
    template: TSoftRuleTemplate,
    params: Record<string, unknown>,
    optionMap: Record<string, TSelectOption[]>,
): Record<string, unknown> {
    const nextParams = {...params};

    template.controls.forEach((control) => {
        const fixedNightOption = getFixedTwoShiftDutyOption(template, control, optionMap);

        if (fixedNightOption) nextParams[control.key] = getSelectOptionParamValue(fixedNightOption);
    });

    const mixedNurseControl = template.controls.find(
        (control) => control.kind === 'multiSelect' && control.optionsKey === 'nurse' && control.key === 'nurseIds',
    );

    if (mixedNurseControl) {
        const nurseOptions = optionMap.nurse ?? [];
        const eligibleOptions = getEligibleNurseOptions(template, nextParams, nurseOptions);
        const currentValues = Array.isArray(nextParams.nurseIds) ? nextParams.nurseIds : [];
        const selectedOptions = currentValues
            .map((value) => eligibleOptions.find((option) => doesSelectOptionMatchValue(option, value)))
            .filter((option): option is TSelectOption => Boolean(option));
        const minimumSelectionCount = template.id === 'MIXED_SHIFT_WORKLOAD_BALANCE' ? 2 : 1;

        if (
            selectedOptions.length < Math.min(minimumSelectionCount, eligibleOptions.length) ||
            selectedOptions.length < currentValues.length
        ) {
            const selectedIds = new Set(selectedOptions.map((option) => option.value));

            eligibleOptions.forEach((option) => {
                if (selectedOptions.length >= minimumSelectionCount || selectedIds.has(option.value)) return;

                selectedOptions.push(option);
                selectedIds.add(option.value);
            });
            nextParams.nurseIds = selectedOptions.map(getSelectOptionParamValue);
        }
    }

    if (!template.category.includes('COMBINATION')) return nextParams;

    const nurseControls = template.controls.filter((control) => control.optionsKey === 'nurse');
    const nurseOptions = optionMap.nurse ?? [];

    if (nurseControls.length <= 1 || nurseOptions.length <= 1) return nextParams;

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
    ariaLabel?: string;
    onChange: (option: TSelectOption) => void;
};

function InlineDropdown({value, options, minWidth = 72, ariaLabel, onChange}: TInlineDropdownProps) {
    const {t} = useTypedTranslation();
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
                aria-label={ariaLabel}
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
                          aria-label={ariaLabel}
                          style={menuStyle}
                          className={`dropdown-scrollbar-visible fixed z-[2147483647] max-h-[220px] animate-in overflow-y-auto rounded-[10px] border border-gray-6 bg-white py-1 shadow-[0px_10px_28px_rgba(95,100,135,0.16)] duration-150 fade-in-0 zoom-in-95 ${
                              openUpward ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1'
                          }`}
                      >
                          {options.map((option) => {
                              const isSelected = option.label === selected?.label;
                              const disabledReason = option.disabledReasonKey ? t(option.disabledReasonKey) : null;
                              const disabled = Boolean(disabledReason && !isSelected);

                              return (
                                  <button
                                      key={option.value}
                                      type="button"
                                      role="option"
                                      aria-selected={isSelected}
                                      aria-disabled={disabled}
                                      disabled={disabled}
                                      title={disabledReason ?? undefined}
                                      className={cn(
                                          'flex w-full cursor-pointer items-center px-3 py-2 font-apple text-[14px] whitespace-nowrap transition-colors hover:bg-gray-7 focus-visible:outline-2 focus-visible:outline-main-1',
                                          alignOptionsLeft ? 'justify-start text-left' : 'justify-center text-center',
                                          isSelected ? 'bg-main-light font-semibold text-main-1' : 'text-sub-1',
                                          disabled ? 'cursor-not-allowed text-gray-4 opacity-55 hover:bg-transparent' : null,
                                      )}
                                      onClick={() => {
                                          if (disabled) return;

                                          onChange(option);
                                          setOpen(false);
                                      }}
                                  >
                                      <SelectOptionContent option={option} />
                                      {disabledReason ? (
                                          <span className="ml-2 shrink-0 rounded-full bg-gray-7 px-1.5 py-0.5 text-[11px] font-semibold text-gray-4">
                                              {disabledReason}
                                          </span>
                                      ) : null}
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

function InlineMultiSelect({
    values,
    options,
    accessibleLabel,
    onChange,
}: {
    values: unknown[];
    options: TSelectOption[];
    accessibleLabel: string;
    onChange: (values: unknown[]) => void;
}) {
    const {t} = useTypedTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selectedOptionKeys = new Set(
        values.map((value) => {
            if (isConstraintOption(value)) return getCandidateOptionValue(value);

            return String(value);
        }),
    );
    const selectedOptions = options.filter((option) => selectedOptionKeys.has(option.value));
    const selectedText = selectedOptions.map((option) => option.label).join(', ') || '-';

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!ref.current?.contains(event.target as Node)) setOpen(false);
        };

        document.addEventListener('mousedown', handlePointerDown);

        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [open]);

    return (
        <div ref={ref} className="relative inline-flex">
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`${accessibleLabel}: ${selectedText}`}
                onClick={() => setOpen((current) => !current)}
                className="inline-flex h-8 min-w-32 cursor-pointer items-center justify-between gap-1.5 rounded-[8px] bg-white px-2.5 font-apple text-[14px] font-semibold text-main-1 ring-1 ring-main-4"
            >
                <span className="max-w-48 truncate">{selectedText}</span>
                <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open ? (
                <div
                    role="listbox"
                    aria-multiselectable="true"
                    aria-label={accessibleLabel}
                    className="dropdown-scrollbar-visible absolute top-10 left-0 z-50 max-h-56 min-w-48 overflow-y-auto rounded-[10px] bg-white py-1 ring-1 ring-gray-6"
                >
                    {options.map((option) => {
                        const selected = selectedOptionKeys.has(option.value);
                        const disabledReason = option.disabledReasonKey ? t(option.disabledReasonKey) : null;
                        const disabled = Boolean(disabledReason && !selected);

                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                aria-disabled={disabled}
                                disabled={disabled}
                                title={disabledReason ?? undefined}
                                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left font-apple text-[14px] ${
                                    selected
                                        ? 'bg-main-light font-semibold text-main-1'
                                        : disabled
                                          ? 'cursor-not-allowed text-gray-4 opacity-65'
                                          : 'text-sub-1 hover:bg-gray-7'
                                }`}
                                onClick={() => {
                                    const nextValue = getSelectOptionParamValue(option);

                                    onChange(
                                        selected
                                            ? values.filter((value) => {
                                                  if (isConstraintOption(value)) return getCandidateOptionValue(value) !== option.value;

                                                  return String(value) !== option.value;
                                              })
                                            : [...values, nextValue],
                                    );
                                }}
                            >
                                <span className="min-w-0">
                                    <span className="block truncate">
                                        <SelectOptionContent option={option} />
                                    </span>
                                    {disabledReason ? (
                                        <span className="mt-0.5 block text-[11px] leading-4 font-medium text-gray-4">{disabledReason}</span>
                                    ) : null}
                                </span>
                                <span aria-hidden="true">{selected ? '✓' : ''}</span>
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

function InlineNumberInput({
    value,
    min,
    max,
    accessibleLabel,
    onChange,
}: {
    value: number;
    min: number;
    max: number;
    accessibleLabel: string;
    onChange: (value: number) => void;
}) {
    const [inputValue, setInputValue] = useState(String(value));
    const isEditingRef = useRef(false);

    useEffect(() => {
        if (!isEditingRef.current) setInputValue(String(value));
    }, [value]);

    const commitInputValue = () => {
        const numericValue = Number(inputValue);
        const nextValue = inputValue.trim() && Number.isFinite(numericValue) ? Math.min(max, Math.max(min, numericValue)) : value;

        setInputValue(String(nextValue));
        onChange(nextValue);
    };

    return (
        <input
            type="number"
            value={inputValue}
            min={min}
            max={max}
            inputMode="numeric"
            aria-label={accessibleLabel}
            onFocus={(event) => {
                isEditingRef.current = true;
                event.currentTarget.select();
            }}
            onChange={(event) => {
                const nextInputValue = event.currentTarget.value;
                const next = event.currentTarget.valueAsNumber;

                setInputValue(nextInputValue);

                if (Number.isFinite(next) && next >= min && next <= max) onChange(next);
            }}
            onBlur={() => {
                isEditingRef.current = false;
                commitInputValue();
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    commitInputValue();
                    event.currentTarget.blur();
                }

                if (event.key === 'Escape') {
                    event.preventDefault();
                    setInputValue(String(value));
                    event.currentTarget.blur();
                }
            }}
            className="h-8 w-[58px] rounded-[8px] bg-white px-2 text-center font-apple text-[14px] font-semibold text-main-1 ring-1 ring-main-4 focus-visible:ring-2 focus-visible:ring-main-1/25 focus-visible:outline-none"
        />
    );
}

function parseInlineTimeValue(value: string) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);

    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

    return {
        hour,
        minute,
        value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    };
}

function formatInlineTimeLabel(value: string, locale: string) {
    const parsed = parseInlineTimeValue(value);

    if (!parsed) return value || '--:--';

    try {
        return new Intl.DateTimeFormat(locale, {hour: '2-digit', minute: '2-digit', hour12: true}).format(
            new Date(2026, 0, 1, parsed.hour, parsed.minute),
        );
    } catch {
        const period = parsed.hour < 12 ? '오전' : '오후';
        const displayHour = parsed.hour % 12 || 12;

        return `${period} ${String(displayHour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`;
    }
}

function compareInlineTimeValues(left: string, right: string) {
    const leftParsed = parseInlineTimeValue(left);
    const rightParsed = parseInlineTimeValue(right);

    return (leftParsed?.hour ?? 0) * 60 + (leftParsed?.minute ?? 0) - ((rightParsed?.hour ?? 0) * 60 + (rightParsed?.minute ?? 0));
}

function getInlineTimeOptions(value: string, locale: string): TTimeOption[] {
    const options = Array.from({length: (24 * 60) / INLINE_TIME_OPTION_INTERVAL_MINUTES}, (_, index) => {
        const totalMinutes = index * INLINE_TIME_OPTION_INTERVAL_MINUTES;
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;
        const optionValue = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

        return {value: optionValue, label: formatInlineTimeLabel(optionValue, locale)};
    });
    const parsedValue = parseInlineTimeValue(value);

    if (parsedValue && !options.some((option) => option.value === parsedValue.value)) {
        options.push({value: parsedValue.value, label: formatInlineTimeLabel(parsedValue.value, locale)});
        options.sort((left, right) => compareInlineTimeValues(left.value, right.value));
    }

    return options;
}

function InlineTimeInput({value, label, onChange}: {value: string; label: string; onChange: (value: string) => void}) {
    const {i18n} = useTranslation();
    const locale = i18n.resolvedLanguage ?? i18n.language ?? 'ko';
    const selectedValue = parseInlineTimeValue(value)?.value ?? value;
    const options = useMemo(() => getInlineTimeOptions(selectedValue, locale), [locale, selectedValue]);
    const selectedLabel = formatInlineTimeLabel(selectedValue, locale);
    const [open, setOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{left: number; top?: number; bottom?: number; minWidth: number} | null>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const updateMenuPosition = useCallback(() => {
        if (!triggerRef.current) return;

        const rect = triggerRef.current.getBoundingClientRect();
        const estimatedMenuHeight = Math.min(INLINE_TIME_MENU_MAX_HEIGHT, Math.max(44, options.length * 38 + 8));
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const nextOpenUpward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
        const minWidth = Math.max(rect.width, 126);
        const left = Math.max(
            INLINE_TIME_MENU_VIEWPORT_PADDING,
            Math.min(rect.left, window.innerWidth - minWidth - INLINE_TIME_MENU_VIEWPORT_PADDING),
        );

        setOpenUpward(nextOpenUpward);
        setMenuPosition(
            nextOpenUpward ? {left, bottom: window.innerHeight - rect.top + 4, minWidth} : {left, top: rect.bottom + 4, minWidth},
        );
    }, [options.length]);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (triggerRef.current?.contains(event.target as Node) || menuRef.current?.contains(event.target as Node)) return;

            setOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };

        updateMenuPosition();
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [open, updateMenuPosition]);

    useEffect(() => {
        if (!open || !menuRef.current) return;

        menuRef.current.querySelector<HTMLElement>('[data-selected-time="true"]')?.scrollIntoView({block: 'nearest'});
    }, [open, selectedValue]);

    const menuStyle = menuPosition
        ? {
              left: `${menuPosition.left}px`,
              minWidth: `${menuPosition.minWidth}px`,
              ...(openUpward ? {bottom: `${menuPosition.bottom}px`} : {top: `${menuPosition.top}px`}),
          }
        : undefined;

    return (
        <div ref={triggerRef} className="relative inline-flex">
            <button
                type="button"
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={label}
                aria-valuetext={selectedLabel}
                value={selectedValue}
                onClick={() => {
                    if (!open) updateMenuPosition();

                    setOpen((previous) => !previous);
                }}
                className="inline-flex h-8 min-w-[126px] cursor-pointer items-center justify-between gap-1.5 rounded-[8px] bg-white px-2.5 font-apple text-[14px] font-semibold text-main-1 ring-1 ring-main-4 transition-[box-shadow,background-color] hover:bg-[#FBFAFF] focus-visible:ring-2 focus-visible:ring-main-1/25 focus-visible:outline-none"
            >
                <span className="tabular-nums">{selectedLabel}</span>
                <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {open && menuPosition && typeof document !== 'undefined'
                ? createPortal(
                      <div
                          ref={menuRef}
                          role="listbox"
                          aria-label={label}
                          style={menuStyle}
                          className={`fixed z-[2147483647] max-h-[240px] animate-in overflow-y-auto rounded-[10px] border border-gray-6 bg-white py-1 shadow-[0px_10px_28px_rgba(95,100,135,0.16)] duration-150 fade-in-0 zoom-in-95 ${
                              openUpward ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1'
                          }`}
                      >
                          {options.map((option) => {
                              const isSelected = option.value === selectedValue;

                              return (
                                  <button
                                      key={option.value}
                                      type="button"
                                      role="option"
                                      aria-selected={isSelected}
                                      data-selected-time={isSelected ? 'true' : undefined}
                                      className={`flex min-h-9 w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left font-apple text-[14px] leading-[1.4] whitespace-nowrap transition-colors hover:bg-gray-7 focus-visible:outline-2 focus-visible:outline-main-1 ${
                                          isSelected ? 'bg-main-light font-semibold text-main-1' : 'text-sub-1'
                                      }`}
                                      onClick={() => {
                                          onChange(option.value);
                                          setOpen(false);
                                      }}
                                  >
                                      <span className="tabular-nums">{option.label}</span>
                                      <span
                                          className={`size-1.5 shrink-0 rounded-full ${isSelected ? 'bg-main-1' : 'bg-transparent'}`}
                                          aria-hidden="true"
                                      />
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
    const {t} = useTypedTranslation();
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
                    const option = findDutyOptionByCode(
                        [...(optionMap.duty ?? []), ...(optionMap.dutyStrict ?? []), ...(optionMap.dutyReference ?? [])],
                        part.code,
                    );

                    if (!option) return null;

                    return <DutyTypeBadge key={`${template.id}-duty-${part.code}-${idx}`} option={option} />;
                }

                if (part.type === 'dutyPattern') {
                    const options = part.codes
                        .map((code) =>
                            findDutyOptionByCode(
                                [...(optionMap.duty ?? []), ...(optionMap.dutyStrict ?? []), ...(optionMap.dutyReference ?? [])],
                                code,
                            ),
                        )
                        .filter((option): option is TSelectOption => Boolean(option));

                    return <DutyPatternBadge key={`${template.id}-pattern-${idx}`} options={options} />;
                }

                if (part.type === 'dutyClassification') {
                    const fallbackLabel = DUTY_CLASSIFICATION_FALLBACK_BY_CLASSIFICATION[part.classification] ?? part.classification;
                    const option = [...(optionMap.duty ?? []), ...(optionMap.dutyStrict ?? []), ...(optionMap.dutyReference ?? [])].find(
                        (candidate) => candidate.classification === part.classification,
                    ) ?? {
                        value: part.classification,
                        label: fallbackLabel,
                        kind: 'duty' as const,
                        shortName: fallbackLabel,
                        name: fallbackLabel,
                        color: '#3580FF',
                        classification: part.classification,
                    };

                    return <DutyTypeBadge key={`${template.id}-classification-${part.classification}-${idx}`} option={option} />;
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

                const accessibleLabel = getControlAccessibleLabel(t, template, control);

                if (control.kind === 'number') {
                    const {min, max} = getNumberBounds(template, control, optionMap, params);
                    const values = control.values;
                    const displayValue = getControlDisplayValue(control, template, displayParams, optionMap);
                    const current = Number(displayValue === '' ? (values?.[0] ?? min) : displayValue);

                    return values ? (
                        <InlineDropdown
                            key={`${template.id}-${control.key}-${idx}`}
                            value={String(current)}
                            options={values.map((v) => ({value: String(v), label: String(v)}))}
                            minWidth={58}
                            ariaLabel={accessibleLabel}
                            onChange={(nextOption) => onParamChange(control.key, Number(nextOption.value))}
                        />
                    ) : (
                        <InlineNumberInput
                            key={`${template.id}-${control.key}-${idx}`}
                            value={Math.min(max, Math.max(min, current))}
                            min={min}
                            max={max}
                            accessibleLabel={accessibleLabel}
                            onChange={(value) => onParamChange(control.key, value)}
                        />
                    );
                }

                if (control.kind === 'time') {
                    return (
                        <InlineTimeInput
                            key={`${template.id}-${control.key}-${idx}`}
                            value={String(params[control.key] ?? control.defaultValue ?? '')}
                            label={accessibleLabel}
                            onChange={(value) => onParamChange(control.key, value)}
                        />
                    );
                }

                if (control.kind === 'multiSelect') {
                    return (
                        <InlineMultiSelect
                            key={`${template.id}-${control.key}-${idx}`}
                            values={Array.isArray(params[control.key]) ? (params[control.key] as unknown[]) : []}
                            options={getOptionsForControl(control, template, params, optionMap)}
                            accessibleLabel={accessibleLabel}
                            onChange={(values) => onParamChange(control.key, values)}
                        />
                    );
                }

                const options = getOptionsForControl(control, template, params, optionMap);
                const selected = getControlDisplayValue(control, template, displayParams, optionMap);
                const fixedNightOption = getFixedTwoShiftDutyOption(template, control, optionMap);

                if (fixedNightOption) {
                    return <DutyTypeBadge key={`${template.id}-${control.key}-${idx}`} option={fixedNightOption} />;
                }

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
    const {t} = useTypedTranslation();

    if (slot.inputType === 'NUMBER') {
        const numberValue = typeof value === 'number' ? value : (slot.min ?? 1);
        const values = Array.from({length: (slot.max ?? 10) - (slot.min ?? 1) + 1}, (_, i) => (slot.min ?? 1) + i);

        return (
            <InlineDropdown
                value={String(numberValue)}
                options={values.map((v) => ({value: String(v), label: String(v)}))}
                minWidth={58}
                ariaLabel={t('page.makeShift.constraints.accessibility.field.number')}
                onChange={(nextOption) => onChange(Number(nextOption.value))}
            />
        );
    }

    if (slot.inputType.toUpperCase() === 'TIME') {
        return (
            <InlineTimeInput
                value={typeof value === 'string' ? value : String(slot.defaultValue ?? '')}
                label={t('page.makeShift.constraints.accessibility.field.time')}
                onChange={onChange}
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
    isSeverityLocked?: boolean;
    onDelete: () => void;
    onToggleImportant: (next: boolean) => void;
    onParamChange: (key: string, value: unknown) => void;
    onSoftParamChange: (template: TSoftRuleTemplate, key: string, value: unknown) => void;
};

function ImportantToggle({
    checked,
    isRecommended,
    isBlocked = false,
    onChange,
}: {
    checked: boolean;
    isRecommended: boolean;
    isBlocked?: boolean;
    onChange: (next: boolean) => void;
}) {
    const {t} = useTypedTranslation();

    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-disabled={isBlocked || undefined}
            aria-label={checked ? t('page.makeShift.constraints.important.ariaRemove') : t('page.makeShift.constraints.important.ariaMark')}
            title={
                isBlocked
                    ? t('page.makeShift.constraints.toast.nurseShiftPreferenceImportantBlocked')
                    : isRecommended
                      ? t('page.makeShift.constraints.important.recommendedTitle')
                      : t('page.makeShift.constraints.important.ariaMark')
            }
            onClick={() => onChange(!checked)}
            className={`mr-6 inline-flex h-6 min-w-10 shrink-0 cursor-pointer items-center justify-center rounded-full px-2.5 font-apple text-[12px] font-bold whitespace-nowrap ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-main-1/25 focus-visible:outline-none ${
                isBlocked
                    ? 'cursor-not-allowed bg-white text-gray-4 ring-gray-6 hover:bg-gray-7'
                    : checked
                      ? 'bg-[#FFF3D6] text-[#B86E00] ring-[#FFD88A] hover:bg-[#FFE9AE]'
                      : 'bg-white text-gray-4 ring-gray-6 hover:bg-gray-7 hover:text-sub-1'
            }`}
        >
            {t('page.makeShift.constraints.important.label')}
        </button>
    );
}

function StaticImportantBadge({isRecommended}: {isRecommended: boolean}) {
    const {t} = useTypedTranslation();

    return (
        <span
            title={
                isRecommended
                    ? t('page.makeShift.constraints.important.recommendedTitle')
                    : t('page.makeShift.constraints.important.ariaMark')
            }
            className="mr-6 inline-flex h-6 min-w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF3D6] px-2.5 font-apple text-[12px] font-bold whitespace-nowrap text-[#B86E00] ring-1 ring-[#FFD88A]"
        >
            {t('page.makeShift.constraints.important.label')}
        </span>
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
    isSeverityLocked = false,
    onDelete,
    onToggleImportant,
    onParamChange,
    onSoftParamChange,
}: TRuleRowProps) {
    const {t} = useTypedTranslation();
    const slots = template?.slots ?? [];
    const isImportantBlocked = isNurseShiftPreferenceSoftOnlyRule(rule.templateCode);
    const canChangeSeverity = !isImportantBlocked && !isSeverityLocked && getEffectiveAllowedSeverities(template, rule.params).length > 1;

    return (
        <div
            id={getConstraintRuleRowId(rule.clientId)}
            data-constraint-rule-id={rule.clientId}
            className={`grid min-h-[52px] grid-cols-[minmax(0,1fr)_34px] items-center gap-3 rounded-[10px] bg-white px-3 py-2.5 transition-colors ${
                highlighted ? 'shadow-[0_0_0_2px_rgba(127,93,255,0.10)] ring-2 ring-main-1/55' : ''
            }`}
        >
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 pl-2">
                {isImportantBlocked ? (
                    <ImportantToggle checked={isImportant} isRecommended={isRecommended} isBlocked onChange={onToggleImportant} />
                ) : canChangeSeverity ? (
                    <ImportantToggle checked={isImportant} isRecommended={isRecommended} onChange={onToggleImportant} />
                ) : isImportant ? (
                    <StaticImportantBadge isRecommended={isRecommended} />
                ) : null}
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
    rotationMode: TWardRotationMode;
    onClose: () => void;
    onAdd: (template: TSoftRuleTemplate, params: Record<string, unknown>) => void;
};

const CONSTRAINT_DIALOG_FOCUSABLE_SELECTOR =
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function getSoftRuleAddIssue(
    template: TSoftRuleTemplate,
    params: Record<string, unknown>,
    _optionMap: Record<string, TSelectOption[]> = {},
): TI18nKey | null {
    const selectedNurseCount = Array.isArray(params.nurseIds) ? params.nurseIds.length : 0;
    const minimumNurseCount = template.id === 'MIXED_SHIFT_WORKLOAD_BALANCE' ? 2 : 1;

    if (
        template.controls.some((control) => control.kind === 'multiSelect' && control.key === 'nurseIds') &&
        selectedNurseCount < minimumNurseCount
    ) {
        return 'page.makeShift.constraints.mixed.validation.selectEligibleNurse';
    }

    return null;
}

function SoftRuleModal({open, templates, optionMap, rotationMode, onClose, onAdd}: TSoftModalProps) {
    const {t} = useTypedTranslation();
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const scrollRegionRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    const recommendedTemplates = useMemo(() => {
        const filtered = templates.filter((template) => template.isRecommended);
        const order =
            rotationMode === 'TWO'
                ? TWO_SHIFT_RECOMMENDED_RULE_ORDER
                : rotationMode === 'MIXED'
                  ? MIXED_SHIFT_RECOMMENDED_RULE_ORDER
                  : THREE_SHIFT_RECOMMENDED_RULE_ORDER;
        const indexByCode = new Map<string, number>(order.map((templateCode, index) => [templateCode, index]));

        return [...filtered].sort(
            (left, right) => (indexByCode.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (indexByCode.get(right.id) ?? Number.MAX_SAFE_INTEGER),
        );
    }, [rotationMode, templates]);
    const categories = useMemo<TModalCategory[]>(() => {
        const normalCategories = Array.from(
            new Set(templates.map((template) => template.category).filter((category) => !isRecommendedOnlyCategory(category))),
        );
        const categoryOrder = rotationMode === 'MIXED' ? MIXED_MODAL_CATEGORY_ORDER : ROTATION_MODAL_CATEGORY_ORDER;
        const orderedCategories = [...normalCategories].sort((left, right) => {
            const leftIndex = categoryOrder.indexOf(left);
            const rightIndex = categoryOrder.indexOf(right);

            return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
        });

        return recommendedTemplates.length ? [RECOMMENDED_MODAL_CATEGORY, ...orderedCategories] : orderedCategories;
    }, [recommendedTemplates.length, rotationMode, templates]);
    const [selectedCategory, setSelectedCategory] = useState<TModalCategory>(RECOMMENDED_MODAL_CATEGORY);
    const [draftParams, setDraftParams] = useState<Record<string, Record<string, unknown>>>({});
    const [hasMoreBelow, setHasMoreBelow] = useState(false);
    const updateScrollHint = useCallback(() => {
        const scrollRegion = scrollRegionRef.current;

        if (!scrollRegion) return;

        setHasMoreBelow(scrollRegion.scrollHeight - scrollRegion.scrollTop - scrollRegion.clientHeight > 8);
    }, []);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return;

        const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCloseRef.current();

                return;
            }

            if (event.key !== 'Tab' || !dialogRef.current) return;

            const focusableElements = Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(CONSTRAINT_DIALOG_FOCUSABLE_SELECTOR),
            ).filter((element) => element.getAttribute('aria-hidden') !== 'true');

            if (!focusableElements.length) {
                event.preventDefault();
                dialogRef.current.focus();

                return;
            }

            const firstElement = focusableElements[0]!;
            const lastElement = focusableElements[focusableElements.length - 1]!;
            const activeElement = document.activeElement;
            const focusIsOutsideDialog = !(activeElement instanceof Node) || !dialogRef.current.contains(activeElement);

            if (event.shiftKey && (activeElement === firstElement || focusIsOutsideDialog)) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && (activeElement === lastElement || focusIsOutsideDialog)) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('keydown', handleKeyDown);

            if (previousActiveElement?.isConnected) previousActiveElement.focus();
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;

        const next: Record<string, Record<string, unknown>> = {};

        templates.forEach((template) => {
            const params = getDefaultParams(template, optionMap, rotationMode);

            next[template.id] = normalizeCombinationParams(template, params, optionMap);
        });
        setDraftParams(next);
        setSelectedCategory(categories[0] ?? 'STAFFING');
    }, [categories, open, optionMap, rotationMode, templates]);

    useEffect(() => {
        if (!open) return;

        const frame = window.requestAnimationFrame(updateScrollHint);
        const scrollRegion = scrollRegionRef.current;
        const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollHint);

        if (scrollRegion) resizeObserver?.observe(scrollRegion);

        return () => {
            window.cancelAnimationFrame(frame);
            resizeObserver?.disconnect();
        };
    }, [open, selectedCategory, templates, updateScrollHint]);

    if (!open) return null;

    const visibleTemplates =
        selectedCategory === RECOMMENDED_MODAL_CATEGORY
            ? recommendedTemplates
            : templates.filter((template) => template.category === selectedCategory);

    return (
        <ConstraintModalPortal>
            <div className="fixed inset-0 z-[1300] flex items-center justify-center overflow-y-auto bg-black/30 px-4 py-4">
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="constraint-add-dialog-title"
                    aria-describedby="constraint-add-dialog-description"
                    tabIndex={-1}
                    className="relative flex h-[min(90dvh,900px)] max-h-[calc(100dvh-1rem)] w-full max-w-[960px] flex-col overflow-hidden rounded-[18px] bg-white"
                >
                    <div className="flex shrink-0 items-start justify-between px-6 pt-6 pb-4">
                        <div>
                            <p id="constraint-add-dialog-title" className="font-apple text-[28px] font-bold text-sub-1">
                                {t('page.makeShift.constraints.modal.title')}
                            </p>
                            <p id="constraint-add-dialog-description" className="mt-1 font-apple text-[13px] font-medium text-gray-4">
                                {t('page.makeShift.constraints.modal.description')}
                            </p>
                        </div>
                        <button
                            ref={closeButtonRef}
                            type="button"
                            onClick={onClose}
                            className="grid size-11 cursor-pointer place-items-center rounded-full text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1"
                            aria-label={t('page.makeShift.constraints.modal.close')}
                        >
                            <X className="size-5" />
                        </button>
                    </div>

                    <div className="mx-6 flex shrink-0 gap-2 overflow-x-auto pb-2">
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
                                {getCategoryLabel(t, category, rotationMode)}
                            </button>
                        ))}
                    </div>

                    <div
                        ref={scrollRegionRef}
                        data-constraint-modal-scroll="true"
                        onScroll={updateScrollHint}
                        className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-6 pr-2 pb-14 [scrollbar-color:#8C83D8_#EEF0F4] [scrollbar-gutter:stable] [scrollbar-width:auto] [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#8C83D8] [&::-webkit-scrollbar-thumb:hover]:bg-main-1 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-[#EEF0F4]"
                    >
                        {visibleTemplates.map((template) => {
                            const templateParams = draftParams[template.id] ?? {};
                            const addDescription = template.buildText(normalizeSoftRuleParams(template, templateParams, optionMap));
                            const addIssue = getSoftRuleAddIssue(template, templateParams, optionMap);
                            const canAdd = addIssue === null;
                            const addIssueId = `constraint-add-issue-${template.id}`;

                            return (
                                <div
                                    key={template.id}
                                    data-constraint-template-card={template.id}
                                    className="flex items-center gap-2.5 rounded-[10px] bg-gray-7 px-3 py-1.5 transition-colors hover:bg-gray-6/70"
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
                                        {addIssue ? (
                                            <p
                                                id={addIssueId}
                                                className="mt-1 font-apple text-[11px] leading-4 font-semibold text-[#A35B00]"
                                            >
                                                {t(addIssue)}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <button
                                            type="button"
                                            disabled={!canAdd}
                                            onClick={() => onAdd(template, templateParams)}
                                            className="group inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-white transition-colors hover:bg-main-light focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                            aria-label={`${t('page.makeShift.constraints.modal.addAria')}: ${addDescription}`}
                                            aria-describedby={addIssue ? addIssueId : undefined}
                                            title={t('page.makeShift.constraints.modal.addTitle')}
                                        >
                                            <span className="inline-flex size-8 items-center justify-center rounded-full bg-main-1 transition-colors group-hover:bg-main-1-hover group-disabled:bg-gray-5">
                                                <Plus className="size-3.5" />
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {hasMoreBelow ? (
                        <div
                            data-constraint-scroll-hint="true"
                            className="pointer-events-none absolute bottom-3 left-1/2 grid size-8 -translate-x-1/2 place-items-center rounded-full bg-main-light text-main-1"
                            aria-hidden="true"
                        >
                            <ChevronDown className="size-4" />
                        </div>
                    ) : null}
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
    const recommendedDefaultsSeedKeyRef = useRef<string | null>(null);
    const languageQueryKey = i18n.resolvedLanguage ?? i18n.language ?? 'default';
    const rulesQueryKey = shiftConstraintRuleQueryKeys.rules(wardId ?? -1, currentShiftTeamId ?? -1, languageQueryKey);
    const candidatesQuery = useQuery({
        queryKey: shiftConstraintRuleQueryKeys.candidates(wardId ?? -1, currentShiftTeamId ?? -1, languageQueryKey),
        queryFn: () => getShiftConstraintRuleCandidates(wardId ?? -1, currentShiftTeamId ?? -1),
        enabled,
        retry: false,
        refetchOnWindowFocus: false,
        placeholderData: (previousData) => previousData,
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
    const rotationMode: TWardRotationMode = candidatesQuery.data?.rotationMode ?? 'THREE';
    const softTemplates = useMemo(
        () =>
            createSoftRuleTemplates(templates, t, rotationMode).filter(
                (template) => !isRemovedSkillOrRoleTemplate(template) && !RETIRED_TWO_SHIFT_CONFIGURATION_CODES.has(template.id),
            ),
        [rotationMode, t, templates],
    );
    const templateByCode = useMemo(() => new Map(templates.map((template) => [template.templateCode, template] as const)), [templates]);
    const softTemplateByCode = useMemo(() => new Map(softTemplates.map((template) => [template.id, template] as const)), [softTemplates]);
    const options = candidatesQuery.data?.options ?? EMPTY_SHIFT_CONSTRAINT_OPTIONS;
    const nurses: TNurseLike[] = Array.isArray(nurseQuery.data) ? nurseQuery.data : EMPTY_NURSES;
    const shiftTypes = normalizeShiftTypes(shiftTypeQuery.data);
    const currentShiftTeam = availableShiftTeams.find((team) => team.shiftTeamId === currentShiftTeamId);
    const addableSoftTemplates = useMemo(
        () =>
            softTemplates.filter(
                (template) =>
                    !isHiddenAddModalTemplate(template.id) &&
                    !isRemovedSkillOrRoleTemplate(template) &&
                    template.id !== MIXED_OPERATION_POLICY_TEMPLATE_CODE &&
                    (rotationMode === 'TWO'
                        ? TWO_SHIFT_VISIBLE_RULE_CODES.has(template.id)
                        : rotationMode === 'THREE'
                          ? THREE_SHIFT_VISIBLE_RULE_CODES.has(template.id)
                          : MIXED_SHIFT_VISIBLE_RULE_CODES.has(template.id)),
            ),
        [rotationMode, softTemplates],
    );
    const optionMap = useMemo(() => {
        const constraintShiftTypes = shiftTypes.filter((shiftType) => {
            if (rotationMode === 'THREE') {
                return (
                    shiftType.isActive === true &&
                    shiftType.rotationSystem === 'THREE' &&
                    (shiftType.classification === 'DAY' || shiftType.classification === 'EVENING' || shiftType.classification === 'NIGHT')
                );
            }

            if (rotationMode === 'MIXED') {
                if (shiftType.rotationSystem !== 'THREE' && shiftType.rotationSystem !== 'TWO') return false;
            } else if (shiftType.rotationSystem && shiftType.rotationSystem !== rotationMode) {
                return false;
            }

            if (rotationMode === 'TWO') {
                return (
                    shiftType.classification === 'DAY' ||
                    shiftType.classification === 'NIGHT' ||
                    shiftType.classification === 'NIGHT_CONTINUATION'
                );
            }

            return shiftType.classification === 'DAY' || shiftType.classification === 'EVENING' || shiftType.classification === 'NIGHT';
        });
        const dutyOptions = uniqueByValue([
            {value: 'ALL_DUTY', label: t('page.makeShift.constraints.option.all'), raw: {type: 'ALL'}},
            ...constraintShiftTypes
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
        const dutyReferenceOptions = uniqueByValue(
            shiftTypes
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
        );
        const dateOptions = Array.from({length: daysInMonth(year, month)}, (_, idx) => ({
            value: String(idx + 1),
            label: t('page.makeShift.constraints.option.dayLabel', {day: idx + 1}),
            raw: {type: 'DAY_OF_MONTH', day: idx + 1},
        }));
        const dateScopeOptions = [
            {value: 'EVERYDAY', label: t('page.makeShift.constraints.option.everyday'), raw: {type: 'EVERYDAY'}},
            {value: 'WEEKDAY', label: t('page.makeShift.constraints.option.weekday'), raw: {type: 'WEEKDAY'}},
            {value: 'WEEKEND', label: t('page.makeShift.constraints.option.weekend'), raw: {type: 'WEEKEND'}},
            {value: 'HOLIDAY', label: t('page.makeShift.constraints.option.holiday'), raw: {type: 'HOLIDAY'}},
            {
                value: 'WEEKEND_OR_HOLIDAY',
                label: t('page.makeShift.constraints.option.weekendOrHoliday'),
                raw: {type: 'WEEKEND_OR_HOLIDAY'},
            },
            ...(
                [
                    ['MONDAY', 'monday'],
                    ['TUESDAY', 'tuesday'],
                    ['WEDNESDAY', 'wednesday'],
                    ['THURSDAY', 'thursday'],
                    ['FRIDAY', 'friday'],
                    ['SATURDAY', 'saturday'],
                    ['SUNDAY', 'sunday'],
                ] as const
            ).map(([type, key]) => ({
                value: type,
                label: t(`page.makeShift.constraints.option.weekdayName.${key}` as TI18nKey),
                raw: {type},
            })),
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
        const lineOperatorOptions = [
            ...staffCountOperatorOptions,
            {value: 'TARGET', label: t('page.makeShift.constraints.option.staffCountOperator.target'), raw: {type: 'TARGET'}},
        ];
        const enumOption = (type: string, labelKey: TI18nKey): TSelectOption => ({
            value: type,
            label: t(labelKey),
            raw: {type},
        });
        const participationModeOptions = [
            enumOption('THREE_ONLY', 'page.makeShift.constraints.mixed.participation.threeOnly'),
            enumOption('TWO_ONLY', 'page.makeShift.constraints.mixed.participation.twoOnly'),
            enumOption('FLEX', 'page.makeShift.constraints.mixed.participation.flex'),
            enumOption('FALLBACK_TWO', 'page.makeShift.constraints.mixed.participation.fallbackTwo'),
        ];
        const mixedCompositionOptions = [
            {value: 'BALANCED', label: '균형 편성', raw: {type: 'BALANCED'}},
            {value: 'THREE_FIRST', label: '3교대 우선', raw: {type: 'THREE_FIRST'}},
            {value: 'TWO_FIRST', label: '2교대 우선', raw: {type: 'TWO_FIRST'}},
        ];
        const assignmentAggregationOptions = [
            {value: 'PER_NURSE', label: '간호사별', raw: {type: 'PER_NURSE'}},
            {value: 'GROUP_TOTAL', label: '그룹 합계', raw: {type: 'GROUP_TOTAL'}},
        ];
        const twoShiftScopeOptions = [
            {value: 'ALL_TWO', label: '모든 2교대', raw: {type: 'ALL_TWO'}},
            {value: 'TWO_DAY', label: '2교대 주간', raw: {type: 'TWO_DAY'}},
            {value: 'TWO_NIGHT', label: '2교대 야간', raw: {type: 'TWO_NIGHT'}},
        ];
        const workloadMetricOptions = [
            {value: 'TWO_ASSIGNMENTS', label: '2교대 횟수', raw: {type: 'TWO_ASSIGNMENTS'}},
            {value: 'WEEKEND_TWO_ASSIGNMENTS', label: '주말 2교대 횟수', raw: {type: 'WEEKEND_TWO_ASSIGNMENTS'}},
        ];
        const transitionDirectionOptions = [
            {
                value: 'DAY_TO_NIGHT',
                label: t('page.makeShift.constraints.option.transition.dayToNight'),
                raw: {type: 'DAY_TO_NIGHT'},
            },
            {
                value: 'NIGHT_TO_DAY',
                label: t('page.makeShift.constraints.option.transition.nightToDay'),
                raw: {type: 'NIGHT_TO_DAY'},
            },
            {value: 'BOTH', label: t('page.makeShift.constraints.option.transition.both'), raw: {type: 'BOTH'}},
        ];
        const periodOptions = [
            {value: 'DAY', label: t('page.makeShift.constraints.option.period.day'), raw: {type: 'DAY'}},
            {value: 'WEEK', label: t('page.makeShift.constraints.option.period.week'), raw: {type: 'WEEK'}},
            {
                value: 'ROLLING_7_DAYS',
                label: t('page.makeShift.constraints.option.period.rollingSevenDays'),
                raw: {type: 'ROLLING_7_DAYS'},
            },
            {value: 'MONTH', label: t('page.makeShift.constraints.option.period.month'), raw: {type: 'MONTH'}},
        ];
        const shiftTypeById = new Map(
            shiftTypes
                .filter((shiftType) => shiftType.wardShiftTypeId != null)
                .map((shiftType) => [shiftType.wardShiftTypeId!, shiftType] as const),
        );
        const getNurseRotationEligibility = (nurse: TNurseLike) => {
            const configuredShiftTypes = nurse.nurseShiftTypes ?? [];

            if (!configuredShiftTypes.length) {
                return {hasShiftAvailabilityConfig: false, canThreeShift: false, canTwoShift: false};
            }

            const possibleRotations = new Set(
                configuredShiftTypes
                    .filter((nurseShiftType) => nurseShiftType.isPossible === true && nurseShiftType.wardShiftTypeId != null)
                    .map((nurseShiftType) => shiftTypeById.get(nurseShiftType.wardShiftTypeId!))
                    .filter(
                        (shiftType): shiftType is TShiftTypeLike =>
                            Boolean(shiftType) && shiftType!.isActive !== false && shiftType!.isOff !== true,
                    )
                    .map((shiftType) => shiftType.rotationSystem),
            );

            return {
                hasShiftAvailabilityConfig: true,
                canThreeShift: possibleRotations.has('THREE'),
                canTwoShift: possibleRotations.has('TWO'),
            };
        };
        const nurseEligibilityById = new Map(
            nurses.filter((nurse) => nurse.nurseId != null).map((nurse) => [nurse.nurseId!, getNurseRotationEligibility(nurse)] as const),
        );
        const toNurseOption = (nurse: TNurseLike): TSelectOption => ({
            value: String(nurse.nurseId),
            label: String(nurse.name),
            kind: 'nurse',
            divisionNum: nurse.divisionNum ?? undefined,
            isPreceptor: hasPreceptorRole(nurse),
            isPreceptee: hasPrecepteeRole(nurse),
            ...getNurseRotationEligibility(nurse),
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
        const divisionOptions: TSelectOption[] = (currentShiftTeam?.divisions ?? []).map((division) => {
            const trimmedName = division.name?.trim();
            const label = trimmedName && trimmedName.length > 0 ? trimmedName : `그룹${division.divisionNum}`;

            return {
                value: `DIVISION:${division.divisionNum}`,
                label,
                raw: {type: 'DIVISION', divisionNum: division.divisionNum, name: label},
            };
        });
        const fallbackOptionMap = {
            target: [
                {value: 'ALL', label: t('page.makeShift.constraints.option.allPeople'), raw: ALL_CONSTRAINT_TARGET_OPTION},
                ...divisionOptions,
                ...nurseOptions,
            ],
            duty: dutyOptions,
            dutyReference: dutyReferenceOptions,
            date: dateOptions,
            dayType: [],
            dateScope: dateScopeOptions,
            staffCountOperator: staffCountOperatorOptions,
            lineOperator: lineOperatorOptions,
            transitionDirection: transitionDirectionOptions,
            period: periodOptions,
            participationMode: participationModeOptions,
            mixedComposition: mixedCompositionOptions,
            assignmentAggregation: assignmentAggregationOptions,
            twoShiftScope: twoShiftScopeOptions,
            workloadMetric: workloadMetricOptions,
            nurse: nurseOptions,
            preceptor: preceptorOptions,
            preceptee: precepteeOptions,
            dutyStrict: dutyOptions.filter((option) => option.value !== 'ALL_DUTY'),
        } as Record<string, TSelectOption[]>;
        const mergedOptionMap = mergeCandidateOptionMap(options, fallbackOptionMap, shiftTypes, t);
        const eligibleNurseOptions = (mergedOptionMap.nurse ?? []).map((option) => {
            const nurseId = option.raw?.nurseId;
            const eligibility = nurseId != null ? nurseEligibilityById.get(nurseId) : undefined;

            return {
                ...option,
                ...(eligibility ?? {
                    hasShiftAvailabilityConfig: false,
                    canThreeShift: false,
                    canTwoShift: false,
                }),
            };
        });
        const allowedDutyIds = new Set(
            constraintShiftTypes
                .map((shiftType) => shiftType.wardShiftTypeId)
                .filter((wardShiftTypeId): wardShiftTypeId is number => wardShiftTypeId != null),
        );
        const allowedDutyCodes = new Set(
            constraintShiftTypes
                .flatMap((shiftType) => [shiftType.shortName, shiftType.name])
                .filter((value): value is string => Boolean(value)),
        );
        const filteredDutyOptions = (mergedOptionMap.duty ?? []).filter((option) => {
            if (isAllSelectOption(option)) return true;

            if (option.raw?.wardShiftTypeId != null) return allowedDutyIds.has(option.raw.wardShiftTypeId);

            return [option.raw?.code, option.shortName, option.name].filter(Boolean).some((value) => allowedDutyCodes.has(String(value)));
        });
        const monthDayCount = daysInMonth(year, month);
        const isOptionInCurrentMonth = (option: TSelectOption) =>
            option.raw?.type !== 'DAY_OF_MONTH' || (option.raw.day != null && option.raw.day >= 1 && option.raw.day <= monthDayCount);

        return {
            ...mergedOptionMap,
            nurse: eligibleNurseOptions,
            duty: filteredDutyOptions,
            dutyStrict: filteredDutyOptions.filter((option) => !isAllSelectOption(option)),
            date: (mergedOptionMap.date ?? []).filter(isOptionInCurrentMonth),
            dateScope: (mergedOptionMap.dateScope ?? []).filter(isOptionInCurrentMonth),
        };
    }, [currentShiftTeam?.divisions, nurses, options, rotationMode, shiftTypes, t, year, month]);
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

            const savedRules = createRulesFromServer(response.rules)
                .filter(isVisibleConstraintRule)
                .map((rule) => normalizeRuleSeverity(rule, templateByCode.get(rule.templateCode), rotationMode));

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

                const previousRules = createRulesFromServer(context.previousRules.rules)
                    .filter(isVisibleConstraintRule)
                    .map((rule) => normalizeRuleSeverity(rule, templateByCode.get(rule.templateCode), rotationMode));

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
            const normalizedRules = nextRules
                .filter(isVisibleConstraintRule)
                .map((rule) => normalizeRuleSeverity(rule, templateByCode.get(rule.templateCode), rotationMode))
                .map((rule, index) => ({...rule, sortOrder: index + 1}));

            rulesRef.current = normalizedRules;
            setRules(normalizedRules);

            if (options.sync !== false) {
                persistRules(normalizedRules);
            }
        },
        [persistRules, rotationMode, templateByCode],
    );
    const updateRules = useCallback(
        (updater: TRulesUpdate) => {
            replaceRules(updater(rulesRef.current));
        },
        [replaceRules],
    );

    useEffect(() => {
        if (!rulesQuery.data || candidatesQuery.isPending) return;

        replaceRules(createRulesFromServer(rulesQuery.data.rules), {sync: false});
    }, [candidatesQuery.isPending, replaceRules, rulesQuery.data]);

    useEffect(() => {
        if (
            !rulesQuery.data?.rules.length ||
            candidatesQuery.isPending ||
            nurseQuery.isPending ||
            shiftTypeQuery.isPending ||
            wardId == null ||
            currentShiftTeamId == null
        ) {
            return;
        }

        const seedKey = `${wardId}:${currentShiftTeamId}:${rotationMode}`;

        if (recommendedDefaultsSeedKeyRef.current === seedKey) return;

        recommendedDefaultsSeedKeyRef.current = seedKey;

        const savedRules = createRulesFromServer(rulesQuery.data.rules);

        if (!hasLegacyRecommendedDefaults(savedRules, rotationMode)) return;

        const prunedSavedRules = savedRules.filter((rule) => !isRemovedLegacyMixedDefault(rule, rotationMode));
        const hasRemovedLegacyMixedDefaults = prunedSavedRules.length !== savedRules.length;
        const hasLegacyNightIntervalDefault = prunedSavedRules.some((rule) => isLegacyThreeShiftNightIntervalDefault(rule, rotationMode));
        const migratedSavedRules = hasLegacyNightIntervalDefault
            ? prunedSavedRules.map((rule) =>
                  isLegacyThreeShiftNightIntervalDefault(rule, rotationMode)
                      ? {...rule, severity: 'SOFT' as const, isImportant: false}
                      : rule,
              )
            : prunedSavedRules;
        const existingTemplateCodes = new Set(migratedSavedRules.map((rule) => rule.templateCode));
        const missingRecommendedRules = addableSoftTemplates
            .filter((template) => template.isRecommended && !existingTemplateCodes.has(template.id))
            .map((template, index): TShiftConstraintRuleDraft | null => {
                const params = clampNumberParams(
                    template,
                    normalizeCombinationParams(template, getDefaultParams(template, optionMap, rotationMode), optionMap),
                    optionMap,
                );

                if (getSoftRuleAddIssue(template, params, optionMap)) return null;

                return {
                    clientId: createClientId({templateCode: template.id}),
                    templateCode: template.id,
                    category: template.category,
                    severity: 'HARD',
                    sortOrder: migratedSavedRules.length + index + 1,
                    params,
                    selected: true,
                    isImportant: true,
                    displayText: template.buildText(normalizeSoftRuleParams(template, params, optionMap)),
                    isValid: true,
                    invalidReason: null,
                };
            })
            .filter((rule): rule is TShiftConstraintRuleDraft => rule !== null);

        if (hasLegacyNightIntervalDefault || hasRemovedLegacyMixedDefaults || missingRecommendedRules.length) {
            replaceRules([...migratedSavedRules, ...missingRecommendedRules]);
        }
    }, [
        addableSoftTemplates,
        candidatesQuery.isPending,
        currentShiftTeamId,
        nurseQuery.isPending,
        optionMap,
        replaceRules,
        rotationMode,
        rulesQuery.data,
        shiftTypeQuery.isPending,
        wardId,
    ]);

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

    const softRules = rules.filter(
        (rule) =>
            (rule.severity === 'SOFT' || rule.severity === 'HARD') &&
            rule.selected !== false &&
            isVisibleConstraintRule(rule) &&
            !RETIRED_TWO_SHIFT_CONFIGURATION_CODES.has(rule.templateCode) &&
            isSavedRuleVisibleForRotation(rule.templateCode, rotationMode),
    );
    const isLoading = candidatesQuery.isPending || rulesQuery.isPending || nurseQuery.isPending || shiftTypeQuery.isPending;
    const isLoadError = rulesQuery.isError;
    const savedRuleWarnings = rulesQuery.data?.warnings ?? [];
    const softRuleViewModels = useMemo(
        () =>
            softRules.map((rule) => ({
                rule,
                template: templateByCode.get(rule.templateCode),
                softTemplate: softTemplateByCode.get(rule.templateCode),
                highlighted: highlightedRuleId === rule.clientId,
                isImportant: rule.severity === 'HARD',
                isRecommended: isRecommendedTemplateCode(rule.templateCode, rule.category, rotationMode),
                isSeverityLocked: false,
            })),
        [highlightedRuleId, rotationMode, softRules, softTemplateByCode, templateByCode],
    );
    const revealRuleForEditing = useCallback((clientId: string) => {
        setHighlightedRuleId(clientId);
        setSoftModalOpen(false);

        window.setTimeout(() => {
            const row = document.getElementById(getConstraintRuleRowId(clientId));
            const firstEditor =
                row?.querySelector<HTMLElement>('button[aria-haspopup="listbox"]:not(:disabled)') ??
                row?.querySelector<HTMLElement>('input:not(:disabled)') ??
                row?.querySelector<HTMLElement>('button[role="checkbox"]:not(:disabled)');

            row?.scrollIntoView?.({block: 'center'});
            firstEditor?.focus();
        }, 0);

        window.setTimeout(() => {
            setHighlightedRuleId((current) => (current === clientId ? null : current));
        }, 1800);
    }, []);
    const addSoftRule = (template: TSoftRuleTemplate, params: Record<string, unknown>) => {
        const normalizedParams = clampNumberParams(template, normalizeCombinationParams(template, params, optionMap), optionMap);
        const displayParams = normalizeSoftRuleParams(template, normalizedParams, optionMap);
        const isRecommended = Boolean(template.isRecommended);
        const defaultSeverity = isNurseShiftPreferenceSoftOnlyRule(template.id)
            ? 'SOFT'
            : rotationMode === 'THREE' && THREE_SHIFT_NON_RECOMMENDED_RULE_CODES.has(template.id)
              ? 'SOFT'
              : (template.sourceTemplate?.severity ?? 'SOFT');
        const nextRule: TShiftConstraintRuleDraft = {
            clientId: createClientId({templateCode: template.id}),
            templateCode: template.id,
            category: template.category,
            severity: isRecommended ? 'HARD' : defaultSeverity,
            sortOrder: softRules.length + 1,
            params: normalizedParams,
            selected: true,
            isImportant: isRecommended || defaultSeverity === 'HARD',
            displayText: template.buildText(displayParams),
            isValid: true,
            invalidReason: null,
        };
        const duplicateRule = rulesRef.current
            .filter((rule) => rule.selected !== false)
            .find((rule) => getConstraintDuplicateKey(rule) === getConstraintDuplicateKey(nextRule));
        const conflictingNightRecoveryCodes =
            nextRule.templateCode === 'TWO_SHIFT_NIGHT_THEN_CONTINUATION' ||
            nextRule.templateCode === 'TWO_SHIFT_NIGHT_CONTINUATION_AFTER_MIN_OFF'
                ? new Set(['TWO_SHIFT_NIGHT_CONTINUATION_MIN_OFF', 'TWO_SHIFT_NIGHT_PAIR_MIN_OFF'])
                : TWO_SHIFT_NIGHT_RECOVERY_TEMPLATE_CODES;
        const existingNightRecoveryRule = TWO_SHIFT_NIGHT_RECOVERY_TEMPLATE_CODES.has(nextRule.templateCode)
            ? rulesRef.current
                  .filter((rule) => rule.selected !== false)
                  .find((rule) => conflictingNightRecoveryCodes.has(rule.templateCode))
            : undefined;

        if (duplicateRule || existingNightRecoveryRule) {
            const existingRule = duplicateRule ?? existingNightRecoveryRule!;

            if (isRecommended && existingRule.severity !== 'HARD') {
                updateRules((prev) =>
                    prev.map((rule) => (rule.clientId === existingRule.clientId ? {...rule, severity: 'HARD', isImportant: true} : rule)),
                );
            }

            setSoftModalOpen(false);
            revealRuleForEditing(existingRule.clientId);
            toast.success(t('page.makeShift.constraints.toast.duplicateSkipped'));

            return;
        }

        if (template.id === 'STAFF_COUNT_BY_SHIFT' && hasStaffingCountConflict(rulesRef.current, nextRule)) {
            const conflictingRule = rulesRef.current.find(
                (rule) =>
                    STAFFING_COUNT_TEMPLATE_CODES.has(rule.templateCode) &&
                    getStaffingDuplicateDateScope(rule) === getStaffingDuplicateDateScope(nextRule) &&
                    getStaffingDuplicateShift(rule) === getStaffingDuplicateShift(nextRule),
            );

            if (conflictingRule) {
                revealRuleForEditing(conflictingRule.clientId);
            }

            toast.error(t('page.makeShift.constraints.toast.staffCountConflict'));

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
                const rotationCompatibleRules = createRulesFromServer(response.rules)
                    .filter(isVisibleConstraintRule)
                    .filter((rule) => !RETIRED_TWO_SHIFT_CONFIGURATION_CODES.has(rule.templateCode))
                    .filter((rule) => isRuleImportableForRotation(rule.templateCode, rotationMode));
                const skippedNurseRuleCount = rotationCompatibleRules.filter(isNurseSpecificImportRule).length;
                const next = rotationCompatibleRules
                    .filter((rule) => !isNurseSpecificImportRule(rule))
                    .map((rule, index) => ({
                        ...rule,
                        shiftConstraintRuleId: undefined,
                        clientId: createClientId({templateCode: rule.templateCode}),
                        sortOrder: index + 1,
                    }));

                if (!next.length && skippedNurseRuleCount > 0) {
                    toast.error(
                        t('page.makeShift.constraints.toast.importSkippedAllNurseRules', {
                            count: skippedNurseRuleCount,
                        }),
                    );

                    return;
                }

                replaceRules(next);
                setHighlightedRuleId(null);
                toast.success(
                    skippedNurseRuleCount > 0
                        ? t('page.makeShift.constraints.toast.importedWithSkippedNurseRules', {
                              teamName: sourceTeam?.name ?? t('page.makeShift.constraints.import.sourceTeamFallback'),
                              count: skippedNurseRuleCount,
                          })
                        : t('page.makeShift.constraints.toast.imported', {
                              teamName: sourceTeam?.name ?? t('page.makeShift.constraints.import.sourceTeamFallback'),
                          }),
                );
            } catch {
                toast.error(t('page.makeShift.constraints.toast.importFailed'));
            } finally {
                setImportingShiftTeamId(null);
            }
        },
        [availableShiftTeams, currentShiftTeamId, enabled, importingShiftTeamId, queryClient, replaceRules, rotationMode, t, wardId],
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
                    const addIssue = getSoftRuleAddIssue(template, nextParams, optionMap);

                    if (addIssue) {
                        toast.error(t(addIssue));

                        return item;
                    }

                    const displayParams = normalizeSoftRuleParams(template, nextParams, optionMap);

                    return {
                        ...item,
                        params: nextParams,
                        displayText: template.buildText(displayParams),
                    };
                }),
            );
        },
        [optionMap, t, updateRules],
    );
    const setRuleImportant = useCallback(
        (clientId: string, isImportant: boolean) => {
            updateRules((prev) =>
                prev.map((item) => {
                    if (item.clientId !== clientId) return item;

                    const nextImportant = isNurseShiftPreferenceSoftOnlyRule(item.templateCode) ? false : isImportant;

                    return {...item, severity: nextImportant ? 'HARD' : 'SOFT', isImportant: nextImportant};
                }),
            );
        },
        [updateRules],
    );
    const toggleRuleImportant = useCallback(
        (rule: TShiftConstraintRuleDraft, nextImportant: boolean) => {
            if (nextImportant && isNurseShiftPreferenceSoftOnlyRule(rule.templateCode)) {
                toast.error(t('page.makeShift.constraints.toast.nurseShiftPreferenceImportantBlocked'));

                return;
            }

            if (!nextImportant && isRecommendedDefaultRuleCode(rule.templateCode, rotationMode)) {
                setRecommendedWarning({rule, action: 'unmark'});

                return;
            }

            setRuleImportant(rule.clientId, nextImportant);
        },
        [rotationMode, setRuleImportant, t],
    );
    const removeRule = useCallback(
        (rule: TShiftConstraintRuleDraft) => {
            if (isRecommendedDefaultRuleCode(rule.templateCode, rotationMode)) {
                setRecommendedWarning({rule, action: 'delete'});

                return;
            }

            updateRules((prev) => prev.filter((item) => item.clientId !== rule.clientId));
        },
        [rotationMode, updateRules],
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
                    {savedRuleWarnings.length > 0 ? (
                        <section
                            role="status"
                            aria-live="polite"
                            aria-atomic="false"
                            aria-label={t('page.makeShift.constraints.savedWarnings.title')}
                            className="mb-4 rounded-[12px] bg-[#FFF7E6] px-4 py-3 text-[#7A4B00]"
                        >
                            <div className="flex items-start gap-2.5">
                                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="font-apple text-[13px] font-bold">
                                        {t('page.makeShift.constraints.savedWarnings.title')}
                                    </p>
                                    <ul className="mt-1.5 space-y-1 font-apple text-[12px] font-medium">
                                        {savedRuleWarnings.map((warning, index) => (
                                            <li
                                                key={`${warning.code}-${warning.relatedTemplateCodes.join('-')}-${index}`}
                                                data-warning-code={warning.code}
                                            >
                                                {getSavedRuleWarningMessage(warning)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </section>
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
                                    disabled={candidatesQuery.isFetching}
                                    onClick={() => setSoftModalOpen(true)}
                                    className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-[#6C5CFF] px-4 font-apple text-[13px] font-bold text-white transition-colors hover:bg-[#5948F5] focus-visible:ring-2 focus-visible:ring-main-1/25 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
                                >
                                    <Plus className="size-4" />
                                    {t('page.makeShift.constraints.action.add')}
                                </button>
                            </>
                        }
                    >
                        <div className="space-y-2.5">
                            {softRuleViewModels.length ? (
                                softRuleViewModels.map(
                                    ({rule, template, softTemplate, highlighted, isImportant, isRecommended, isSeverityLocked}) => (
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
                                            isSeverityLocked={isSeverityLocked}
                                            onDelete={() => removeRule(rule)}
                                            onToggleImportant={(nextImportant) => toggleRuleImportant(rule, nextImportant)}
                                            onParamChange={(key, value) => updateRuleParam(rule.clientId, key, value)}
                                            onSoftParamChange={(softTemplate, key, value) =>
                                                updateSoftRuleParamByClientId(rule.clientId, softTemplate, key, value)
                                            }
                                        />
                                    ),
                                )
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
                rotationMode={rotationMode}
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
