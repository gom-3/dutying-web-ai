import {useQuery, useQueryClient} from '@tanstack/react-query';
import {ChevronDown, Plus, RotateCcw, X} from 'lucide-react';
import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import toast from 'react-hot-toast';
import {type TShiftTeam} from '@/entities';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuthStore from '@/features/auth/model/store';
import {DEFAULT_SKILL_LEVEL_CONFIG, getWardSkillSettings} from '@/features/ward-skill/model/skill-level';
import {type TI18nKey, useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
import {MAKE_SHIFT_CONSTRAINTS_OPTIMIZE_EVENT} from '../../model/make-shift-events';
import {useMakeShiftStore} from '../../model/make-shift-store';
import {
    getShiftConstraintRuleCandidates,
    getShiftConstraintRules,
    shiftConstraintRuleQueryKeys,
    type TShiftConstraintOption,
    type TShiftConstraintOptions,
    type TShiftConstraintRule,
    type TShiftConstraintRuleDraft,
    type TShiftConstraintSlot,
    type TShiftConstraintTemplate,
} from '../../model/shift-constraint-rules';

type TSelectOption = {value: string; label: string; kind?: 'duty'; shortName?: string; name?: string; color?: string};
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

type TShiftTypeLike = {
    wardShiftTypeId?: number;
    shortName?: string;
    name?: string;
    color?: string;
    isOff?: boolean;
    classification?: string;
};
type TNurseLike = {nurseId?: number; name?: string; isPreceptor?: boolean};

const EMPTY_NURSES: TNurseLike[] = [];
const EMPTY_SHIFT_TYPES: TShiftTypeLike[] = [];
const EMPTY_SHIFT_CONSTRAINT_OPTIONS: TShiftConstraintOptions = {};
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
    SKILL: 'page.makeShift.constraints.category.skill',
    PROFICIENCY: 'page.makeShift.constraints.category.skill',
    COMBINATION: 'page.makeShift.constraints.category.combination',
    NURSE_COMBINATION: 'page.makeShift.constraints.category.combination',
    CORE: 'page.makeShift.constraints.category.recommended',
    IMPORTANT: 'page.makeShift.constraints.category.recommended',
};

function getCategoryLabel(t: TTypedT, category: TModalCategory) {
    if (category === RECOMMENDED_MODAL_CATEGORY) return t('page.makeShift.constraints.category.recommended');

    const key = CATEGORY_LABEL_KEY_BY_CATEGORY[category];

    return key ? t(key) : category;
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
                const showName = style.name && style.name !== style.code;

                return (
                    <span key={`${option.value}-${index}`} className="inline-flex h-full items-center">
                        {index > 0 ? <span className="px-1 font-apple text-[13px] font-bold text-gray-4">-</span> : null}
                        <span
                            className="inline-flex h-7 items-center gap-1 rounded-[8px] px-2 font-apple text-white"
                            style={{backgroundColor: style.color}}
                        >
                            <span className="text-[14px] font-semibold">{style.code}</span>
                            {showName ? <span className="text-[12px] font-medium opacity-90">{style.name}</span> : null}
                        </span>
                    </span>
                );
            })}
        </span>
    );
}

const RECOMMENDED_DEFAULT_RULE_IDS = new Set([
    'IMPORTANT_MAX_WORK_STREAK',
    'IMPORTANT_MAX_SAME_DUTY_STREAK',
    'IMPORTANT_MIN_NIGHT_INTERVAL',
    'IMPORTANT_MAX_NIGHT_STREAK',
    'IMPORTANT_OFF_AFTER_NIGHT',
    'IMPORTANT_NO_NIGHT_BEFORE_REQUEST_OFF',
    'IMPORTANT_FORBIDDEN_DUTY_PATTERNS',
]);

function hasFinalConsonant(value: string) {
    const trimmed = value.trim();
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

function getTemplateTranslationKey(templateId: string, property: 'label' | 'sentence') {
    return `page.makeShift.constraints.templates.${templateId}.${property}` as TI18nKey;
}

type TSoftRuleTemplateDefinition = Pick<TSoftRuleTemplate, 'id' | 'category' | 'controls'>;

const SOFT_RULE_TEMPLATE_DEFINITIONS: TSoftRuleTemplateDefinition[] = [
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
        id: 'SOFT_NEWBIE_NO_SOLO_N',
        category: 'SKILL',
        controls: [{key: 'nurse', kind: 'select', optionsKey: 'nurse'}],
    },
    {
        id: 'SOFT_MIN_SKILL_IN_DUTY',
        category: 'SKILL',
        controls: [
            {key: 'duty', kind: 'select', optionsKey: 'dutyStrict'},
            {key: 'level', kind: 'select', optionsKey: 'level'},
            {key: 'count', kind: 'number', min: 1, max: 6},
        ],
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
const DEFAULT_PARAMS_BY_TEMPLATE_CODE: Record<string, Record<string, string>> = {
    IMPORTANT_MAX_WORK_STREAK: {days: '3'},
    IMPORTANT_MAX_SAME_DUTY_STREAK: {days: '3'},
    IMPORTANT_MIN_NIGHT_INTERVAL: {days: '3'},
    IMPORTANT_MAX_NIGHT_STREAK: {days: '2'},
    IMPORTANT_OFF_AFTER_NIGHT: {days: '1'},
    IMPORTANT_NO_NIGHT_BEFORE_REQUEST_OFF: {},
    IMPORTANT_FORBIDDEN_DUTY_PATTERNS: {},
    CORE_MAX_CONTINUOUS_WORK: {days: '3', maxDays: '3', maxContinuousWorkDays: '3', count: '3'},
    CORE_MAX_CONTINUOUS_NIGHT: {count: '2'},
    CORE_MIN_CONTINUOUS_NIGHT: {count: '2'},
    CORE_MIN_OFF_AFTER_NIGHT: {count: '1'},
    CORE_MAX_SAME_DUTY_STREAK: {days: '3', maxDays: '3'},
    CORE_MIN_NIGHT_INTERVAL: {days: '3', minDays: '3', intervalDays: '3', count: '3'},
    CORE_MAX_NIGHT_STREAK: {days: '2', maxDays: '2'},
    CORE_OFF_AFTER_NIGHT: {days: '1', minOffDays: '1'},
    CORE_NO_NIGHT_BEFORE_REQUEST_OFF: {},
    CORE_FORBIDDEN_DUTY_PATTERNS: {},
    MIN_STAFF_BY_SHIFT: {count: '1'},
    MAX_STAFF_BY_SHIFT: {count: '1'},
    MIN_STAFF_BY_DATE_SHIFT: {count: '1'},
    MIN_STAFF_WEEKEND_HOLIDAY_SHIFT: {count: '1'},
    MAX_CONSECUTIVE_N: {count: '2'},
    MAX_CONSECUTIVE_WORK_DAYS: {count: '3'},
    OFF_AFTER_CONSECUTIVE_WORK: {count: '2'},
    MIN_OFF_AFTER_N: {count: '1'},
    MIN_MONTHLY_OFF: {count: '1'},
    MIN_PROFICIENCY_STAFF_BY_SHIFT: {count: '1'},
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
    proficiency: 'level',
    proficiencies: 'level',
    PROFICIENCY: 'level',
    PROFICIENCIES: 'level',
    level: 'level',
    levels: 'level',
    LEVEL: 'level',
    LEVELS: 'level',
    date: 'date',
    dates: 'date',
    DATE: 'date',
    DATES: 'date',
    day: 'date',
    days: 'date',
    DAY: 'date',
    DAYS: 'date',
    shift: 'duty',
    shifts: 'duty',
    shiftsWithAll: 'duty',
    SHIFT: 'duty',
    SHIFTS: 'duty',
    SHIFT_TYPE: 'duty',
    SHIFT_TYPES: 'duty',
    SHIFTS_WITH_ALL: 'duty',
};
const DUTY_PATTERN_CODES: Record<string, string[]> = {
    ND: ['N', 'D'],
    ED: ['E', 'D'],
    NE: ['N', 'E'],
    NOD: ['N', 'OFF', 'D'],
};

function isRecommendedTemplateCode(templateCode: string, category?: string) {
    const normalizedCategory = category?.toUpperCase();

    return (
        RECOMMENDED_DEFAULT_RULE_IDS.has(templateCode) ||
        templateCode.startsWith('IMPORTANT_') ||
        templateCode.startsWith('CORE_') ||
        normalizedCategory === 'CORE' ||
        normalizedCategory === 'IMPORTANT'
    );
}

function isTemplateSelectableAsSoft(template: TShiftConstraintTemplate) {
    return template.severity === 'SOFT' || template.allowedSeverities.includes('SOFT');
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
    const tokenPattern = /(NOD|OFF|ND|ED|NE|D|E|N)/g;

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

        if (DUTY_PATTERN_CODES[token]) {
            parts.push({type: 'dutyPattern', codes: DUTY_PATTERN_CODES[token]});
        } else {
            parts.push({type: 'duty', code: token});
        }

        lastIndex = end;
    }

    if (lastIndex < text.length) {
        parts.push({type: 'text', text: text.slice(lastIndex)});
    }

    return parts.length ? parts : [{type: 'text', text}];
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

function interpolateDisplayTemplate(template: TShiftConstraintTemplate, params: Record<string, string>) {
    return template.displayTemplate.replace(/\{([^}]+)\}/g, (_, key: string) => params[key.trim()] ?? '');
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

    return templates.filter(isTemplateSelectableAsSoft).map<TSoftRuleTemplate>((template) => {
        const controls = template.slots.map(createControlFromSlot);
        const legacyTemplate = legacyTemplates.find((item) => item.id === template.templateCode);
        const sentence = canUseLegacySentence(legacyTemplate, controls)
            ? legacyTemplate!.sentence
            : createSentenceFromTemplate(template, controls);

        return {
            id: template.templateCode,
            category: template.category,
            label: legacyTemplate?.label ?? getCategoryLabel(t, template.category),
            controls,
            sentence,
            buildText: legacyTemplate?.buildText ?? ((params) => interpolateDisplayTemplate(template, params)),
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
        isImportant: rule.isImportant ?? isRecommendedTemplateCode(rule.templateCode, rule.category),
        clientId: createClientId(rule),
    }));
}

function getDefaultParams(template: TSoftRuleTemplate, optionMap: Record<string, TSelectOption[]> = {}) {
    const configuredDefaults = DEFAULT_PARAMS_BY_TEMPLATE_CODE[template.id] ?? {};
    const params: Record<string, string> = {};

    template.controls.forEach((control) => {
        if (configuredDefaults[control.key] != null) {
            params[control.key] = configuredDefaults[control.key];

            return;
        }

        if (control.kind === 'number') {
            params[control.key] = String(control.values?.[0] ?? control.min ?? 1);

            return;
        }

        params[control.key] = optionMap[control.optionsKey ?? '']?.[0]?.label ?? '';
    });

    return params;
}

function createRecommendedDefaultRules(templates: TSoftRuleTemplate[], optionMap: Record<string, TSelectOption[]> = {}) {
    return templates
        .filter((template) => template.isRecommended)
        .map<TShiftConstraintRuleDraft>((template, index) => {
            const params = getDefaultParams(template, optionMap);

            return {
                clientId: `recommended-${template.id}`,
                templateCode: template.id,
                category: template.category,
                severity: 'SOFT',
                sortOrder: index + 1,
                params,
                isImportant: true,
                displayText: template.buildText(params),
                isValid: true,
                invalidReason: null,
            };
        });
}

function createVisibleSoftRules(
    serverRules: TShiftConstraintRule[],
    templates: TSoftRuleTemplate[],
    optionMap: Record<string, TSelectOption[]> = {},
) {
    const defaults = createRecommendedDefaultRules(templates, optionMap);
    const defaultTemplateCodes = new Set(defaults.map((rule) => rule.templateCode));
    const loadedRules = fromServerRules(serverRules);

    return [...defaults, ...loadedRules.filter((rule) => rule.severity === 'SOFT' && !defaultTemplateCodes.has(rule.templateCode))].map(
        (rule, index) => ({...rule, sortOrder: index + 1}),
    );
}

function getOptionKey(option: TShiftConstraintOption) {
    if (option.nurseId != null) return `nurse-${option.nurseId}`;

    if (option.wardShiftTypeId != null) return `shift-${option.wardShiftTypeId}`;

    if (option.day != null) return `day-${option.day}`;

    if (option.level != null) return `level-${option.level}`;

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
            level: value.level,
            proficiency: value.proficiency,
            code: value.code,
            label: value.label ?? value.name,
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

function getConstraintDuplicateKey(rule: TShiftConstraintRuleDraft) {
    return [rule.severity, rule.category, rule.templateCode, stringifyDuplicateParams(rule.params)].join('|');
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

        compacted[existingIndex] = {
            ...existingRule,
            shiftConstraintRuleId: existingRule.shiftConstraintRuleId ?? rule.shiftConstraintRuleId,
            isImportant: [existingRule.isImportant, rule.isImportant].some(Boolean),
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
        if (!map.has(option.value)) map.set(option.value, option);
    });

    return Array.from(map.values());
}

function normalizeShiftTypes(input: unknown): TShiftTypeLike[] {
    if (Array.isArray(input)) return input as TShiftTypeLike[];

    if (input && typeof input === 'object') {
        const maybe = input as {shiftTypes?: unknown; wardShiftTypes?: unknown};

        if (Array.isArray(maybe.shiftTypes)) return maybe.shiftTypes as TShiftTypeLike[];

        if (Array.isArray(maybe.wardShiftTypes)) return maybe.wardShiftTypes as TShiftTypeLike[];
    }

    return EMPTY_SHIFT_TYPES;
}

function getCandidateOptionValue(option: TShiftConstraintOption) {
    if (option.nurseId != null) return String(option.nurseId);

    if (option.wardShiftTypeId != null) return String(option.wardShiftTypeId);

    if (option.day != null) return String(option.day);

    if (option.level != null) return String(option.level);

    if (option.proficiency != null) return String(option.proficiency);

    if (option.code) return option.code;

    return option.label ?? option.name ?? option.type;
}

function isAllCandidateOption(option: TShiftConstraintOption) {
    const values = [option.type, option.code, option.label, option.name].filter(Boolean).map((value) => String(value).toUpperCase());

    return values.some((value) => value === 'ALL' || value.includes('ALL_') || LEGACY_ALL_LABELS.has(value));
}

function getCandidateOptionLabel(t: TTypedT, option: TShiftConstraintOption, shiftType?: TShiftTypeLike) {
    if (option.label) return option.label;

    if (option.name) return option.name;

    if (option.code) return option.code;

    if (option.day != null) return t('page.makeShift.constraints.option.dayLabel', {day: option.day});

    if (option.level != null) return `LV. ${option.level}`;

    if (option.proficiency != null) return `LV. ${option.proficiency}`;

    return shiftType?.name ?? option.type;
}

function toSelectOption(option: TShiftConstraintOption, optionMapKey: string, shiftTypes: TShiftTypeLike[], t: TTypedT): TSelectOption {
    const shiftType =
        option.wardShiftTypeId != null ? shiftTypes.find((item) => item.wardShiftTypeId === option.wardShiftTypeId) : undefined;
    const isDuty = optionMapKey === 'duty' || optionMapKey === 'dutyStrict';
    const label = getCandidateOptionLabel(t, option, shiftType);

    if (!isDuty) {
        return {
            value: getCandidateOptionValue(option),
            label,
        };
    }

    const shortName = option.code ?? shiftType?.shortName ?? label.split(' ')[0] ?? label;
    const name = option.name ?? shiftType?.name ?? label;

    return {
        value: getCandidateOptionValue(option),
        label,
        kind: 'duty',
        shortName,
        name,
        color: shiftType?.color,
    };
}

function getCandidateOptions(
    candidates: TShiftConstraintOptions,
    optionMapKey: string,
    candidateKeys: string[],
    fallback: TSelectOption[],
    shiftTypes: TShiftTypeLike[],
    t: TTypedT,
) {
    const serverOptions = candidateKeys.flatMap((key) => candidates[key] ?? []);

    if (!serverOptions.length) return fallback;

    return uniqueByValue(serverOptions.map((option) => toSelectOption(option, optionMapKey, shiftTypes, t)));
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
    );
    const nurse = getCandidateOptions(candidates, 'nurse', ['nurses', 'NURSES'], fallback.nurse, shiftTypes, t);

    return {
        target: getCandidateOptions(candidates, 'target', ['targets', 'TARGETS'], fallback.target, shiftTypes, t),
        duty,
        date: getCandidateOptions(candidates, 'date', ['dates', 'DATES'], fallback.date, shiftTypes, t),
        nurse,
        preceptor: getCandidateOptions(candidates, 'preceptor', ['preceptors', 'PRECEPTORS'], fallback.preceptor, shiftTypes, t),
        preceptee: getCandidateOptions(candidates, 'preceptee', ['preceptees', 'PRECEPTEES'], fallback.preceptee ?? nurse, shiftTypes, t),
        level: getCandidateOptions(candidates, 'level', ['proficiencies', 'levels', 'PROFICIENCIES', 'LEVELS'], fallback.level, shiftTypes, t),
        dutyStrict: duty.filter((option) => !isAllCandidateOption({type: option.value, label: option.label, code: option.shortName})),
    };
}

function findDutyOptionByCode(options: TSelectOption[], code: string) {
    const normalizedCode = code.trim().toUpperCase();

    if (normalizedCode === 'OFF') {
        return (
            options.find((option) => option.shortName?.toUpperCase() === 'OFF') ??
            options.find((option) => option.shortName?.toUpperCase() === 'O') ??
            options.find((option) => Boolean(option.name?.includes(LEGACY_OFF_NAME)) || option.name?.toUpperCase() === 'OFF')
        );
    }

    return options.find((option) => option.shortName?.toUpperCase() === normalizedCode);
}

function getOptionsForControl(
    control: TControlDef,
    template: TSoftRuleTemplate,
    params: Record<string, string>,
    optionMap: Record<string, TSelectOption[]>,
) {
    const options = optionMap[control.optionsKey ?? ''] ?? [];

    if (!template.category.includes('COMBINATION') || control.optionsKey !== 'nurse') return options;

    const pairedKey = control.key === 'nurseA' ? 'nurseB' : control.key === 'nurseB' ? 'nurseA' : null;

    if (!pairedKey) return options;

    const pairedValue = params[pairedKey];

    return options.filter((option) => option.label !== pairedValue);
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

    return options.find((option) => option.label === value || option.value === value)?.label ?? value;
}

function normalizeCombinationParams(
    template: TSoftRuleTemplate,
    params: Record<string, string>,
    optionMap: Record<string, TSelectOption[]>,
) {
    if (template.category !== 'COMBINATION' || params.nurseA !== params.nurseB) return params;

    const nurseOptions = optionMap.nurse ?? [];
    const nextNurseB = nurseOptions.find((option) => option.label !== params.nurseA)?.label;

    if (!nextNurseB) return params;

    return {...params, nurseB: nextNurseB};
}

type TInlineDropdownProps = {
    value: string;
    options: TSelectOption[];
    minWidth?: number;
    onChange: (value: string) => void;
};

function InlineDropdown({value, options, minWidth = 72, onChange}: TInlineDropdownProps) {
    const [open, setOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{left: number; top?: number; bottom?: number; minWidth: number} | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const selected = options.find((option) => option.label === value || option.value === value) ?? options[0];
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
                {selected?.kind === 'duty' ? (
                    <DutyTypeBadge option={selected} />
                ) : (
                    <span className="max-w-[120px] truncate">{selected?.label ?? value}</span>
                )}
                <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && menuPosition && typeof document !== 'undefined'
                ? createPortal(
                      <div
                          ref={menuRef}
                          role="listbox"
                          style={menuStyle}
                          className={`fixed z-[70] max-h-[220px] animate-in overflow-y-auto rounded-[10px] border border-gray-6 bg-white py-1 shadow-[0px_10px_28px_rgba(95,100,135,0.16)] duration-150 fade-in-0 zoom-in-95 ${
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
                                      className={`flex w-full cursor-pointer items-center justify-center px-3 py-2 text-center font-apple text-[14px] whitespace-nowrap transition-colors hover:bg-gray-7 focus-visible:outline-2 focus-visible:outline-main-1 ${
                                          isSelected ? 'bg-main-light font-semibold text-main-1' : 'text-sub-1'
                                      }`}
                                      onClick={() => {
                                          onChange(option.label);
                                          setOpen(false);
                                      }}
                                  >
                                      {option.kind === 'duty' ? <DutyTypeBadge option={option} /> : option.label}
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
    params: Record<string, string>;
    optionMap: Record<string, TSelectOption[]>;
    onParamChange: (key: string, value: string) => void;
};

function SoftSentence({template, params, optionMap, onParamChange}: TSoftSentenceProps) {
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
                    const particleValue = getControlDisplayValue(control, template, params, optionMap);

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
                    const current = Number(getControlDisplayValue(control, template, params, optionMap) || values[0] || min);

                    return (
                        <InlineDropdown
                            key={`${template.id}-${control.key}-${idx}`}
                            value={String(current)}
                            options={values.map((v) => ({value: String(v), label: String(v)}))}
                            minWidth={58}
                            onChange={(nextValue) => onParamChange(control.key, String(Number(nextValue)))}
                        />
                    );
                }

                const options = getOptionsForControl(control, template, params, optionMap);
                const selected = getControlDisplayValue(control, template, params, optionMap);

                return (
                    <InlineDropdown
                        key={`${template.id}-${control.key}-${idx}`}
                        value={selected}
                        options={options}
                        minWidth={control.optionsKey === 'date' ? 88 : control.optionsKey === 'target' ? 104 : 72}
                        onChange={(nextValue) => onParamChange(control.key, nextValue)}
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
                onChange={(nextValue) => onChange(Number(nextValue))}
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
            onChange={(nextValue) => {
                const next = optionList.find((option) => getValueLabel(option) === nextValue);

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
    onSoftParamChange: (template: TSoftRuleTemplate, key: string, value: string) => void;
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
            aria-label={
                checked
                    ? t('page.makeShift.constraints.important.ariaRemove')
                    : t('page.makeShift.constraints.important.ariaMark')
            }
            title={
                isRecommended
                    ? t('page.makeShift.constraints.important.recommendedTitle')
                    : t('page.makeShift.constraints.important.ariaMark')
            }
            onClick={() => onChange(!checked)}
            className={`mr-6 inline-flex h-6 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full px-2 font-apple text-[12px] font-bold ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-main-1/25 focus-visible:outline-none ${
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
                        params={rule.params as Record<string, string>}
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
                    <span className="font-apple text-[13px] font-bold text-gray-4">
                        {t('page.makeShift.constraints.listTitle')}
                    </span>
                    {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
                </div>
                <div className="space-y-2.5">{children}</div>
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
    const title = hasMultipleTeams
        ? t('page.makeShift.constraints.import.title')
        : t('page.makeShift.constraints.import.disabledTitle');

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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
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
    onAdd: (template: TSoftRuleTemplate, params: Record<string, string>) => void;
};

function SoftRuleModal({open, templates, optionMap, onClose, onAdd}: TSoftModalProps) {
    const {t} = useTypedTranslation();
    const recommendedTemplates = useMemo(() => templates.filter((template) => template.isRecommended), [templates]);
    const categories = useMemo<TModalCategory[]>(() => {
        const normalCategories = Array.from(new Set(templates.filter((template) => !template.isRecommended).map((t) => t.category)));

        return recommendedTemplates.length ? [RECOMMENDED_MODAL_CATEGORY, ...normalCategories] : normalCategories;
    }, [recommendedTemplates.length, templates]);
    const [selectedCategory, setSelectedCategory] = useState<TModalCategory>(RECOMMENDED_MODAL_CATEGORY);
    const [draftParams, setDraftParams] = useState<Record<string, Record<string, string>>>({});

    useEffect(() => {
        if (!open) return;

        const next: Record<string, Record<string, string>> = {};

        templates.forEach((template) => {
            const params = getDefaultParams(template, optionMap);

            next[template.id] = normalizeCombinationParams(template, params, optionMap);
        });
        setDraftParams(next);
        setSelectedCategory(categories[0] ?? 'STAFFING');
    }, [categories, open, optionMap, templates]);

    if (!open) return null;

    const visibleTemplates = templates.filter((template) =>
        selectedCategory === RECOMMENDED_MODAL_CATEGORY
            ? template.isRecommended
            : !template.isRecommended && template.category === selectedCategory,
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
            <div className="flex min-h-[640px] w-full max-w-[820px] flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)]">
                <div className="flex items-start justify-between px-6 pt-6 pb-4">
                    <div>
                        <p className="font-apple text-[28px] font-bold text-sub-1">
                            {t('page.makeShift.constraints.modal.title')}
                        </p>
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
                                                [template.id]: {...(prev[template.id] ?? {}), [key]: value},
                                            }))
                                        }
                                    />
                                </div>
                                <div className="shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => onAdd(template, templateParams)}
                                        className="grid size-8 cursor-pointer place-items-center rounded-full bg-main-1 text-white transition-colors hover:bg-main-2 focus-visible:ring-2 focus-visible:ring-main-1/25 focus-visible:outline-none"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
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
    const queryClient = useQueryClient();
    const authWardId = useAuthStore((s) => s.wardId);
    const storeShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const storeShiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const storeYear = useMakeShiftStore((s) => s.year);
    const storeMonth = useMakeShiftStore((s) => s.month);
    const wardId = wardIdProp ?? authWardId;
    const currentShiftTeamId = shiftTeamId ?? storeShiftTeamId;
    const availableShiftTeams = shiftTeamsProp ?? storeShiftTeams;
    const year = yearProp ?? storeYear;
    const month = monthProp ?? storeMonth;
    const enabled = wardId !== null && wardId !== undefined && currentShiftTeamId !== null && currentShiftTeamId !== undefined;
    const frameClassName = variant === 'settings' ? 'flex min-w-0 flex-col' : 'flex min-w-0 flex-col items-end';
    const surfaceWidthClassName = variant === 'settings' ? 'w-full' : 'w-full min-w-[920px] max-w-[1088px]';
    const surfacePaddingYClassName = variant === 'settings' ? 'py-[clamp(10px,1.1vw,16px)]' : 'py-0';
    const [rules, setRules] = useState<TShiftConstraintRuleDraft[]>([]);
    const rulesRef = useRef<TShiftConstraintRuleDraft[]>([]);
    const [softModalOpen, setSoftModalOpen] = useState(false);
    const [highlightedRuleId, setHighlightedRuleId] = useState<string | null>(null);
    const [recommendedWarning, setRecommendedWarning] = useState<TRecommendedRuleWarning | null>(null);
    const [importingShiftTeamId, setImportingShiftTeamId] = useState<number | null>(null);
    const candidatesQuery = useQuery({
        queryKey: shiftConstraintRuleQueryKeys.candidates(wardId ?? -1, currentShiftTeamId ?? -1),
        queryFn: () => getShiftConstraintRuleCandidates(wardId ?? -1, currentShiftTeamId ?? -1),
        enabled,
        retry: false,
        refetchOnWindowFocus: false,
    });
    const rulesQuery = useQuery({
        queryKey: shiftConstraintRuleQueryKeys.rules(wardId ?? -1, currentShiftTeamId ?? -1),
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
    const softTemplates = useMemo(() => {
        if (templates.length) return createSoftRuleTemplates(templates, t);

        return createLegacySoftRuleTemplates(t);
    }, [t, templates]);
    const templateByCode = useMemo(() => new Map(templates.map((template) => [template.templateCode, template] as const)), [templates]);
    const softTemplateByCode = useMemo(() => new Map(softTemplates.map((template) => [template.id, template] as const)), [softTemplates]);
    const options = candidatesQuery.data?.options ?? EMPTY_SHIFT_CONSTRAINT_OPTIONS;
    const nurses: TNurseLike[] = Array.isArray(nurseQuery.data) ? nurseQuery.data : EMPTY_NURSES;
    const shiftTypes = normalizeShiftTypes(shiftTypeQuery.data);
    const skillConfig = useMemo(() => getWardSkillSettings(wardId)?.config ?? DEFAULT_SKILL_LEVEL_CONFIG, [wardId]);
    const optionMap = useMemo(() => {
        const dutyOptions = uniqueByValue([
            {value: 'ALL_DUTY', label: t('page.makeShift.constraints.option.all')},
            ...shiftTypes
                .filter((shiftType) => shiftType.wardShiftTypeId != null && (shiftType.shortName ?? shiftType.name))
                .map((shiftType) => ({
                    value: String(shiftType.wardShiftTypeId),
                    label: `${shiftType.shortName ?? shiftType.name} ${shiftType.name ?? shiftType.shortName ?? ''}`.trim(),
                    kind: 'duty' as const,
                    shortName: shiftType.shortName ?? shiftType.name,
                    name: shiftType.name,
                    color: shiftType.color,
                })),
        ]);
        const dateOptions = [{value: 'ALL_DATE', label: t('page.makeShift.constraints.option.allDays')}].concat(
            Array.from({length: daysInMonth(year, month)}, (_, idx) => ({
                value: String(idx + 1),
                label: t('page.makeShift.constraints.option.dayLabel', {day: idx + 1}),
            })),
        );
        const nurseOptions = nurses
            .filter((nurse) => nurse.nurseId != null && nurse.name)
            .map((nurse) => ({value: String(nurse.nurseId), label: String(nurse.name)}));
        const preceptorOptions = nurses
            .filter((nurse) => nurse.nurseId != null && nurse.name && nurse.isPreceptor)
            .map((nurse) => ({value: String(nurse.nurseId), label: String(nurse.name)}));
        const fallbackOptionMap = {
            target: [{value: 'ALL', label: t('page.makeShift.constraints.option.allPeople')}, ...nurseOptions],
            duty: dutyOptions,
            date: dateOptions,
            nurse: nurseOptions,
            preceptor: preceptorOptions.length ? preceptorOptions : nurseOptions,
            preceptee: nurseOptions,
            level: Array.from({length: skillConfig.levelCount}, (_, index) => {
                const level = skillConfig.levelCount - index;
                const label = skillConfig.levelLabels?.[level] ?? `LV. ${level}`;

                return {value: String(level), label};
            }),
            dutyStrict: dutyOptions.filter((option) => option.value !== 'ALL_DUTY'),
        } as Record<string, TSelectOption[]>;

        return mergeCandidateOptionMap(options, fallbackOptionMap, shiftTypes, t);
    }, [nurses, options, shiftTypes, skillConfig, t, year, month]);

    useEffect(() => {
        if (!rulesQuery.data || candidatesQuery.isPending) return;

        const next = createVisibleSoftRules(rulesQuery.data.rules, softTemplates, optionMap);

        rulesRef.current = next;
        setRules(next);
    }, [candidatesQuery.isPending, optionMap, rulesQuery.data, softTemplates]);

    useEffect(() => {
        rulesRef.current = rules;
    }, [rules]);

    const optimizeDuplicateRules = useCallback(() => {
        const result = compactDuplicateRules(rulesRef.current);

        if (!result.removedCount) return 0;

        rulesRef.current = result.rules;
        setRules(result.rules);
        setHighlightedRuleId(null);
        toast.success(t('page.makeShift.constraints.toast.duplicatesRemoved', {count: result.removedCount}));

        return result.removedCount;
    }, [t]);

    useEffect(() => {
        if (variant !== 'flow') return;

        const handleOptimize = () => {
            optimizeDuplicateRules();
        };

        window.addEventListener(MAKE_SHIFT_CONSTRAINTS_OPTIMIZE_EVENT, handleOptimize);

        return () => window.removeEventListener(MAKE_SHIFT_CONSTRAINTS_OPTIMIZE_EVENT, handleOptimize);
    }, [optimizeDuplicateRules, variant]);

    const softRules = rules.filter((rule) => rule.severity === 'SOFT');
    const isLoading = candidatesQuery.isPending || rulesQuery.isPending;
    const isLoadError = rulesQuery.isError;
    const softRuleViewModels = useMemo(
        () =>
            softRules.map((rule) => ({
                rule,
                template: templateByCode.get(rule.templateCode),
                softTemplate: softTemplateByCode.get(rule.templateCode),
                highlighted: highlightedRuleId === rule.clientId,
                isImportant: Boolean(rule.isImportant),
                isRecommended: isRecommendedTemplateCode(rule.templateCode, rule.category),
            })),
        [highlightedRuleId, softRules, softTemplateByCode, templateByCode],
    );
    const addSoftRule = (template: TSoftRuleTemplate, params: Record<string, string>) => {
        const nextRule: TShiftConstraintRuleDraft = {
            clientId: createClientId({templateCode: template.id}),
            templateCode: template.id,
            category: template.category,
            severity: 'SOFT',
            sortOrder: softRules.length + 1,
            params,
            isImportant: Boolean(template.isRecommended),
            displayText: template.buildText(params),
            isValid: true,
            invalidReason: null,
        };

        setRules((prev) => {
            const hard = prev.filter((r) => r.severity === 'HARD');
            const soft = prev.filter((r) => r.severity === 'SOFT');
            const nextSoft = [...soft, nextRule].map((r, idx) => ({...r, sortOrder: idx + 1}));

            return [...hard, ...nextSoft];
        });
        setHighlightedRuleId(nextRule.clientId);
        setSoftModalOpen(false);
        toast.success(t('page.makeShift.constraints.toast.added'));

        window.setTimeout(() => {
            setHighlightedRuleId((current) => (current === nextRule.clientId ? null : current));
        }, 1800);
    };
    const resetRulesToImportantDefaults = useCallback(() => {
        const defaults = createRecommendedDefaultRules(softTemplates, optionMap);

        setRules(defaults);
        setHighlightedRuleId(null);
        toast.success(t('page.makeShift.constraints.toast.resetDefaults', {count: defaults.length}));
    }, [optionMap, softTemplates, t]);
    const importRulesFromTeam = useCallback(
        async (sourceShiftTeamId: number) => {
            if (!wardId || currentShiftTeamId == null || importingShiftTeamId !== null) return;

            const sourceTeam = availableShiftTeams.find((team) => team.shiftTeamId === sourceShiftTeamId);

            try {
                setImportingShiftTeamId(sourceShiftTeamId);

                const response = await queryClient.fetchQuery({
                    queryKey: shiftConstraintRuleQueryKeys.rules(wardId, sourceShiftTeamId),
                    queryFn: () => getShiftConstraintRules(wardId, sourceShiftTeamId),
                });
                const next = createVisibleSoftRules(response.rules, softTemplates, optionMap);

                rulesRef.current = next;
                setRules(next);
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
        [availableShiftTeams, currentShiftTeamId, importingShiftTeamId, optionMap, queryClient, softTemplates, t, wardId],
    );
    const updateRuleParam = useCallback((clientId: string, key: string, value: unknown) => {
        setRules((prev) => prev.map((item) => (item.clientId === clientId ? {...item, params: {...item.params, [key]: value}} : item)));
    }, []);
    const updateSoftRuleParamByClientId = useCallback((clientId: string, template: TSoftRuleTemplate, key: string, value: string) => {
        setRules((prev) =>
            prev.map((item) => {
                if (item.clientId !== clientId) return item;

                const nextParams = {...item.params, [key]: value} as Record<string, string>;

                return {
                    ...item,
                    params: nextParams,
                    displayText: template.buildText(nextParams),
                };
            }),
        );
    }, []);
    const setRuleImportant = useCallback((clientId: string, isImportant: boolean) => {
        setRules((prev) => prev.map((item) => (item.clientId === clientId ? {...item, isImportant} : item)));
    }, []);
    const toggleRuleImportant = useCallback(
        (rule: TShiftConstraintRuleDraft, nextImportant: boolean) => {
            if (!nextImportant && isRecommendedTemplateCode(rule.templateCode, rule.category)) {
                setRecommendedWarning({rule, action: 'unmark'});

                return;
            }

            setRuleImportant(rule.clientId, nextImportant);
        },
        [setRuleImportant],
    );
    const removeRule = useCallback((rule: TShiftConstraintRuleDraft) => {
        if (isRecommendedTemplateCode(rule.templateCode, rule.category)) {
            setRecommendedWarning({rule, action: 'delete'});

            return;
        }

        setRules((prev) => prev.filter((item) => item.clientId !== rule.clientId));
    }, []);
    const confirmRecommendedWarning = () => {
        if (!recommendedWarning) return;

        if (recommendedWarning.action === 'delete') {
            setRules((prev) => prev.filter((item) => item.clientId !== recommendedWarning.rule.clientId));
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
                <div className={`flex min-h-[180px] ${surfaceWidthClassName} items-center justify-center rounded-[18px] bg-white`}>
                    <PageState
                        tone="loading"
                        layout="inline"
                        loadingColor="purple"
                        title={t('page.makeShift.constraints.state.loading')}
                        className="min-h-[180px] py-0"
                    />
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
                                <button
                                    type="button"
                                    onClick={resetRulesToImportantDefaults}
                                    className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-[#F8F9FB] px-4 font-apple text-[13px] font-bold text-gray-4 transition-colors hover:bg-[#EEF0F4] hover:text-sub-1 focus-visible:ring-2 focus-visible:ring-main-1/25 focus-visible:outline-none"
                                >
                                    <RotateCcw className="size-4" />
                                    {t('page.makeShift.constraints.action.reset')}
                                </button>
                            </>
                        }
                    >
                        <div className="space-y-2.5">
                            {softRuleViewModels.map(({rule, template, softTemplate, highlighted, isImportant, isRecommended}) => (
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
                            ))}
                        </div>
                    </Section>
                </div>
            </div>

            <SoftRuleModal
                open={softModalOpen}
                templates={softTemplates}
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
