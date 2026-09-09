import JSZip from 'jszip';
import {describe, expect, it} from 'vitest';
import {parseOnboardingScheduleTemplate} from '../schedule-template-parser';

const SPREADSHEET_MAIN_NAMESPACE = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const createPrefixedNamespaceWorkbook = async () => {
    const Excel = await import('exceljs');
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('근무표');

    worksheet.addRow(['이름', '팀', '1', '2', '3']);
    worksheet.addRow(['간호사01', '1팀', 'O', 'D', 'N']);

    const archive = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());

    for (const [fileName, entry] of Object.entries(archive.files)) {
        if (entry.dir || !fileName.endsWith('.xml')) {
            continue;
        }

        const xml = await entry.async('string');

        if (!xml.includes(`xmlns="${SPREADSHEET_MAIN_NAMESPACE}"`)) {
            continue;
        }

        archive.file(
            fileName,
            xml
                .replace(`xmlns="${SPREADSHEET_MAIN_NAMESPACE}"`, `xmlns:x="${SPREADSHEET_MAIN_NAMESPACE}"`)
                .replace(/(<\/?)([A-Za-z_][\w.-]*)(?=[\s>])/g, '$1x:$2'),
        );
    }

    return new File([await archive.generateAsync({type: 'arraybuffer'})], 'prefixed-schedule.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
};

describe('parseOnboardingScheduleTemplate', () => {
    it('reads workbooks whose OOXML elements use a namespace prefix', async () => {
        const file = await createPrefixedNamespaceWorkbook();

        await expect(parseOnboardingScheduleTemplate(file, {targetYear: 2026, targetMonth: 7})).resolves.toEqual([
            {
                teamName: '1팀',
                rows: [
                    {
                        name: '간호사01',
                        shifts: {1: 'O', 2: 'D', 3: 'N'},
                    },
                ],
            },
        ]);
    });
    it('ignores a hospital roster that is not the downloaded template', async () => {
        const Excel = await import('exceljs');
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('간호팀');

        worksheet.addRow(['', '2026년 07월 근무 일정표-3병동 간호팀']);
        worksheet.addRow(['', '구분', '일자', 1, 2, 3, 4, 5]);
        worksheet.addRow(['', '', '요일', '수', '목', '금', '토', '일']);
        worksheet.addRow(['', 'HN', '김지인', 'V', 'D', 'D', '/', '/']);
        worksheet.addRow(['', 'RN', '이승미', 'D', '/', 'D', 'D', '/']);

        const file = new File([await workbook.xlsx.writeBuffer()], '3병동 근무표.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        await expect(parseOnboardingScheduleTemplate(file, {targetYear: 2026, targetMonth: 7})).resolves.toEqual([]);
    });
});
