import {type TValues} from '@dutying/utils';

export const FILE_TYPE = {
    PROFILE_IMAGE: 'PROFILE_IMAGE',
    CHAT_IMAGE: 'CHAT_IMAGE',
};

export type TPresignedUrlRequest = TValues<typeof FILE_TYPE>;

export type TOnboardingWardParseApiShiftType = {
    name?: string | null;
    shortName?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    color?: string | null;
    isDefault?: boolean | null;
    isOff?: boolean | null;
    classification?: 'DAY' | 'EVENING' | 'NIGHT' | 'NIGHT_CONTINUATION' | 'OTHER_WORK' | 'OFF' | 'ANNUAL_LEAVE' | 'OTHER_LEAVE' | null;
    rotationSystem?: 'THREE' | 'TWO' | 'NONE' | null;
    paidMinutes?: number | null;
};

export type TOnboardingWardParseApiTeam = {
    name?: string | null;
};

export type TOnboardingWardParseApiNurse = {
    name?: string | null;
    memo?: string | null;
    isPreceptor?: boolean | null;
    isPreceptee?: boolean | null;
    isWorker?: boolean | null;
    employmentDate?: string | null;
    teamName?: string | null;
    possibleShiftShortNames?: Array<string | null> | null;
    assignments?: Record<string, string | null> | null;
};

export type TOnboardingWardAnalyzeApiNurseCandidate = {
    candidate_nurse_key?: string | null;
    raw_name?: string | null;
    display_order?: number | null;
    assignments?: Record<string, string | null> | null;
    monthly_counts?: Record<string, number | null> | null;
};

export type TOnboardingWardAnalyzeApiShiftTypeCandidate = {
    code?: string | null;
    classification?: string | null;
    confidence?: number | null;
    observed_count?: number | null;
};

export type TOnboardingWardParseApiConstraintCandidate = {
    key?: string | null;
    templateCode?: string | null;
    template_code?: string | null;
    category?: string | null;
    params?: Record<string, unknown> | null;
    candidateValue?: unknown;
    candidate_value?: unknown;
    severityRecommendation?: string | null;
    severity_recommendation?: string | null;
    confidence?: number | null;
    confidenceBand?: string | null;
    confidence_band?: string | null;
    evidenceSummary?: string | null;
    evidence_summary?: string | null;
    prefill?: boolean | null;
    state?: string | null;
    confirmRequired?: boolean | null;
    confirm_required?: boolean | null;
    riskNote?: string | null;
    risk_note?: string | null;
};

export type TOnboardingWardParseApiResponse = {
    fileName?: string | null;
    wardName?: string | null;
    hospitalName?: string | null;
    shiftTypes?: TOnboardingWardParseApiShiftType[] | null;
    wardShiftTypes?: TOnboardingWardParseApiShiftType[] | null;
    teams?: TOnboardingWardParseApiTeam[] | null;
    shiftTeams?: TOnboardingWardParseApiTeam[] | null;
    nurses?: TOnboardingWardParseApiNurse[] | null;
    nurse_candidates?: TOnboardingWardAnalyzeApiNurseCandidate[] | null;
    shift_type_candidates?: TOnboardingWardAnalyzeApiShiftTypeCandidate[] | null;
    constraintCandidates?: TOnboardingWardParseApiConstraintCandidate[] | null;
    constraint_candidates?: TOnboardingWardParseApiConstraintCandidate[] | null;
    quality_report?: {
        warnings?: string[] | null;
    } | null;
    blocking_questions?: string[] | null;
    warnings?: string[] | null;
    failedRows?: string[] | null;
    failedSheets?: string[] | null;
    message?: string | null;
};

export type TOnboardingWardParseOptions = {
    targetYear?: number;
    targetMonth?: number;
};

export interface IPresignedUrlResponse {
    presignedUrl: string;
    fileUrl: string;
    fileName: string;
    expiresIn: number;
}

export interface IFileAPI {
    // POST
    getPresignedUrl: (fileType: TPresignedUrlRequest, fileExtension: string) => Promise<IPresignedUrlResponse>;
    parseOnboardingWardExcel: (file: File, options?: TOnboardingWardParseOptions) => Promise<TOnboardingWardParseApiResponse>;
}
