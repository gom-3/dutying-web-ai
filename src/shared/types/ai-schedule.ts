export type TAiHardConstraintViolation = {
    severity: 'HARD';
    constraint: string;
    rule: string;
    date: string;
    shift: string;
    required: number;
    actual: number;
};

export type TAiSoftConstraintViolation = {
    severity: 'SOFT';
    constraint: string;
    rule: string;
    nurse_id: string;
    night_count: number;
};

export type TAiValidation = {
    valid: boolean;
    hard_constraints_violated: TAiHardConstraintViolation[];
    soft_constraints_violated: TAiSoftConstraintViolation[];
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
