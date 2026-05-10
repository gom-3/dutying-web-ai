import {cn} from '@dutying/utils/style';
import {cva, type VariantProps} from 'class-variance-authority';
import * as React from 'react';
import {ChevronLeftIcon, ChevronRightIcon} from '@/shared/assets/svg';
import {buttonVariants} from '@/shared/ui/primitives/button';

type TTeam = {
    shiftTeamId: number;
    name: string;
};

type TMonthTeamHeaderProps = {
    year: number;
    month: number;
    prevLabel: string;
    nextLabel: string;
    shiftTeams: TTeam[];
    currentShiftTeamId: number | null;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onSelectShiftTeam: (shiftTeamId: number) => void;
    emptyLabel: string;
    formatMonthLabel: (year: number, month: number) => string;
    disabled?: boolean;
    /** 이전 달 네비게이션 비활성 (/make는 이번 달보다 이전으로 이동 불가). */
    prevMonthDisabled?: boolean;
    /** 다음 달 네비게이션 비활성 (확정 근무표는 이번 달·다음 달까지만). */
    nextMonthDisabled?: boolean;
};

const managementActionVariants = cva(
    cn(
        buttonVariants({
            size: 'default',
        }),
        'rounded-[10px] border-0 font-apple font-semibold shadow-none',
    ),
    {
        variants: {
            variant: {
                primary: 'bg-main-1 text-white hover:bg-main-2',
                secondary: 'bg-main-light text-main-1 hover:bg-main-4',
                neutral: 'bg-gray-6 text-gray-3 hover:bg-gray-5',
                outline: 'border border-main-1 bg-transparent text-main-1 hover:bg-main-light',
                ghost: 'bg-transparent text-gray-4 hover:bg-gray-7 hover:text-sub-1',
            },
            size: {
                sm: 'h-[42px] px-5 text-base',
                md: 'h-10 px-4 text-xl font-medium',
                lg: 'rounded-[20px] px-[42px] py-[22px] text-2xl',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    },
);

type TActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof managementActionVariants>;

export function ManagementActionButton({className, variant, size, ...props}: TActionButtonProps) {
    return <button type="button" className={cn(managementActionVariants({variant, size}), className)} {...props} />;
}

export function DutyManagementMonthTeamHeader({
    year,
    month,
    prevLabel,
    nextLabel,
    shiftTeams,
    currentShiftTeamId,
    onPrevMonth,
    onNextMonth,
    onSelectShiftTeam,
    emptyLabel,
    formatMonthLabel,
    disabled = false,
    prevMonthDisabled = false,
    nextMonthDisabled = false,
}: TMonthTeamHeaderProps) {
    return (
        <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    className="grid size-9 place-items-center rounded-[10px] text-gray-5 transition-colors hover:bg-gray-7 hover:text-sub-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-5"
                    onClick={onPrevMonth}
                    disabled={disabled || prevMonthDisabled}
                    aria-label={prevLabel}
                >
                    <ChevronLeftIcon />
                </button>
                <div className="font-apple text-2xl font-semibold text-main-1">{formatMonthLabel(year, month)}</div>
                <button
                    type="button"
                    className="grid size-9 place-items-center rounded-[10px] text-gray-5 transition-colors hover:bg-gray-7 hover:text-sub-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-5"
                    onClick={onNextMonth}
                    disabled={disabled || nextMonthDisabled}
                    aria-label={nextLabel}
                >
                    <ChevronRightIcon />
                </button>
            </div>

            <div className="max-w-full rounded-[10px] bg-main-light px-[10px] py-[7px]">
                <div className="scrollbar-hide flex max-w-full gap-1 overflow-x-auto whitespace-nowrap">
                    {shiftTeams.map((team) => {
                        const selected = team.shiftTeamId === currentShiftTeamId;

                        return (
                            <button
                                key={team.shiftTeamId}
                                type="button"
                                onClick={() => onSelectShiftTeam(team.shiftTeamId)}
                                disabled={disabled}
                                className={cn(
                                    'flex h-[32px] items-center justify-center rounded-[10px] px-[16px] py-[6px] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                                    selected ? 'bg-main-1 text-white' : 'text-gray-3 hover:bg-white/70 disabled:hover:bg-transparent',
                                )}
                            >
                                <p className="font-apple text-base leading-normal font-medium">{team.name}</p>
                            </button>
                        );
                    })}

                    {shiftTeams.length === 0 && (
                        <div className="px-4 py-1.5 font-apple text-base font-medium text-gray-3">{emptyLabel}</div>
                    )}
                </div>
            </div>
        </div>
    );
}

type TStatusCardProps = {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
};

export function DutyManagementStatusCard({title, description, actions, className}: TStatusCardProps) {
    return (
        <div
            className={cn(
                'flex h-full min-h-[320px] flex-col items-center justify-center rounded-[20px] border border-dashed border-gray-6 bg-gray-7 px-8 py-10 text-center',
                className,
            )}
        >
            <p className="font-apple text-[28px] font-semibold text-sub-1">{title}</p>
            {description && <p className="mt-3 max-w-[480px] font-apple text-base leading-7 font-medium text-gray-3">{description}</p>}
            {actions && <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>}
        </div>
    );
}
