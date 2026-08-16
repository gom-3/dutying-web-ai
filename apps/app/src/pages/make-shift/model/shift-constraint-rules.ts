import type {
    TShiftConstraintRuleCandidatesResponse,
    TShiftConstraintRuleWarning,
    TShiftConstraintSeverity,
    TUpdateShiftConstraintRulesDTO,
} from '@dutying/api/ward';
import {WardAPI} from '@/shared/api';

export type {
    TShiftConstraintOption,
    TShiftConstraintOptions,
    TShiftConstraintRuleCandidatesResponse,
    TShiftConstraintRuleWarning,
    TShiftConstraintSeverity,
    TShiftConstraintSlot,
    TShiftConstraintTemplate,
} from '@dutying/api/ward';

export type TShiftConstraintRule = {
    shiftConstraintRuleId?: number;
    templateCode: string;
    category: string;
    severity: TShiftConstraintSeverity;
    sortOrder: number;
    params: Record<string, unknown>;
    selected?: boolean;
    isImportant?: boolean;
    displayText?: string;
    isValid?: boolean;
    invalidReason?: string | null;
};

export type TShiftConstraintRuleDraft = TShiftConstraintRule & {
    clientId: string;
};

export type TShiftConstraintRulesResponse = {
    schemaVersion: number;
    wardId: number;
    shiftTeamId: number;
    rules: TShiftConstraintRule[];
    warnings?: TShiftConstraintRuleWarning[];
};

export type TShiftConstraintRulesSavePayload = TUpdateShiftConstraintRulesDTO;

export const shiftConstraintRuleQueryKeys = {
    all: () => ['shiftConstraintRules'] as const,
    candidates: (wardId: number, shiftTeamId: number, language?: string) =>
        [...shiftConstraintRuleQueryKeys.all(), 'candidates', wardId, shiftTeamId, language ?? 'default'] as const,
    rules: (wardId: number, shiftTeamId: number, language?: string) =>
        [...shiftConstraintRuleQueryKeys.all(), 'rules', wardId, shiftTeamId, language ?? 'default'] as const,
    save: (wardId: number | null | undefined, shiftTeamId: number | null | undefined) =>
        [...shiftConstraintRuleQueryKeys.all(), 'save', wardId, shiftTeamId] as const,
};

export const getShiftConstraintRuleCandidates = async (
    wardId: number,
    shiftTeamId: number,
): Promise<TShiftConstraintRuleCandidatesResponse> => WardAPI.getShiftConstraintRuleCandidates(wardId, shiftTeamId);

export const getShiftConstraintRules = async (wardId: number, shiftTeamId: number) => {
    return WardAPI.getShiftConstraintRules(wardId, shiftTeamId);
};

export const putShiftConstraintRules = async (wardId: number, shiftTeamId: number, payload: TShiftConstraintRulesSavePayload) => {
    return WardAPI.updateShiftConstraintRules(wardId, shiftTeamId, payload);
};
