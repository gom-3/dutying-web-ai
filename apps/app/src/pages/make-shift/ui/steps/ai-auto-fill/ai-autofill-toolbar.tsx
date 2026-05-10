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
    onConfirm: () => void;
    canConfirm: boolean;
};

/**
 * 사진 레퍼런스에 맞춘 상단 툴바.
 *
 * 좌: 제목 1개
 * 우: [자동 채우기 토글] [잘못된 근무 토글] | [undo/redo] | [AI 다시 채우기] [확정하기]
 *
 * 자동 채우기 토글: ON이면 AI·수동 등 전체 근무가 보이고, OFF이면 고정 근무(fixedCells)만 캘린더에 표시된다.
 * 모든 글자 크기는 clamp() 기반. 가로 폭이 줄어들면 함께 줄어든다.
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
    onConfirm,
    canConfirm,
}: TAiAutofillToolbarProps) {
    const {t} = useTypedTranslation();
    const aiActionLabel = getAiAutofillActionLabel(aiStatus);

    return (
        <div className="ai-autofill-toolbar flex w-full min-w-0 items-center justify-between gap-[clamp(8px,0.8vw,16px)]">
            <h1 className="ai-autofill-toolbar__title font-apple text-[clamp(20px,1.7vw,30px)] font-semibold whitespace-nowrap text-sub-1">
                AI가 채운 근무표를 수정해 보세요
            </h1>

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
                    <IconButton
                        className="ai-autofill-toolbar__history-undo"
                        onClick={onUndo}
                        disabled={!canUndo}
                        ariaLabel="undo"
                    >
                        <HistoryBackIcon className="size-full" />
                    </IconButton>
                    <IconButton
                        className="ai-autofill-toolbar__history-redo"
                        onClick={onRedo}
                        disabled={!canRedo}
                        ariaLabel="redo"
                    >
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
                        'flex shrink-0 items-center gap-[clamp(4px,0.4vw,8px)] rounded-[12px] px-[clamp(12px,1vw,18px)]',
                        'h-[clamp(30px,2.5vw,40px)] font-apple text-[clamp(12px,0.95vw,16px)] font-semibold whitespace-nowrap text-white',
                        'shadow-[0_2px_10px_0_rgba(102,61,250,0.25)] disabled:opacity-60',
                    )}
                    style={{backgroundImage: 'linear-gradient(105deg, #B53DFA 0%, #663DFA 100%)'}}
                >
                    <SparkleIcon className="size-[clamp(13px,1.1vw,17px)]" />
                    {t(`page.makeShift.aiRefill.${aiActionLabel}`)}
                </button>

                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={!canConfirm}
                    className={cn(
                        'ai-autofill-toolbar__cta ai-autofill-toolbar__cta--confirm',
                        'flex shrink-0 items-center justify-center rounded-[12px] bg-[#0A0F15] px-[clamp(14px,1.1vw,20px)]',
                        'h-[clamp(30px,2.5vw,40px)] font-apple text-[clamp(12px,0.95vw,16px)] font-semibold whitespace-nowrap text-white',
                        'disabled:opacity-50',
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
                'flex shrink-0 items-center gap-[clamp(3px,0.35vw,6px)] rounded-[6px] border whitespace-nowrap',
                'h-[clamp(20px,1.7vw,26px)] px-[clamp(6px,0.55vw,10px)] font-apple text-[clamp(9px,0.72vw,12px)]',
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
                'grid size-[clamp(18px,1.5vw,24px)] shrink-0 place-items-center rounded-[6px] text-sub-2.5 hover:bg-gray-7 disabled:opacity-40 disabled:hover:bg-transparent',
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
