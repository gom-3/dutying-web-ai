import type {Cell} from 'exceljs';
import type {TOnboardingUploadedTeamSchedule} from './draft';

const NAME_COLUMN_INDEX = 1;
const TEAM_COLUMN_INDEX = 2;
const FIRST_DAY_COLUMN_INDEX = 3;
const DEFAULT_TEAM_NAME = '\uAC04\uD638\uC0AC 1\uD300';
const EXCEL_READ_ERROR_MESSAGE = '\uC5D1\uC140 \uD30C\uC77C\uC744 \uC77D\uC9C0 \uBABB\uD588\uC5B4\uC694.';

const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const getCellText = (cell: Cell) => {
    const value = cell.value;

    if (value === null || value === undefined) {
        return '';
    }

    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }

    if (typeof value === 'object') {
        if ('richText' in value && Array.isArray(value.richText)) {
            return value.richText.map((item) => item.text).join('');
        }

        if ('text' in value) {
            return String(value.text ?? '');
        }

        if ('result' in value) {
            return String(value.result ?? '');
        }
    }

    return String(value);
};

const readFileAsArrayBuffer = (file: File) => {
    if (typeof file.arrayBuffer === 'function') {
        return file.arrayBuffer();
    }

    return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                resolve(reader.result);

                return;
            }

            reject(new Error(EXCEL_READ_ERROR_MESSAGE));
        };
        reader.onerror = () => reject(reader.error ?? new Error(EXCEL_READ_ERROR_MESSAGE));
        reader.readAsArrayBuffer(file);
    });
};

export const parseOnboardingScheduleTemplate = async (
    file: File,
    {targetYear, targetMonth}: {targetYear: number; targetMonth: number},
): Promise<TOnboardingUploadedTeamSchedule[]> => {
    const Excel = await import('exceljs');
    const workbook = new Excel.Workbook();

    await workbook.xlsx.load(await readFileAsArrayBuffer(file));

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
        return [];
    }

    const dayCount = getDaysInMonth(targetYear, targetMonth);
    const teamOrder: string[] = [];
    const rowsByTeamName = new Map<string, TOnboardingUploadedTeamSchedule['rows']>();

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        const name = getCellText(row.getCell(NAME_COLUMN_INDEX)).trim();
        const teamName = getCellText(row.getCell(TEAM_COLUMN_INDEX)).trim() || DEFAULT_TEAM_NAME;
        const shifts = Object.fromEntries(
            Array.from({length: dayCount}, (_, index) => {
                const day = index + 1;
                const shift = getCellText(row.getCell(FIRST_DAY_COLUMN_INDEX + index)).trim();

                return [String(day), shift] as const;
            }).filter(([, shift]) => Boolean(shift)),
        );

        if (!name && Object.keys(shifts).length === 0) {
            continue;
        }

        if (!rowsByTeamName.has(teamName)) {
            teamOrder.push(teamName);
            rowsByTeamName.set(teamName, []);
        }

        rowsByTeamName.get(teamName)?.push({
            name,
            shifts,
        });
    }

    return teamOrder.map((teamName) => ({
        teamName,
        rows: rowsByTeamName.get(teamName) ?? [],
    }));
};
