import {cn} from '@dutying/utils/style';
import {Minus, Plus} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import {PersonIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {getDivisionDisplayLabel, getDivisionFallbackLabel} from '../../model';

export function OnboardingDivisionHeader({
    divisionNum,
    divisionName,
    itemCount,
    isEditing,
    draftName,
    canDelete,
    onStartEdit,
    onDraftNameChange,
    onSubmit,
    onCancel,
    onDelete,
}: {
    divisionNum: number;
    divisionName?: string | null;
    itemCount: number;
    isEditing: boolean;
    draftName: string;
    canDelete: boolean;
    onStartEdit: () => void;
    onDraftNameChange: (value: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    onDelete: () => void;
}) {
    const {t} = useTypedTranslation();
    const label = getDivisionDisplayLabel(divisionNum, divisionName);

    return (
        <div className="mb-1.5 flex h-8 items-center gap-2 px-1">
            {isEditing ? (
                <input
                    autoFocus
                    value={draftName}
                    maxLength={50}
                    placeholder={getDivisionFallbackLabel(divisionNum)}
                    className="h-7 w-[168px] rounded-[7px] border border-main-2 bg-white px-2 font-apple text-[13px] font-semibold text-sub-1 ring-2 ring-main-2/15 outline-none"
                    onChange={(event) => onDraftNameChange(event.target.value)}
                    onFocus={(event) => event.currentTarget.select()}
                    onBlur={onSubmit}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            onCancel();
                        }

                        if (event.key === 'Enter') {
                            event.preventDefault();
                            onSubmit();
                        }
                    }}
                />
            ) : (
                <button
                    type="button"
                    className="inline-flex h-7 max-w-[240px] items-center gap-1.5 rounded-[7px] px-2.5 font-apple text-[13px] font-semibold text-gray-3 transition-colors hover:bg-white hover:text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1"
                    title={label}
                    onClick={onStartEdit}
                >
                    <span className="truncate">{label}</span>
                    <span className="inline-flex items-center gap-0.5 font-poppins text-[11px] font-semibold text-gray-4 tabular-nums">
                        <PersonIcon className="h-3 w-3" aria-hidden="true" />
                        {itemCount}
                    </span>
                </button>
            )}
            <span className="h-px flex-1 bg-[#D8DEE8]" />
            {canDelete ? (
                <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 font-apple text-[12px] font-semibold text-gray-4 transition-colors hover:bg-white hover:text-[#D14343] focus-visible:outline-2 focus-visible:outline-main-1"
                    title={t('page.onboardingWardCreate.division.delete')}
                    aria-label={t('page.onboardingWardCreate.division.deleteAria', {divisionName: label})}
                    onClick={onDelete}
                >
                    <Minus className="h-3.5 w-3.5" strokeWidth={2.4} />
                    {t('page.onboardingWardCreate.division.delete')}
                </button>
            ) : null}
        </div>
    );
}

export function OnboardingAddDivisionButton({disabled, onClick}: {disabled?: boolean; onClick: () => void}) {
    const {t} = useTypedTranslation();
    const [isVisible, setIsVisible] = useState(false);
    const handleShow = useCallback(() => {
        if (disabled) return;

        setIsVisible(true);
    }, [disabled]);
    const handleHide = useCallback(() => {
        setIsVisible(false);
    }, []);
    const handleClick = useCallback(() => {
        if (disabled || !isVisible) return;

        onClick();
    }, [disabled, isVisible, onClick]);

    useEffect(() => {
        if (!disabled) return;

        handleHide();
    }, [disabled, handleHide]);

    return (
        <button
            type="button"
            disabled={disabled}
            aria-label={t('page.onboardingWardCreate.division.add')}
            className={cn(
                'relative flex h-2 w-full items-center justify-start px-1 text-main-1 focus-visible:outline-2 focus-visible:outline-main-1 disabled:cursor-not-allowed',
                disabled ? 'opacity-0' : 'opacity-100',
            )}
            onPointerEnter={handleShow}
            onPointerLeave={handleHide}
            onFocus={handleShow}
            onBlur={handleHide}
            onClick={handleClick}
        >
            <span
                className={cn(
                    'absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-main-3 transition-opacity duration-150',
                    isVisible ? 'opacity-100' : 'opacity-0',
                )}
            />
            <span
                aria-hidden="true"
                className={cn(
                    'absolute top-1/2 left-1 z-10 inline-flex h-6 -translate-y-1/2 items-center gap-1 rounded-[7px] bg-white px-2 font-apple text-[12px] font-semibold text-main-1 shadow-[0_4px_14px_rgba(95,100,135,0.12)] transition-opacity duration-100',
                    isVisible ? 'opacity-100' : 'opacity-0',
                )}
            >
                <Plus className="h-3 w-3" strokeWidth={2.5} />
                {t('page.onboardingWardCreate.division.add')}
            </span>
        </button>
    );
}
