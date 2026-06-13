/* eslint-disable @typescript-eslint/no-explicit-any */

import {type TShift} from '@/entities/shift';
import i18n from '@/i18n';

const SHIFT_EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function buildShiftExcelFileName(month: number) {
    return i18n.t('feature.shiftEditor.export.excel.fileName', {month});
}

export function buildShiftExcelSheetName(month: number) {
    return i18n.t('feature.shiftEditor.export.excel.sheetName', {month});
}

export function buildShiftExcelTitle(month: number) {
    return i18n.t('feature.shiftEditor.export.excel.title', {month});
}

export function downloadExcelBuffer(data: BlobPart, fileName: string) {
    const blob = new Blob([data], {
        type: SHIFT_EXCEL_MIME_TYPE,
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

export const shiftToExcel = async (month: number, shift: TShift) => {
    const Excel = await import('exceljs');
    const flatRows = shift.divisionShiftNurses.flatMap((row) => row);
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet(buildShiftExcelSheetName(month));

    worksheet.columns = [
        {key: 'name', width: 8, style: {alignment: {horizontal: 'center', vertical: 'middle'}}},
        {
            key: 'lastShift',
            width: 10,
            style: {alignment: {horizontal: 'center', vertical: 'middle'}},
        },
        ...(shift.days.map((day) => ({
            key: day.day.toString(),
            width: 3,
            style: {alignment: {horizontal: 'center', vertical: 'middle'}},
        })) as any),
        ...(shift.wardShiftTypes.map((x) => ({
            key: x.shortName,
            width: 8,
            style: {alignment: {horizontal: 'center', vertical: 'middle'}},
        })) as any),
        {
            key: 'WO',
            width: 8,
            style: {alignment: {horizontal: 'center', vertical: 'middle'}},
        },
    ];

    const title = worksheet.addRow({name: buildShiftExcelTitle(month)});

    title.font = {bold: true, size: 16};
    title.alignment = {horizontal: 'left'};

    const header = worksheet.addRow({
        name: i18n.t('feature.shiftEditor.export.excel.nameHeader'),
        lastShift: i18n.t('feature.shiftEditor.export.excel.previousShiftHeader'),
        ...shift.days.reduce(
            (acc, day, index) => {
                acc[index + 1] = day.day;

                return acc;
            },
            {} as {[key: string]: number},
        ),
        ...shift.wardShiftTypes.reduce(
            (acc, shiftType) => {
                acc[shiftType.shortName] = shiftType.shortName;

                return acc;
            },
            {} as {[key: string]: string},
        ),
        O: 'O',
        WO: 'WO',
    });

    shift.days.map((day) => {
        header.getCell(day.day.toString()).font = {
            color: {
                argb: day.dayType === 'workday' ? 'FF000000' : day.dayType === 'saturday' ? 'FF2029FA' : 'FFFA2D12',
            },
        };
    });

    flatRows.map((dutyRow) =>
        worksheet.addRow({
            name: dutyRow.shiftNurse.name,
            lastShift: dutyRow.lastWardShiftList
                .map((current) => (current !== null ? shift.wardShiftTypes.find((x) => x.wardShiftTypeId === current)!.shortName : ''))
                .join(''),
            ...dutyRow.wardShiftList.reduce(
                (acc, current, index) => {
                    acc[index + 1] = current != null ? shift.wardShiftTypes.find((x) => x.wardShiftTypeId === current)!.shortName : '';

                    return acc;
                },
                {} as {[key: string]: string},
            ),
            ...shift.wardShiftTypes.reduce(
                (acc, shiftType) => {
                    acc[shiftType.shortName] = dutyRow.wardShiftList.filter((current) => current === shiftType.wardShiftTypeId).length;

                    return acc;
                },
                {} as {[key: string]: number},
            ),
            WO: dutyRow.wardShiftList.filter(
                (current, i) =>
                    shift.wardShiftTypes.find((x) => x.wardShiftTypeId === current)?.isOff === true &&
                    shift.days.find((x) => x.day === i + 1)?.dayType != 'workday',
            ).length,
        }),
    );

    shift.wardShiftTypes.map((shiftType) => {
        worksheet.addRow({
            lastShift: shiftType.name,
            ...shift.days.reduce(
                (acc, _, i) => {
                    acc[i + 1] = flatRows.filter((item) => item.wardShiftList[i] === shiftType.wardShiftTypeId).length;

                    return acc;
                },
                {} as {[key: string]: number},
            ),
        });
    });

    const data = await workbook.xlsx.writeBuffer();

    downloadExcelBuffer(data, buildShiftExcelFileName(month));

    return workbook;
};
