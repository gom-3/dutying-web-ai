export type TQualityMeasurement = {state: 'KNOWN' | 'UNKNOWN'; value: number | null; reasons: string[]};
export type TQualityMetric = {
    metricId: string;
    unit: string;
    kind: 'QUALITY' | 'CHANGE_COST';
    before: TQualityMeasurement;
    after: TQualityMeasurement;
    delta: TQualityMeasurement;
    change: 'IMPROVED' | 'WORSENED' | 'UNCHANGED' | 'UNKNOWN';
};
export type TQualitySidebar = {
    contractVersion: string;
    comparisonState: string;
    observedRelation: string;
    byNurse: {shiftNurseId: string; metrics: TQualityMetric[]}[];
    harm: {
        metricId: string;
        comparableNurseCount: number;
        unknownNurseIds: string[];
        worsenedNurseIds: string[];
        worsenedNurseCount: number;
        maxWorsening: number | null;
    }[];
    unknownReasons: string[];
};
export type TFailureSuggestion = {
    suggestionId: string;
    inputDigest: string;
    baseRevision: number;
    expiresAt: string;
    verificationStatus: string;
    applyEnabled: boolean;
    changes: {kind: string; oldValue?: unknown; proposedValue?: unknown; reason?: string}[];
    impact?: {
        affectedNurseCount?: number | null;
        maxIndividualDeterioration?: number | null;
        individualDeterioration?: Record<string, {offDaysLost: number; nightDaysAdded: number; newUnmetPreferences: number; total: number}>;
    };
};
