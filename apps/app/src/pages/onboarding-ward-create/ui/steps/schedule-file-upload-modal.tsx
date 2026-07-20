import {cn} from '@dutying/utils/style';
import * as Dialog from '@radix-ui/react-dialog';
import {Download, Loader2, UploadCloud, X} from 'lucide-react';
import {type DragEvent, useEffect, useRef, useState} from 'react';
import excelIcon from '@/shared/assets/images/excel.png';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Button} from '@/shared/ui/primitives/button';

type TUploadStatus = 'idle' | 'uploading' | 'success' | 'warning' | 'error';

type TUploadTargetMonth = {
    targetYear: number;
    targetMonth: number;
};

type TScheduleTemplateCopy = {
    worksheetName: string;
    nameHeader: string;
    teamHeader: string;
    sampleFirstName: string;
    sampleFirstTeam: string;
    sampleSecondName: string;
    sampleSecondTeam: string;
    guideSheetName: string;
    guideRows: string[];
    fileName: string;
};

interface IScheduleFileUploadModalProps {
    open: boolean;
    targetYear: number;
    targetMonth: number;
    uploadStatus: TUploadStatus;
    uploadError: string | null;
    onClose: () => void;
    onUpload: (file: File, options: TUploadTargetMonth) => Promise<void>;
}

const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const downloadExcelBuffer = (data: BlobPart, fileName: string) => {
    const blob = new Blob([data], {type: EXCEL_MIME_TYPE});
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
};
const downloadScheduleTemplate = async (year: number, month: number, copy: TScheduleTemplateCopy) => {
    const Excel = await import('exceljs');
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet(copy.worksheetName);
    const days = Array.from({length: getDaysInMonth(year, month)}, (_, index) => String(index + 1));

    worksheet.columns = [{key: 'name', width: 14}, {key: 'team', width: 12}, ...days.map((day) => ({key: day, width: 6}))];
    worksheet.addRow([copy.nameHeader, copy.teamHeader, ...days]);
    worksheet.addRow([copy.sampleFirstName, copy.sampleFirstTeam, 'D', 'E', 'N', 'O']);
    worksheet.addRow([copy.sampleSecondName, copy.sampleSecondTeam, 'E', 'N', 'O', 'D']);
    worksheet.views = [{state: 'frozen', xSplit: 2, ySplit: 1}];

    const headerRow = worksheet.getRow(1);

    headerRow.height = 24;
    headerRow.eachCell((cell) => {
        cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF107C41'}};
        cell.font = {bold: true, color: {argb: 'FFFFFFFF'}};
        cell.alignment = {horizontal: 'center', vertical: 'middle'};
    });
    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.alignment = {horizontal: 'center', vertical: 'middle'};
            cell.border = {
                top: {style: 'thin', color: {argb: 'FFE5E8EB'}},
                right: {style: 'thin', color: {argb: 'FFE5E8EB'}},
                bottom: {style: 'thin', color: {argb: 'FFE5E8EB'}},
                left: {style: 'thin', color: {argb: 'FFE5E8EB'}},
            };
        });
    });

    const guideSheet = workbook.addWorksheet(copy.guideSheetName);

    guideSheet.columns = [{width: 56}];
    guideSheet.addRows(copy.guideRows.map((row) => [row]));

    const buffer = await workbook.xlsx.writeBuffer();

    downloadExcelBuffer(buffer as BlobPart, copy.fileName);
};

function ScheduleFileUploadModal({
    open,
    targetYear,
    targetMonth,
    uploadStatus,
    uploadError,
    onClose,
    onUpload,
}: IScheduleFileUploadModalProps) {
    const {t} = useTypedTranslation();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
    const [hasDownloadedTemplate, setHasDownloadedTemplate] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const portalContainer = typeof document === 'undefined' ? undefined : (document.getElementById('modal-root') ?? document.body);
    const isUploading = uploadStatus === 'uploading';
    const canSubmit = Boolean(selectedFile) && !isUploading;
    const displayedUploadError = hasSubmitted ? uploadError : null;
    const selectFile = (file: File | undefined) => {
        if (!file) {
            return;
        }

        setSelectedFile(file);
        setHasSubmitted(false);
    };
    const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsDragging(false);
        selectFile(event.dataTransfer.files?.[0]);
    };
    const handleDownloadTemplate = async () => {
        setIsDownloadingTemplate(true);

        try {
            await downloadScheduleTemplate(targetYear, targetMonth, {
                worksheetName: t('page.onboardingWardCreate.scheduleUpload.template.worksheetName', {
                    year: targetYear,
                    month: targetMonth,
                }),
                nameHeader: t('page.onboardingWardCreate.scheduleUpload.template.nameHeader'),
                teamHeader: t('page.onboardingWardCreate.scheduleUpload.template.teamHeader'),
                sampleFirstName: t('page.onboardingWardCreate.scheduleUpload.template.sampleFirstName'),
                sampleFirstTeam: t('page.onboardingWardCreate.scheduleUpload.template.sampleFirstTeam'),
                sampleSecondName: t('page.onboardingWardCreate.scheduleUpload.template.sampleSecondName'),
                sampleSecondTeam: t('page.onboardingWardCreate.scheduleUpload.template.sampleSecondTeam'),
                guideSheetName: t('page.onboardingWardCreate.scheduleUpload.template.guideSheetName'),
                guideRows: [
                    t('page.onboardingWardCreate.scheduleUpload.template.guideRow1'),
                    t('page.onboardingWardCreate.scheduleUpload.template.guideRow2'),
                    t('page.onboardingWardCreate.scheduleUpload.template.guideRow3'),
                    t('page.onboardingWardCreate.scheduleUpload.template.guideRow4'),
                    t('page.onboardingWardCreate.scheduleUpload.template.guideRow5'),
                ],
                fileName: t('page.onboardingWardCreate.scheduleUpload.template.fileName', {
                    year: targetYear,
                    month: targetMonth,
                }),
            });
            setHasDownloadedTemplate(true);
        } finally {
            setIsDownloadingTemplate(false);
        }
    };
    const handleSubmit = async () => {
        if (!selectedFile || isUploading) {
            return;
        }

        setHasSubmitted(true);
        await onUpload(selectedFile, {targetYear, targetMonth});
    };

    useEffect(() => {
        if (!open) {
            setSelectedFile(null);
            setIsDragging(false);
            setIsDownloadingTemplate(false);
            setHasDownloadedTemplate(false);
            setHasSubmitted(false);
        }
    }, [open]);

    useEffect(() => {
        if (hasSubmitted && (uploadStatus === 'success' || uploadStatus === 'warning')) {
            onClose();
        }
    }, [hasSubmitted, onClose, uploadStatus]);

    return (
        <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && !isUploading && onClose()}>
            <Dialog.Portal container={portalContainer}>
                <Dialog.Overlay className="fixed inset-0 z-[1100] bg-[#121726]/55 backdrop-blur-[2px]" />
                <Dialog.Content className="fixed top-1/2 left-1/2 z-[1101] w-[calc(100vw-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-[24px] bg-white p-6 shadow-[0_24px_80px_rgba(18,23,38,0.2)]">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E6F4EA]">
                            <img
                                src={excelIcon}
                                alt=""
                                aria-hidden="true"
                                width={32}
                                height={32}
                                decoding="async"
                                className="h-8 w-8 object-contain"
                            />
                        </div>
                        <Dialog.Close asChild>
                            <button
                                type="button"
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-7 text-gray-3 transition-colors hover:bg-gray-6 disabled:opacity-50"
                                aria-label={t('page.member.common.close')}
                                disabled={isUploading}
                            >
                                <X className="h-4 w-4" strokeWidth={2.2} />
                            </button>
                        </Dialog.Close>
                    </div>

                    <Dialog.Title className="mt-4 font-apple text-[22px] leading-7 font-semibold text-sub-1">
                        {t('page.onboardingWardCreate.scheduleUpload.title', {month: targetMonth})}
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 font-apple text-[15px] leading-6 text-gray-3">
                        {t('page.onboardingWardCreate.scheduleUpload.description')}
                    </Dialog.Description>

                    <button
                        type="button"
                        className="mt-5 flex h-12 w-full items-center justify-between rounded-[14px] bg-[#F2F8F4] px-4 font-apple text-[15px] font-semibold text-[#107C41] transition-colors hover:bg-[#E6F4EA] disabled:cursor-not-allowed disabled:opacity-70"
                        onClick={() => void handleDownloadTemplate()}
                        disabled={isDownloadingTemplate || isUploading}
                    >
                        <span className="inline-flex items-center gap-2">
                            {isDownloadingTemplate ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Download className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                            )}
                            {t('page.onboardingWardCreate.scheduleUpload.downloadTemplate')}
                        </span>
                        <span className="font-poppins text-[12px] font-semibold text-[#4F9F6D]">.xlsx</span>
                    </button>

                    {hasDownloadedTemplate ? (
                        <label
                            className={cn(
                                'mt-4 flex min-h-[154px] cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed px-6 py-7 text-center transition-colors',
                                isDragging
                                    ? 'border-[#107C41] bg-[#F2F8F4]'
                                    : selectedFile
                                      ? 'border-[#107C41] bg-[#F7FBF8]'
                                      : 'border-[#D1D6DB] bg-[#F8FAFC] hover:border-[#8B95A1] hover:bg-[#F2F4F6]',
                                isUploading && 'cursor-wait opacity-80',
                            )}
                            onDragOver={(event) => {
                                event.preventDefault();

                                if (!isUploading) {
                                    setIsDragging(true);
                                }
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                        >
                            <input
                                ref={inputRef}
                                data-testid="schedule-file-upload-input"
                                hidden
                                type="file"
                                accept=".xlsx,.xls"
                                disabled={isUploading}
                                onChange={(event) => {
                                    selectFile(event.target.files?.[0]);
                                    event.target.value = '';
                                }}
                            />
                            <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-[#107C41] shadow-[0_8px_24px_rgba(38,55,71,0.08)]">
                                <UploadCloud className="h-6 w-6" strokeWidth={2.2} aria-hidden="true" />
                            </span>
                            <span className="mt-4 font-apple text-[16px] font-semibold text-sub-1">
                                {selectedFile ? selectedFile.name : t('page.onboardingWardCreate.scheduleUpload.dropzoneTitle')}
                            </span>
                            <span className="mt-1 font-apple text-[13px] text-gray-3">
                                {t('page.onboardingWardCreate.scheduleUpload.fileSupport')}
                            </span>
                        </label>
                    ) : null}

                    {displayedUploadError ? (
                        <p className="mt-3 rounded-[12px] bg-[#FFF5F5] px-4 py-3 font-apple text-[14px] leading-5 text-[#C55252]">
                            {displayedUploadError}
                        </p>
                    ) : null}

                    <div className="mt-6 grid grid-cols-2 gap-2">
                        <Button
                            type="button"
                            variant="soft"
                            className="h-11 rounded-[12px] text-[15px]"
                            disabled={isUploading}
                            onClick={onClose}
                        >
                            {t('shared.confirmActionDialog.cancel')}
                        </Button>
                        <Button
                            type="button"
                            className="h-11 rounded-[12px] bg-main-1 text-[15px] font-semibold text-white shadow-none hover:bg-main-1-hover disabled:bg-main-3"
                            disabled={!canSubmit}
                            onClick={() => void handleSubmit()}
                        >
                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                            {isUploading
                                ? t('page.onboardingWardCreate.scheduleUpload.submitting')
                                : t('page.onboardingWardCreate.scheduleUpload.submit')}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

export default ScheduleFileUploadModal;
