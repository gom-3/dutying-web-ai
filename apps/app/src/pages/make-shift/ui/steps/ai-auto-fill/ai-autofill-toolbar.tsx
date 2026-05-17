import {cn} from '@dutying/utils/style';
import {HistoryBackIcon, HistoryNextIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {getAiAutofillActionLabel, type TAiAutofillStatus} from '../../../model/ai-autofill-state';

type TAiAutofillToolbarProps = {
    autoFillEnabled: boolean;
    onToggleAutoFill: () => void;
    showFaults: boolean;
    onToggleFaults: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onAiFill: () => void;
    isAiGenerating: boolean;
    aiStatus: TAiAutofillStatus;
    hasCompletedAiFill: boolean;
    onConfirm: () => void;
    canConfirm: boolean;
};

/**
 * 상단 툴바: 신청 근무 확정 탭과 같이 제목 + 보조 문구(좌), 컨트롤(우).
 */
export function AiAutofillToolbar({
    autoFillEnabled,
    onToggleAutoFill,
    showFaults,
    onToggleFaults,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onAiFill,
    isAiGenerating,
    aiStatus,
    hasCompletedAiFill,
    onConfirm,
    canConfirm,
}: TAiAutofillToolbarProps) {
    const {t} = useTypedTranslation();
    const aiActionKey = getAiAutofillActionLabel(aiStatus, hasCompletedAiFill);

    return (
        <div className="ai-autofill-toolbar flex w-full min-w-0 flex-wrap items-center justify-between gap-[clamp(10px,0.9vw,16px)]">
            <div className="ai-autofill-toolbar__titles flex min-w-0 flex-1 flex-wrap items-baseline gap-x-[clamp(12px,1.2vw,24px)] gap-y-[clamp(4px,0.4vw,8px)]">
                <h1 className="ai-autofill-toolbar__title shrink-0 font-apple text-[clamp(20px,1.7vw,30px)] font-semibold text-sub-1">
                    {t('page.makeShift.aiRefill.toolbarTitle')}
                </h1>
                <p className="ai-autofill-toolbar__hint max-w-full min-w-0 font-apple text-[clamp(13px,1.1vw,20px)] leading-snug font-medium text-gray-3">
                    {t('page.makeShift.aiRefill.toolbarHint')}
                </p>
            </div>

            <div className="ai-autofill-toolbar__actions flex shrink-0 items-center gap-[clamp(6px,0.55vw,10px)]">
                <ToggleChip
                    className="ai-autofill-toolbar__toggle ai-autofill-toolbar__toggle--auto-fill"
                    active={autoFillEnabled}
                    onClick={onToggleAutoFill}
                >
                    자동 채우기 {autoFillEnabled ? 'ON' : 'OFF'}
                </ToggleChip>

                <ToggleChip
                    className="ai-autofill-toolbar__toggle ai-autofill-toolbar__toggle--faults"
                    active={showFaults}
                    onClick={onToggleFaults}
                >
                    <span
                        className={cn(
                            'ai-autofill-toolbar__fault-swatches flex shrink-0 items-center gap-[1px] transition-opacity',
                            showFaults ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden
                    >
                        <span className="ai-autofill-toolbar__fault-swatch--error size-[clamp(8px,0.65vw,12px)] rounded-[2px] border border-[#FF0000] bg-[#FF000080]" />
                        <span className="ai-autofill-toolbar__fault-swatch--medium size-[clamp(8px,0.65vw,12px)] rounded-[2px] border border-[#FF8800] bg-[#FF88004D]" />
                        <span className="ai-autofill-toolbar__fault-swatch--warning size-[clamp(8px,0.65vw,12px)] rounded-[2px] border border-[#FFD900] bg-[#EEFF004D]" />
                    </span>
                    잘못된 근무 {showFaults ? 'ON' : 'OFF'}
                </ToggleChip>

                <span
                    className="ai-autofill-toolbar__divider mx-[clamp(2px,0.3vw,8px)] inline-flex h-[clamp(14px,1.2vw,18px)] w-px shrink-0 bg-gray-6"
                    aria-hidden
                />

                <span className="ai-autofill-toolbar__history flex items-center gap-[2px]">
                    <IconButton className="ai-autofill-toolbar__history-undo" onClick={onUndo} disabled={!canUndo} ariaLabel="undo">
                        <HistoryBackIcon className="size-full" />
                    </IconButton>
                    <IconButton className="ai-autofill-toolbar__history-redo" onClick={onRedo} disabled={!canRedo} ariaLabel="redo">
                        <HistoryNextIcon className="size-full" />
                    </IconButton>
                </span>

                <span
                    className="ai-autofill-toolbar__divider mx-[clamp(2px,0.3vw,8px)] inline-flex h-[clamp(14px,1.2vw,18px)] w-px shrink-0 bg-gray-6"
                    aria-hidden
                />

                <button
                    type="button"
                    onClick={onAiFill}
                    disabled={isAiGenerating}
                    className={cn(
                        'ai-autofill-toolbar__cta ai-autofill-toolbar__cta--ai-fill',
                        'box-border inline-flex shrink-0 cursor-pointer items-center justify-center gap-[clamp(4px,0.4vw,8px)] rounded-[12px] px-[clamp(12px,1vw,18px)] py-0',
                        'h-[clamp(30px,2.5vw,40px)] font-apple text-[clamp(12px,0.95vw,16px)] leading-none font-semibold whitespace-nowrap text-white',
                        'disabled:cursor-not-allowed disabled:opacity-60',
                    )}
                    style={{backgroundImage: 'linear-gradient(105deg, #B53DFA 0%, #663DFA 100%)'}}
                >
                    <SparkleIcon className="size-[clamp(13px,1.1vw,17px)]" />
                    {t(`page.makeShift.aiRefill.${aiActionKey}`)}
                </button>

                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={!canConfirm}
                    className={cn(
                        'ai-autofill-toolbar__cta ai-autofill-toolbar__cta--confirm',
                        'box-border inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[12px] bg-[#0A0F15] px-[clamp(14px,1.1vw,20px)] py-0',
                        'h-[clamp(30px,2.5vw,40px)] font-apple text-[clamp(12px,0.95vw,16px)] leading-none font-semibold whitespace-nowrap text-white',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                >
                    {t('page.makeShift.aiRefill.confirm')}
                </button>
            </div>
        </div>
    );
}

function ToggleChip({
    active,
    onClick,
    className,
    children,
}: {
    active: boolean;
    onClick: () => void;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'box-border inline-flex shrink-0 cursor-pointer items-center justify-center gap-[clamp(3px,0.35vw,6px)] rounded-[6px] border whitespace-nowrap',
                'h-[clamp(20px,1.7vw,26px)] px-[clamp(6px,0.55vw,10px)] py-0 font-apple text-[clamp(9px,0.72vw,12px)] leading-none',
                active ? 'border-gray-5 bg-white text-sub-2' : 'border-gray-5 bg-gray-6 text-sub-2.5 opacity-90',
                className,
            )}
        >
            {children}
        </button>
    );
}

function IconButton({
    onClick,
    disabled,
    ariaLabel,
    className,
    children,
}: {
    onClick: () => void;
    disabled?: boolean;
    ariaLabel: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
                'grid size-[clamp(18px,1.5vw,24px)] shrink-0 cursor-pointer place-items-center rounded-[6px] text-sub-2.5 hover:bg-gray-7 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
                className,
            )}
        >
            {children}
        </button>
    );
}

function SparkleIcon({className}: {className?: string}) {
    return (
        <svg
            className={cn('ai-autofill-toolbar__cta-icon--sparkle', className)}
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <path
                d="M8 1.5L9.4 5.3C9.6 5.8 10 6.2 10.5 6.4L14 7.7L10.5 9.2C10 9.4 9.6 9.8 9.4 10.3L8 14L6.6 10.3C6.4 9.8 6 9.4 5.5 9.2L2 7.7L5.5 6.4C6 6.2 6.4 5.8 6.6 5.3L8 1.5Z"
                fill="white"
            />
        </svg>
    );
}
