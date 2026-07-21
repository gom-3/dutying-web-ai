import type {Cell} from 'exceljs';
import type * as ExcelJSImport from 'exceljs';
import JSZip from 'jszip';
import type {TOnboardingUploadedTeamSchedule} from './draft';

const NAME_COLUMN_INDEX = 1;
const TEAM_COLUMN_INDEX = 2;
const FIRST_DAY_COLUMN_INDEX = 3;
const EXCEL_READ_ERROR_MESSAGE = '\uC5D1\uC140 \uD30C\uC77C\uC744 \uC77D\uC9C0 \uBABB\uD588\uC5B4\uC694.';
const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const SPREADSHEET_MAIN_NAMESPACE = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const normalizePrefixedSpreadsheetXml = (xml: string) => {
    const namespaceDeclaration = new RegExp(`xmlns:([A-Za-z_][\\w.-]*)=(['"])${SPREADSHEET_MAIN_NAMESPACE}\\2`);
    const match = xml.match(namespaceDeclaration);

    if (!match) {
        return xml;
    }

    const prefix = match[1];

    return xml.replace(match[0], `xmlns="${SPREADSHEET_MAIN_NAMESPACE}"`).replace(new RegExp(`(<\\/?)(?:${prefix}):`, 'g'), '$1');
};
const normalizePrefixedSpreadsheetWorkbook = async (data: ArrayBuffer) => {
    const archive = await JSZip.loadAsync(data);

    let changed = false;

    for (const [fileName, entry] of Object.entries(archive.files)) {
        if (entry.dir || !fileName.endsWith('.xml')) {
            continue;
        }

        const xml = await entry.async('string');
        const normalizedXml = normalizePrefixedSpreadsheetXml(xml);

        if (normalizedXml === xml) {
            continue;
        }

        archive.file(fileName, normalizedXml);
        changed = true;
    }

    return changed ? archive.generateAsync({type: 'arraybuffer'}) : null;
};
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

export const normalizeOnboardingScheduleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
        return file;
    }

    try {
        const normalizedData = await normalizePrefixedSpreadsheetWorkbook(await readFileAsArrayBuffer(file));

        if (!normalizedData) {
            return file;
        }

        return new File([normalizedData], file.name, {
            type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
    } catch {
        return file;
    }
};

const loadWorkbook = async (Excel: typeof ExcelJSImport, data: ArrayBuffer) => {
    const workbook = new Excel.Workbook();

    try {
        await workbook.xlsx.load(data);

        return workbook;
    } catch (error) {
        const normalizedData = await normalizePrefixedSpreadsheetWorkbook(data);

        if (!normalizedData) {
            throw error;
        }

        const normalizedWorkbook = new Excel.Workbook();

        await normalizedWorkbook.xlsx.load(normalizedData);

        return normalizedWorkbook;
    }
};

export const parseOnboardingScheduleTemplate = async (
    file: File,
    {targetYear, targetMonth}: {targetYear: number; targetMonth: number},
): Promise<TOnboardingUploadedTeamSchedule[]> => {
    const Excel = await import('exceljs');
    const workbook = await loadWorkbook(Excel, await readFileAsArrayBuffer(file));
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
        const teamName = getCellText(row.getCell(TEAM_COLUMN_INDEX)).trim();
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
