import {ArrowUpFromLine, ChevronRight, FileImage, FileSpreadsheet} from 'lucide-react';
import {type DragEvent, type Ref, useEffect, useRef, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {ONBOARDING_UPLOAD_ACCEPT} from '../../model/adapter';
import {HighlightedText} from '../section-header';
import ScheduleMonthPicker from './schedule-month-picker';
import styles from './schedule-upload-intro.module.css';

interface IScheduleUploadIntroProps {
    isReloadingFile?: boolean;
    chooseFileButtonRef?: Ref<HTMLButtonElement>;
    targetYear: number;
    targetMonth: number;
    uploadStatus: 'idle' | 'uploading' | 'success' | 'warning' | 'error';
    uploadError: string | null;
    disabled?: boolean;
    onManualEntry: (options: {targetYear: number; targetMonth: number}) => void;
    onUpload: (file: File, options: {targetYear: number; targetMonth: number}) => Promise<void>;
}

function ScheduleUploadIntro({
    isReloadingFile = false,
    chooseFileButtonRef,
    targetYear,
    targetMonth,
    uploadStatus,
    uploadError,
    disabled = false,
    onManualEntry,
    onUpload,
}: IScheduleUploadIntroProps) {
    const {t} = useTypedTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const submittingRef = useRef(false);
    const dragDepthRef = useRef(0);
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName] = useState('');
    const [selectedMonth, setSelectedMonth] = useState({targetYear, targetMonth});
    const isUploading = uploadStatus === 'uploading';
    const isDisabled = disabled || isUploading;

    useEffect(() => {
        if (isReloadingFile) titleRef.current?.focus();
    }, [isReloadingFile]);

    const uploadFile = async (file?: File) => {
        if (!file || isDisabled || submittingRef.current) return;

        submittingRef.current = true;
        setFileName(file.name);
        setIsDragging(false);
        dragDepthRef.current = 0;

        try {
            await onUpload(file, selectedMonth);
        } finally {
            submittingRef.current = false;
        }
    };
    const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        if (isDisabled || !event.dataTransfer.types.includes('Files')) return;

        dragDepthRef.current += 1;
        setIsDragging(true);
    };

    return (
        <section className={styles.entry} aria-labelledby="schedule-entry-title">
            <header className={styles.header}>
                <h1 id="schedule-entry-title" className={styles.title} ref={titleRef} tabIndex={-1}>
                    <HighlightedText
                        text={t(
                            isReloadingFile
                                ? 'page.onboardingWardCreate.scheduleEntry.reloadTitle'
                                : 'page.onboardingWardCreate.scheduleEntry.title',
                        )}
                        highlights={[
                            t(
                                isReloadingFile
                                    ? 'page.onboardingWardCreate.scheduleEntry.reloadTitleHighlight'
                                    : 'page.onboardingWardCreate.scheduleEntry.titleHighlight',
                            ),
                        ]}
                    />
                </h1>
                <p className={styles.description}>
                    {t(
                        isReloadingFile
                            ? 'page.onboardingWardCreate.scheduleEntry.reloadDescription'
                            : 'page.onboardingWardCreate.scheduleEntry.description',
                    )}
                </p>
            </header>
            <ScheduleMonthPicker value={selectedMonth} onChange={setSelectedMonth} disabled={isDisabled} />
            <div
                className={`${styles.uploadSurface} ${isDragging ? styles.dragging : ''}`}
                onDragEnter={handleDragEnter}
                onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = isDisabled ? 'none' : 'copy';
                }}
                onDragLeave={(event) => {
                    event.preventDefault();
                    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

                    if (dragDepthRef.current === 0) setIsDragging(false);
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    dragDepthRef.current = 0;
                    setIsDragging(false);
                    void uploadFile(event.dataTransfer.files?.[0]);
                }}
            >
                <input
                    ref={inputRef}
                    data-testid="schedule-entry-upload-input"
                    type="file"
                    hidden
                    accept={ONBOARDING_UPLOAD_ACCEPT}
                    disabled={isDisabled}
                    onChange={(event) => {
                        const file = event.target.files?.[0];

                        event.target.value = '';
                        void uploadFile(file);
                    }}
                />
                <button
                    ref={chooseFileButtonRef}
                    type="button"
                    className={styles.dropButton}
                    aria-busy={isUploading}
                    disabled={isDisabled}
                    aria-label={t('page.onboardingWardCreate.scheduleEntry.chooseFile')}
                    onClick={() => inputRef.current?.click()}
                >
                    <span className={styles.files} aria-hidden="true">
                        <span className={styles.photo}>
                            <FileImage />
                        </span>
                        <span className={styles.sheet}>
                            <FileSpreadsheet />
                        </span>
                    </span>
                    <span className={styles.chooseFile}>
                        <ArrowUpFromLine size={18} aria-hidden="true" />
                        {t('page.onboardingWardCreate.scheduleEntry.chooseFile')}
                    </span>
                    <span className={styles.formats}>{t('page.onboardingWardCreate.scheduleEntry.fileTypes')}</span>
                </button>
                {isUploading && (
                    <div className={styles.processing} role="status">
                        <span className={styles.scanSheet} aria-hidden="true">
                            <span className={styles.scanRows}>
                                {[0, 1, 2].map((row) => (
                                    <span className={styles.scanRow} key={row}>
                                        <i />
                                        <i />
                                        <i />
                                        <i />
                                    </span>
                                ))}
                                <span className={styles.scanMarker} />
                            </span>
                        </span>
                        <strong>{t('page.onboardingWardCreate.scheduleEntry.processingTitle')}</strong>
                        <span className={styles.fileName}>{fileName}</span>
                    </div>
                )}
            </div>
            {fileName && uploadError && (
                <div className={styles.error} role="alert">
                    <strong>{t('page.onboardingWardCreate.upload.failedTitle')}</strong>
                    <p>{uploadError}</p>
                </div>
            )}
            {!isReloadingFile && (
                <button type="button" className={styles.manual} disabled={isDisabled} onClick={() => onManualEntry(selectedMonth)}>
                    <span>{t('page.onboardingWardCreate.scheduleEntry.manualAction')}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                </button>
            )}
        </section>
    );
}

export default ScheduleUploadIntro;
