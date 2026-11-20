import type {TOnboardingWardDraft, TOnboardingWardShiftType} from './draft';
import {normalizePreviousScheduleShiftCode} from './shift-type-mapping';

const getSourceCodes = (type: TOnboardingWardShiftType) =>
    [type.importedCode, type.shortName, ...(type.shortNameAliases ?? [])].filter((code): code is string => Boolean(code?.trim()));

export function findConfiguredShiftTypeForSource(source: TOnboardingWardShiftType, configured: TOnboardingWardShiftType[]) {
    const sourceCodes = getSourceCodes(source);
    const matches = (code: string) =>
        sourceCodes.some((sourceCode) =>
            source.importedCode
                ? sourceCode === code
                : normalizePreviousScheduleShiftCode(sourceCode) === normalizePreviousScheduleShiftCode(code),
        );

    return (
        configured.find((type) => type.id === source.id) ??
        configured.find((type) => [type.importedCode, ...(type.shortNameAliases ?? [])].some((code) => code && matches(code))) ??
        configured.find((type) => matches(type.shortName))
    );
}

/** Resolve imported cells without rewriting the editable source grid. */
export function createScheduleShiftTypeResolver(draft: Pick<TOnboardingWardDraft, 'shiftTypes' | 'scheduleInputState'>) {
    const exact = new Map<string, TOnboardingWardShiftType>();
    const normalized = new Map<string, TOnboardingWardShiftType>();

    for (const type of draft.shiftTypes) {
        exact.set(type.shortName, type);

        if (!type.importedCode) normalized.set(normalizePreviousScheduleShiftCode(type.shortName), type);
    }

    for (const type of draft.shiftTypes) {
        for (const code of [type.importedCode, ...(type.shortNameAliases ?? [])]) {
            if (code && !exact.has(code)) exact.set(code, type);

            if (code && !type.importedCode && !normalized.has(normalizePreviousScheduleShiftCode(code))) {
                normalized.set(normalizePreviousScheduleShiftCode(code), type);
            }
        }
    }

    for (const source of draft.scheduleInputState?.shiftTypes ?? []) {
        const configured = findConfiguredShiftTypeForSource(source, draft.shiftTypes);

        if (!configured) continue;

        // Source identities take precedence over a newly added type that happens
        // to reuse the old abbreviation of a renamed imported type.
        for (const code of getSourceCodes(source)) {
            exact.set(code, configured);

            if (!source.importedCode) normalized.set(normalizePreviousScheduleShiftCode(code), configured);
        }
    }

    return (code: string) => exact.get(code) ?? normalized.get(normalizePreviousScheduleShiftCode(code));
}
