import {useId} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

export function AnnualLeaveBalanceControl({
    value,
    currentDays,
    onChange,
    disabled = false,
}: {
    value: string;
    currentDays: number | null;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    const {t} = useTypedTranslation();
    const inputId = useId();
    const stepFrom = value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : (currentDays ?? 0);
    const step = (direction: number) => onChange(String(Math.round((stepFrom + direction) * 1000) / 1000));
    const buttonClass =
        'flex size-12 items-center justify-center rounded-xl bg-gray-7 text-2xl font-medium text-sub-2 hover:bg-main-4 hover:text-main-1 focus-visible:bg-main-4 focus-visible:text-main-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40';

    return (
        <div className="mx-auto w-full max-w-72 space-y-2 py-1">
            <label htmlFor={inputId} className="block text-center text-sm font-medium text-sub-2">
                {t('annualLeave.balanceQuestion')}
            </label>
            <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-2">
                <button
                    type="button"
                    aria-label={t('annualLeave.decreaseDay')}
                    disabled={disabled || stepFrom - 1 < -99999}
                    onClick={() => step(-1)}
                    className={buttonClass}
                >
                    <span aria-hidden="true">−</span>
                </button>
                <div className="relative">
                    <input
                        id={inputId}
                        type="number"
                        step="0.001"
                        min={-99999}
                        max={99999}
                        required
                        disabled={disabled}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        className="h-12 w-full [appearance:textfield] rounded-xl bg-gray-7 pr-7 pl-3 text-center text-xl font-semibold text-sub-1 tabular-nums focus-visible:bg-main-4 focus-visible:text-main-1 focus-visible:outline-none disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-sub-2">
                        {t('annualLeave.dayUnit')}
                    </span>
                </div>
                <button
                    type="button"
                    aria-label={t('annualLeave.increaseDay')}
                    disabled={disabled || stepFrom + 1 > 99999}
                    onClick={() => step(1)}
                    className={buttonClass}
                >
                    <span aria-hidden="true">+</span>
                </button>
            </div>
        </div>
    );
}
