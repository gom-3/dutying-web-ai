import type {TOnboardingSignals} from '@dutying/api/ward';
import type {TOnboardingWardDraft} from './draft';

type TEdit = 'shiftTypesEdited' | 'possibleShiftsEdited' | 'constraintsEdited';

/** Old/resumed drafts must not acquire a false claim of complete tracking. */
export function normalizeOnboardingSignals(value: unknown): TOnboardingSignals | undefined {
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return undefined;

    const signals = value as Record<string, unknown>;

    return {
        version: 1,
        coverageComplete:
            signals.coverageComplete === true &&
            ['excelImported', 'photoImported', 'shiftTypesEdited', 'possibleShiftsEdited', 'constraintsEdited'].every(
                (key) => typeof signals[key] === 'boolean',
            ),
        excelImported: signals.excelImported === true,
        photoImported: signals.photoImported === true,
        shiftTypesEdited: signals.shiftTypesEdited === true,
        possibleShiftsEdited: signals.possibleShiftsEdited === true,
        constraintsEdited: signals.constraintsEdited === true,
    };
}

function signals(draft: TOnboardingWardDraft): TOnboardingSignals {
    return (
        normalizeOnboardingSignals(draft.onboardingSignals) ?? {
            version: 1,
            coverageComplete: false,
            excelImported: false,
            photoImported: false,
            shiftTypesEdited: false,
            possibleShiftsEdited: false,
            constraintsEdited: false,
        }
    );
}

export function withOnboardingImport(draft: TOnboardingWardDraft, format: 'EXCEL' | 'PHOTO'): TOnboardingWardDraft {
    return {...draft, onboardingSignals: {...signals(draft), [format === 'EXCEL' ? 'excelImported' : 'photoImported']: true}};
}

export function withOnboardingEdit(previous: TOnboardingWardDraft, next: TOnboardingWardDraft, edit: TEdit): TOnboardingWardDraft {
    const value = (draft: TOnboardingWardDraft) =>
        edit === 'shiftTypesEdited'
            ? draft.shiftTypes.map(({autoSeeded: _autoSeeded, ...fields}) => fields)
            : edit === 'constraintsEdited'
              ? {candidates: draft.constraintCandidates, nightRecovery: draft.twoShiftNightRecoveryDisplay}
              : draft.nurses
                    .map((nurse) => [nurse.id, [...nurse.possibleShiftTypeIds].sort()])
                    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

    if (JSON.stringify(value(previous)) === JSON.stringify(value(next))) return next;

    return {...next, onboardingSignals: {...signals(next), [edit]: true}};
}
