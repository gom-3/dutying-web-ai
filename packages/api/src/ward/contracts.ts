import type {
    TDay,
    TDutyRequest,
    TRequestShift,
    TShift,
    TShiftWorkflowStatus,
    TShiftNurse,
    TShiftTeam,
    TWaitingNurse,
    TWard,
    TWardConstraint,
    TWardShiftClassification,
    TWardShiftType,
} from '@dutying/domain';
import type {TNurseResponse, TUpdateNurseDTO} from '../nurse';

export type TWaitingNurseResponse = TWaitingNurse;
export type TWardConstraintResponse = TWardConstraint;
export type TWardShiftTypeResponse = TWardShiftType;
export type TShiftTeamResponse = TShiftTeam;
export type TWardResponse = TWard;
export type TShiftNurseResponse = TShiftNurse;
export type TDayResponse = TDay;
export type TShiftResponse = TShift;
export type TRequestShiftResponse = TRequestShift;
export type TDutyRequestResponse = TDutyRequest;

export type TWardReqShiftPendingCountResponse = {
    totalPendingCount: number;
};

export type TReqShiftReceptionSettingsResponse = {
    enabled: boolean;
    startDay: number;
    startTime: string;
    endDay: number;
    endTime: string;
    notifyOnOpen: boolean;
    notifyBeforeDeadline: boolean;
    notifyBeforeDeadlineHours: number;
    updatedAt?: string | null;
};

export type TUpdateReqShiftReceptionSettingsDTO = {
    enabled: boolean;
    startDay: number;
    startTime: string;
    endDay: number;
    endTime: string;
    notifyOnOpen: boolean;
    notifyBeforeDeadline: boolean;
    notifyBeforeDeadlineHours: number;
};

export type TWardChatMessageResponse = {
    messageId: number;
    moimId: number;
    wardId: number;
    senderAccountId: number | null;
    senderWardAdminAccountId?: number | null;
    senderType?: 'ACCOUNT' | 'WARD_ADMIN';
    senderName: string;
    senderProfileImgUrl?: string | null;
    text: string;
    sentAt: string;
    isDeleted: boolean;
};

export type TWardChatMessagesResponse = {
    messages: TWardChatMessageResponse[];
    nextCursorMessageId: number | null;
    lastReadMessageId: number | null;
    unreadCount: number;
};

export type TWardChatUnreadCountResponse = {
    moimId: number;
    wardId: number;
    unreadCount: number;
};

export type TWardAdminRole = 'OWNER' | 'EDITOR';

export type TWardAdminStatus = 'ACTIVE' | 'RESERVED';

export const WARD_ADMIN_MAX_COUNT = 10;

export type TWardAdminMembershipResponse = {
    membershipId?: number;
    wardAdminMembershipId?: number;
    accountId: number;
    wardId?: number;
    loginId?: string | null;
    email?: string | null;
    role: TWardAdminRole;
    status?: 'ACTIVE';
    createdAt?: string;
};

export type TWardReservedAdminEmailResponse = {
    emailRegistrationId: number;
    wardId?: number;
    email: string;
    role: Exclude<TWardAdminRole, 'OWNER'>;
    status: 'RESERVED';
    createdAt?: string;
};

export type TWardAdminEmailRegistrationResponse = {
    emailRegistrationId?: number;
    membershipId?: number;
    accountId?: number;
    wardId: number;
    email: string;
    role: Exclude<TWardAdminRole, 'OWNER'>;
    status: TWardAdminStatus;
};

export type TWardAdminInvitationResponse = {
    invitationId: number;
    invitedEmail: string;
    invitedName?: string | null;
    role: Exclude<TWardAdminRole, 'OWNER'>;
    status: 'PENDING' | 'ACCEPTED' | 'CANCELED' | 'EXPIRED';
    invitedAt?: string;
    expiresAt?: string | null;
};

export type TWardAdminsResponse = {
    members: TWardAdminMembershipResponse[];
    reservedEmails?: TWardReservedAdminEmailResponse[];
    invitations?: TWardAdminInvitationResponse[];
};

export type TCreateWardAdminEmailDTO = {
    email: string;
    role: Exclude<TWardAdminRole, 'OWNER'>;
};

export type TCreateWardAdminInvitationDTO = {
    invitedEmail: string;
    invitedName?: string;
    role: Exclude<TWardAdminRole, 'OWNER'>;
};

export type TAddWardAdminByLoginIdDTO = {
    loginId: string;
    role: Exclude<TWardAdminRole, 'OWNER'>;
};

export type TWardChatMessageListOptions = {
    cursorMessageId?: number;
    size?: number;
};

export type TCreateWardChatMessageDTO = {
    text: string;
    clientMessageId: string;
};

export type TReadWardChatDTO = {
    lastReadMessageId: number;
};

export type TShiftConstraintSeverity = 'HARD' | 'SOFT';

export type TShiftConstraintOption = {
    type: string;
    label?: string;
    nurseId?: number;
    name?: string;
    wardShiftTypeId?: number;
    code?: string;
    day?: number;
    level?: number;
    proficiency?: number;
    isPreceptor?: boolean;
    isPreceptee?: boolean;
};

export type TShiftConstraintOptions = Record<string, TShiftConstraintOption[]>;

export type TShiftConstraintSlot = {
    key: string;
    label: string;
    inputType: string;
    optionGroup?: string;
    required?: boolean;
    min?: number | null;
    max?: number | null;
};

export type TShiftConstraintTemplate = {
    templateCode: string;
    category: string;
    displayTemplate: string;
    severity: TShiftConstraintSeverity;
    allowedSeverities: TShiftConstraintSeverity[];
    supportedInGenerator: boolean;
    supportedInValidator: boolean;
    slots: TShiftConstraintSlot[];
};

export type TShiftConstraintRuleCandidatesResponse = {
    schemaVersion: number;
    wardId: number;
    shiftTeamId: number;
    options: TShiftConstraintOptions;
    templates: TShiftConstraintTemplate[];
};

export type TShiftConstraintRuleResponse = {
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

export type TShiftConstraintRulesResponse = {
    schemaVersion: number;
    wardId: number;
    shiftTeamId: number;
    rules: TShiftConstraintRuleResponse[];
};

export type TUpdateShiftConstraintRulesDTO = {
    rules: {
        shiftConstraintRuleId?: number;
        templateCode: string;
        severity: TShiftConstraintSeverity;
        sortOrder: number;
        params: Record<string, unknown>;
        selected?: boolean;
        isImportant?: boolean;
    }[];
};

export type TAiConstraintViolationPeriod = {
    start_day: number;
    end_day: number;
    start_date?: string;
    end_date?: string;
    label?: string;
};

/** LLM generate API `validation.*_constraints_violated` 항목 (dev/prod 공통 확장 필드) */
export type TAiConstraintViolation = {
    id: string;
    type?: string;
    severity: 'HARD' | 'SOFT';
    constraint?: string;
    title?: string;
    message: string;
    message_key?: string | null;
    messageKey?: string | null;
    message_args?: Record<string, string | number | boolean | null | undefined> | null;
    messageArgs?: Record<string, string | number | boolean | null | undefined> | null;
    rule?: string;
    nurse_id?: string | null;
    nurseId?: string | number | null;
    nurse_name?: string | null;
    nurseName?: string | null;
    shift?: string;
    expected?: string | number | null;
    actual?: string | number | null;
    period?: TAiConstraintViolationPeriod;
    affected_days?: number[];
    detected_day?: number;
};

export type TAiValidation = {
    valid: boolean;
    hard_constraints_violated: TAiConstraintViolation[];
    soft_constraints_violated: TAiConstraintViolation[];
    warnings: string[];
};

export type TAiMetrics = {
    night_shift_counts: Record<string, number>;
    weekend_shift_counts: Record<string, number>;
    fairness_score: number;
    satisfaction_estimate: number;
    constraint_violations: number;
    revision_estimate: number;
};

export type TAiScheduleResponse = {
    generation_id: number;
    schedule: Record<string, string[]>;
    validation: TAiValidation;
    metrics: TAiMetrics;
    explainable_reasons: string[];
    status: string;
    llm_model: string;
    generation_time_ms: number;
    created_at: string;
};

/** Spring schedule authoring — 셀/행 순서 공통 DTO */
export type TSnapshotCellDTO = {
    cellKey?: string;
    shiftNurseId: number;
    nurseId?: number;
    date: string;
    wardShiftTypeId: number | null;
    shiftCode?: string;
    source?: string;
    fixed?: boolean;
};

export type TSnapshotRowOrderDTO = {
    shiftNurseId: number;
    nurseId?: number;
    displayOrder: number;
    priority?: number;
    divisionNum: number;
};

export type TScheduleShiftTypeDto = {
    wardShiftTypeId: number;
    code: string;
    name: string;
    isOff: boolean;
    isCounted: boolean;
    classification: TWardShiftClassification;
    startTime: string;
    endTime: string;
    color: string;
    isActive?: boolean;
};

export type TScheduleRowDto = {
    shiftNurseId: number;
    nurseId: number;
    name: string;
    proficiency: number;
    isPreceptor: boolean;
    isPreceptee: boolean;
    isDutyManager: boolean;
    isWardManager: boolean;
    isWorker: boolean;
    divisionNum: number;
    priority: number;
};

export type TScheduleRuleDto = {
    shiftConstraintRuleId: number;
    templateCode: string;
    category: string;
    severity: TShiftConstraintSeverity;
    displayText: string;
    params: Record<string, Record<string, unknown>>;
    sortOrder: number;
    isValid?: boolean;
    invalidReason?: string;
};

export type TScheduleRequestShiftDto = {
    shiftNurseId: number;
    nurseId: number;
    date: string;
    wardShiftTypeId: number;
    shiftCode: string;
    isAccepted: boolean;
    isRequested: boolean;
};

export type TSnapshotSummaryDto = {
    snapshotId: number;
    title: string;
    year: number;
    month: number;
    cellCount: number;
    emptyCellCount: number;
    hardCount?: number;
    softCount?: number;
    totalCount?: number;
    createdAt: string;
    updatedAt: string;
};

export type TWorkspaceScheduleResponse = {
    wardId: number;
    shiftTeamId: number;
    year: number;
    month: number;
    /** YYYY-MM-DD */
    days: string[];
    shiftTypes: TScheduleShiftTypeDto[];
    rows: TScheduleRowDto[];
    rowOrder: TSnapshotRowOrderDTO[];
    cells: TSnapshotCellDTO[];
    wardShiftBase: TSnapshotCellDTO[];
    requestShifts: TScheduleRequestShiftDto[];
    rules: TScheduleRuleDto[];
    rulesHash: string;
    latestSnapshot: TSnapshotSummaryDto | null;
    confirmedSnapshot?: TSnapshotSummaryDto | null;
    workflowStatus?: TShiftWorkflowStatus | null;
    workflowStep?: number | null;
};

export type TUpdateShiftWorkflowDTO = {
    workflowStatus: TShiftWorkflowStatus;
    workflowStep?: number | null;
};

export type TShiftWorkflowResponse = {
    workflowStatus: TShiftWorkflowStatus;
    workflowStep: number | null;
};

export type TValidationSummaryDto = {
    valid: boolean;
    hardCount: number;
    softCount: number;
    totalCount: number;
};

export type TAffectedCellDto = {
    cellKey: string;
    shiftNurseId: number;
    nurseId?: number;
    nurseName?: string;
    date: string;
    wardShiftTypeId: number | null;
    shiftCode?: string | null;
};

export type TScheduleViolationPeriodDto = {
    startDate?: string;
    endDate?: string;
    dates?: string[];
};

export type TScheduleViolationDisplayContextDto = {
    period?: TScheduleViolationPeriodDto | null;
    affectedCells: TAffectedCellDto[];
};

export type TScheduleViolationDto = {
    violationId: string;
    ruleId: number;
    templateCode: string;
    severity: TShiftConstraintSeverity;
    message: string;
    period?: TScheduleViolationPeriodDto | null;
    affectedCells: TAffectedCellDto[];
    displayContext?: TScheduleViolationDisplayContextDto | null;
    fixable: boolean;
};

export type TValidationRes = {
    draftRevision: number;
    rulesHash: string;
    summary: TValidationSummaryDto;
    violations: TScheduleViolationDto[];
};

export type TValidateSnapshotDTO = {
    year: number;
    month: number;
    draftRevision: number;
    rulesHash: string;
    cells: TSnapshotCellDTO[];
    rowOrder: TSnapshotRowOrderDTO[];
};

export type TAutofillTargetDto = {
    ruleId: number;
    violationId: string;
    affectedCellKeys: string[];
};

export type TAutofillDTO = {
    year: number;
    month: number;
    prompt?: string;
    baseSnapshotId?: number;
    draftRevision?: number;
    rulesHash?: string;
    rowOrder: TSnapshotRowOrderDTO[];
    cells: TSnapshotCellDTO[];
    target?: TAutofillTargetDto;
    lockedCellKeys?: string[];
    returnMode?: 'PATCH';
};

export type TAutofillResponse = {
    operationType: 'GENERATE' | 'REPAIR';
    draftRevision: number;
    resultType: 'PATCH';
    changedCells: TSnapshotCellDTO[];
    validation: TValidationRes;
    unmetInstructions: string[];
    sameAsPrevious: boolean;
};

export type TSaveSnapshotDTO = {
    snapshotId?: number;
    title: string;
    year: number;
    month: number;
    prompt?: string;
    baseHash?: string;
    cells: TSnapshotCellDTO[];
    rowOrder: TSnapshotRowOrderDTO[];
};

export type TSnapshotSaveRes = {
    snapshotId: number;
    title: string;
    year: number;
    month: number;
    savedAt: string;
};

export type TSnapshotListRes = {
    snapshots: TSnapshotSummaryDto[];
};

export type TSnapshotDetailRes = {
    snapshotId: number;
    title: string;
    year: number;
    month: number;
    prompt?: string;
    baseHash?: string;
    rowOrder: TSnapshotRowOrderDTO[];
    cells: TSnapshotCellDTO[];
    createdAt: string;
    updatedAt: string;
};

export type TPublishSnapshotDTO = {
    overwriteWardShift?: boolean;
    applyRowOrder?: boolean;
};

export type TPublishSnapshotRes = {
    snapshotId: number;
    published: boolean;
    publishedWardShiftCount: number;
    emptyCellCount: number;
    rowOrderApplied: boolean;
    publishedAt: string;
};

export interface IWardAPI {
    getWard: (wardId: number) => Promise<TWardResponse>;
    getWardConstraint: (wardId: number, shiftTeamId: number) => Promise<TWardConstraintResponse>;
    getShiftConstraintRuleCandidates: (wardId: number, shiftTeamId: number) => Promise<TShiftConstraintRuleCandidatesResponse>;
    getShiftConstraintRules: (wardId: number, shiftTeamId: number) => Promise<TShiftConstraintRulesResponse>;
    updateShiftConstraintRules: (
        wardId: number,
        shiftTeamId: number,
        constraintRules: TUpdateShiftConstraintRulesDTO,
    ) => Promise<TShiftConstraintRulesResponse>;
    getWardByCode: (code: string) => Promise<TWardResponse>;
    getWaitingNurses: (wardId: number) => Promise<TWaitingNurseResponse[]>;
    createWard: (createWardDTO: TCreateWardDTO) => Promise<TWardResponse>;
    createOnboardingWardDraft: (draftDTO: TCreateOnboardingWardDraftDTO) => Promise<TWardResponse>;
    getCurrentOnboardingWardDraft: () => Promise<TOnboardingWardDraftResponse | null>;
    updateOnboardingWardDraft: (wardId: number, draftDTO: TUpdateOnboardingWardDraftDTO) => Promise<TOnboardingWardDraftResponse>;
    previewOnboardingScheduleInput: (previewDTO: TOnboardingScheduleInputPreviewDTO) => Promise<TOnboardingScheduleInputPreviewResponse>;
    completeOnboardingWardDraft: (wardId: number, createWardDTO: TCreateWardDTO) => Promise<TWardResponse>;
    addMeToWaitingNurses: (wardId: number) => Promise<void>;
    connectWaitingNurses: (wardId: number, waitingNurseId: number, targetNurseId: number) => Promise<void>;
    approveWaitingNurses: (wardId: number, waitingNurseId: number, shiftTeamId: number) => Promise<void>;
    deleteWaitingNurseRequest: (wardId: number, waitingNurseId: number) => Promise<void>;
    editWard: (wardId: number, ward: TEditWardDTO) => Promise<TWardResponse>;
    updateWardConstraint: (wardId: number, shiftTeamId: number, constraint: TWardConstraintDTO) => Promise<TWardConstraintResponse>;
    deleteWaitingNurses: (wardId: number, nurseId: number) => Promise<void>;
    quitWard: (wardId: number) => Promise<void>;
    getWardChatMessages: (wardId: number, options?: TWardChatMessageListOptions) => Promise<TWardChatMessagesResponse>;
    createWardChatMessage: (wardId: number, message: TCreateWardChatMessageDTO) => Promise<TWardChatMessageResponse>;
    readWardChat: (wardId: number, read: TReadWardChatDTO) => Promise<void>;
    getWardChatUnreadCount: (wardId: number) => Promise<TWardChatUnreadCountResponse>;
    getMyWardChatUnreadCounts: () => Promise<TWardChatUnreadCountResponse[]>;
    getWardAdmins: (wardId: number) => Promise<TWardAdminsResponse>;
    createWardAdminEmail: (wardId: number, adminEmail: TCreateWardAdminEmailDTO) => Promise<TWardAdminEmailRegistrationResponse>;
    createWardAdminInvitation: (wardId: number, invitation: TCreateWardAdminInvitationDTO) => Promise<TWardAdminInvitationResponse>;
    addWardAdminByLoginId: (wardId: number, admin: TAddWardAdminByLoginIdDTO) => Promise<TWardAdminMembershipResponse>;
    resendWardAdminInvitation: (wardId: number, invitationId: number) => Promise<void>;
    cancelWardAdminInvitation: (wardId: number, invitationId: number) => Promise<void>;
    removeWardAdmin: (wardId: number, membershipId: number) => Promise<void>;
    removeWardAdminEmail: (wardId: number, emailRegistrationId: number) => Promise<void>;
    getReqShift: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<TRequestShiftResponse>;
    getShift: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<TShiftResponse>;
    getRequestList: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<TDutyRequestResponse[]>;
    getReqShiftPendingCount: (wardId: number) => Promise<TWardReqShiftPendingCountResponse>;
    getReqShiftReceptionSettings: (wardId: number) => Promise<TReqShiftReceptionSettingsResponse>;
    updateReqShiftReceptionSettings: (
        wardId: number,
        settings: TUpdateReqShiftReceptionSettingsDTO,
    ) => Promise<TReqShiftReceptionSettingsResponse>;
    updateShift: (
        wardId: number,
        year: number,
        month: number,
        day: number,
        shiftNurseId: number,
        wardShiftTypeId: number | null,
    ) => Promise<null>;
    updateShifts: (wardId: number, wardShifts: TWardShiftsDTO) => Promise<void>;
    updateReqShift: (
        wardId: number,
        year: number,
        month: number,
        day: number,
        shiftNurseId: number,
        wardShiftTypeId: number | null,
    ) => Promise<void>;
    acceptRequestShift: (wardId: number, reqShiftId: number, isAccepted: boolean) => Promise<void>;
    postShift: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<void>;
    getShiftTeamNurses: (wardId: number, shiftTeamId: number) => Promise<TNurseResponse[]>;
    getShiftTeams: (wardId: number) => Promise<TShiftTeamResponse[]>;
    addNurseIntoShiftTeam: (wardId: number, shiftTeamId: number, addShiftTeamNurseDTO: TAddShiftTeamNurseDTO) => Promise<TNurseResponse>;
    createShiftTeam: (wardId: number) => Promise<TShiftTeamResponse>;
    buildShiftTeam: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<TShiftTeamResponse>;
    updateShiftTeam: (wardId: number, shiftTeamId: number, updateShiftTeamDTO: TUpdateShiftTeamDTO) => Promise<TShiftTeamResponse>;
    removeNurseFromShiftTeam: (wardId: number, shiftTeamId: number, nurseId: number) => Promise<TNurseResponse>;
    deleteShiftTeam: (wardId: number, shiftTeamId: number) => Promise<TShiftTeamResponse>;
    getShiftTypes: (wardId: number) => Promise<TWardShiftTypeResponse[]>;
    createShiftType: (wardId: number, createShiftTypeDTO: TCreateShiftTypeDTO) => Promise<TWardShiftTypeResponse>;
    updateShiftType: (wardId: number, shiftTypeId: number, createShiftTypeDTO: TCreateShiftTypeDTO) => Promise<TWardShiftTypeResponse>;
    deleteShiftType: (wardId: number, shiftTypeId: number) => Promise<void>;

    getWorkspaceSchedule: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<TWorkspaceScheduleResponse>;
    updateShiftWorkflow: (
        wardId: number,
        shiftTeamId: number,
        year: number,
        month: number,
        workflowDTO: TUpdateShiftWorkflowDTO,
    ) => Promise<TShiftWorkflowResponse>;
    validateSnapshot: (wardId: number, shiftTeamId: number, validateSnapshotDTO: TValidateSnapshotDTO) => Promise<TValidationRes>;
    autofillSchedule: (
        wardId: number,
        shiftTeamId: number,
        autofillDTO: TAutofillDTO,
        options?: {signal?: AbortSignal},
    ) => Promise<TAutofillResponse>;
    getSnapshots: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<TSnapshotListRes>;
    saveSnapshot: (wardId: number, shiftTeamId: number, saveSnapshotDTO: TSaveSnapshotDTO) => Promise<TSnapshotSaveRes>;
    getSnapshot: (wardId: number, shiftTeamId: number, snapshotId: number) => Promise<TSnapshotDetailRes>;
    deleteSnapshot: (wardId: number, shiftTeamId: number, snapshotId: number) => Promise<void>;
    publishSnapshot: (
        wardId: number,
        shiftTeamId: number,
        snapshotId: number,
        publishDTO?: TPublishSnapshotDTO,
    ) => Promise<TPublishSnapshotRes>;

    /** @deprecated use getWaitingNurses */
    getWatingNurses: (wardId: number) => Promise<TWaitingNurseResponse[]>;
    /** @deprecated use addMeToWaitingNurses */
    addMeToWatingNurses: (wardId: number) => Promise<void>;
    /** @deprecated use connectWaitingNurses */
    connectWatingNurses: (wardId: number, waitingNurseId: number, targetNurseId: number) => Promise<void>;
    /** @deprecated use approveWaitingNurses */
    approveWatingNurses: (wardId: number, waitingNurseId: number, shiftTeamId: number) => Promise<void>;
    /** @deprecated use deleteWaitingNurses */
    deleteWatingNurses: (wardId: number, nurseId: number) => Promise<void>;
}

export type TCreateWardShiftTypeDTO = {
    name: string;
    shortName: string;
    color: string;
    startTime: string;
    endTime: string;
    isOff: boolean;
    isDefault: boolean;
    isCounted: boolean;
    classification: TWardShiftClassification;
    isActive?: boolean;
};

export type TCreateWardSeedNurseDTO = {
    name: string;
    phoneNum?: string | null;
    memo?: string;
    isWorker?: boolean;
    employmentDate?: string;
    level?: number | null;
    isPreceptor?: boolean;
    isPreceptee?: boolean;
    possibleShiftShortNames?: string[];
    initialShifts?: TOnboardingInitialShiftDTO[];
};

export type TCreateWardConstraintRuleDTO = {
    templateCode: string;
    severity?: TShiftConstraintSeverity;
    selected?: boolean;
    params: Record<string, unknown>;
};

export type TCreateWardShiftTeamDTO = {
    name?: string;
    nurseNames: string[];
    nurses?: TCreateWardSeedNurseDTO[];
    constraintRules?: TCreateWardConstraintRuleDTO[];
};

export type TCreateWardDTO = {
    name: string;
    hospitalName: string;
    wardShiftTypes: TCreateWardShiftTypeDTO[];
    shiftTeams: TCreateWardShiftTeamDTO[];
};

export type TCreateOnboardingWardDraftDTO = {
    name: string;
    hospitalName: string;
    draftPayload?: Record<string, unknown>;
};

export type TUpdateOnboardingWardDraftDTO = {
    name?: string;
    hospitalName?: string;
    draftPayload: Record<string, unknown>;
};

export type TOnboardingWardDraftResponse = {
    ward: TWardResponse;
    draftPayload: Record<string, unknown> | null;
};

export type TOnboardingScheduleInputPreviewDTO = {
    targetYear: number;
    targetMonth: number;
    nurseNameBlock: string;
    dutyBlock: string;
};

export type TOnboardingInitialShiftDTO = {
    date: string;
    shiftShortName: string;
};

export type TOnboardingScheduleInputPreviewShiftTypeDTO = Omit<TCreateWardShiftTypeDTO, 'startTime' | 'endTime'> & {
    startTime?: string | null;
    endTime?: string | null;
};

export type TOnboardingScheduleInputPreviewResponse = {
    targetYear: number;
    targetMonth: number;
    nurses: {
        name: string;
        displayOrder: number;
        initialShifts: TOnboardingInitialShiftDTO[];
    }[];
    wardShiftTypes: TOnboardingScheduleInputPreviewShiftTypeDTO[];
    warnings: string[];
    unresolvedCodes: string[];
};

export type TEditWardDTO = {
    name: string;
    hospitalName: string;
};

export type TAddShiftTeamNurseDTO = Omit<TUpdateNurseDTO, 'name'> & {
    name: string;
};

export type TWardConstraintDTO = TWardConstraintResponse;

export type TWardShiftsDTO = {
    shiftNurseId: number;
    date: string;
    wardShiftTypeId: number | null;
}[];

export type TLlmGenerateScheduleStrategy = 'llm_flash' | 'llm_v1' | 'llm_premium';

export type TLlmGenerateScheduleDTO = {
    shift_team_id: number;
    year_month: string;
    strategy?: TLlmGenerateScheduleStrategy;
};

export type TUpdateShiftTeamDTO = {
    name: string;
};

export type TCreateShiftTypeDTO = {
    name: string;
    shortName: string;
    color: string;
    startTime: string;
    endTime: string;
    isOff: boolean;
    isDefault: boolean;
    isCounted: boolean;
    classification: TWardShiftClassification;
};
