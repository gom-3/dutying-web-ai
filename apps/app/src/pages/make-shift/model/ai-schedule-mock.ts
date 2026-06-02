import type {TAutofillResponse} from '@dutying/api/ward';
import type {TDutyDoc} from '@/features/shift-editor';
import type {TAiScheduleProvider} from './ai-schedule-contract';

function buildMockAutofillResponse(doc: TDutyDoc, draftRevision: number, rulesHash: string): TAutofillResponse {
    const patterns = ['D', 'D', 'E', 'E', 'N', 'N', 'O', 'O'];
    const changedCells = doc.rows.flatMap((row, rowIdx) =>
        doc.columns
            .map((date, colIdx) => {
                const key = `${row.workerId}|${date}`;

                if (doc.fixedCells[key] === true || doc.requestCells[key] === true) return null;

                const shiftCode = patterns[(colIdx + rowIdx) % patterns.length]!;

                return {
                    cellKey: `${row.workerId}:${date}`,
                    shiftNurseId: Number(row.workerId),
                    date,
                    wardShiftTypeId: 0,
                    shiftCode,
                    source: 'AI',
                    fixed: false,
                };
            })
            .filter((cell): cell is NonNullable<typeof cell> => cell !== null),
    );

    return {
        operationType: 'GENERATE',
        draftRevision,
        resultType: 'PATCH',
        changedCells,
        validation: {
            draftRevision,
            rulesHash,
            summary: {valid: true, hardCount: 0, softCount: 0, totalCount: 0},
            violations: [],
        },
        unmetInstructions: [],
        sameAsPrevious: false,
    };
}

export const mockAiScheduleProvider: TAiScheduleProvider = {
    generate: async ({doc, draftRevision, rulesHash}) => buildMockAutofillResponse(doc, draftRevision, rulesHash),
};
