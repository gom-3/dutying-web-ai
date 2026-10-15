import type {TReqShiftCapacityGroup, TWardShiftTypeResponse} from '@dutying/api/ward';
import {useId} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TCapacityDraftRow} from '../model/request-capacity';

export type TCapacityScope = {mode: 'TEAM' | 'GROUP'; includeTeam: boolean};

const FOCUS =
    'focus-visible:bg-[#EAE4FF] focus-visible:text-[#422395] focus-visible:outline-none forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2';

function CapacityNumber({
    id,
    name,
    value,
    optional = false,
    disabled,
    invalid,
    onChange,
}: {
    id: string;
    name: string;
    value: string;
    optional?: boolean;
    disabled: boolean;
    invalid: boolean;
    onChange: (value: string) => void;
}) {
    const {t} = useTypedTranslation();
    const number = Number(value);

    return (
        <div className="flex max-w-full flex-wrap items-center gap-2">
            <div className={`flex max-w-full items-center overflow-hidden rounded-lg ${invalid ? 'bg-[#FDEDEC]' : 'bg-[#F1F1F6]'}`}>
                <button
                    type="button"
                    className={`h-[48px] w-[44px] shrink-0 text-[22px] text-[#505464] hover:bg-[#E7E5F1] disabled:opacity-30 ${FOCUS}`}
                    aria-label={`${name} ${t('requestCapacity.decrease')}`}
                    disabled={disabled || value === '' || number <= 0}
                    onClick={() => onChange(String(Math.max(0, number - 1)))}
                >
                    <span aria-hidden="true">−</span>
                </button>
                <input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={10000}
                    step={1}
                    value={value}
                    disabled={disabled}
                    aria-label={name}
                    aria-invalid={invalid || undefined}
                    placeholder={t(optional ? 'requestCapacity.unlimited' : 'requestCapacity.enterCount')}
                    className={`h-[48px] min-w-0 [appearance:textfield] appearance-none bg-transparent text-center font-semibold text-[#242633] disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${value === '' ? 'w-24 text-sm' : 'w-[7ch] text-xl'} ${FOCUS}`}
                    onChange={(event) => onChange(event.target.value)}
                />
                <button
                    type="button"
                    className={`h-[48px] w-[44px] shrink-0 text-[22px] text-[#505464] hover:bg-[#E7E5F1] disabled:opacity-30 ${FOCUS}`}
                    aria-label={`${name} ${t('requestCapacity.increase')}`}
                    disabled={disabled || number >= 10000}
                    onClick={() => onChange(String(Math.min(10000, Math.max(0, number) + 1)))}
                >
                    <span aria-hidden="true">＋</span>
                </button>
            </div>
            <span className="text-sm text-[#505464]">{t('requestCapacity.people')}</span>
        </div>
    );
}

export function RequestCapacityRule({
    row,
    type,
    groups,
    scope,
    disabled,
    showErrors,
    onChange,
    onScopeChange,
    onRemove,
    canRemove,
}: {
    row: TCapacityDraftRow;
    type: TWardShiftTypeResponse | undefined;
    groups: TReqShiftCapacityGroup[];
    scope: TCapacityScope;
    disabled: boolean;
    showErrors: boolean;
    onChange: (patch: Partial<TCapacityDraftRow>) => void;
    onScopeChange: (scope: TCapacityScope) => void;
    onRemove: () => void;
    canRemove: boolean;
}) {
    const {t} = useTypedTranslation();
    const id = useId();
    const typeLabel = type?.shortName ?? t('requestCapacity.type');
    const teamName = `${typeLabel} ${t('requestCapacity.teamLimit')}`;
    const valid = (value: string) => /^\d+$/.test(value) && Number(value) <= 10000;
    const teamInvalid = showErrors && !valid(row.teamMax);
    const hasGroups = scope.mode === 'GROUP';
    const missingGroupLimit = hasGroups && !(scope.includeTeam && valid(row.teamMax)) && row.groups.length === 0;

    return (
        <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 text-[#242633]">
                    <span className="text-xl font-bold">{typeLabel}</span>
                    <span className="text-sm text-[#626573]">{type?.name}</span>
                </h4>
                {groups.length > 0 ? (
                    <div
                        className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-[#F1F1F6] p-1"
                        role="group"
                        aria-label={`${typeLabel} ${t('requestCapacity.scope')}`}
                    >
                        {(['TEAM', 'GROUP'] as const).map((mode) => (
                            <button
                                key={mode}
                                type="button"
                                disabled={disabled}
                                aria-pressed={scope.mode === mode}
                                aria-label={`${typeLabel} ${t(mode === 'TEAM' ? 'requestCapacity.teamScope' : 'requestCapacity.groupScope')}`}
                                onClick={() =>
                                    onScopeChange({
                                        ...scope,
                                        mode,
                                        ...(mode === 'GROUP' && scope.mode === 'TEAM' ? {includeTeam: row.teamMax !== ''} : {}),
                                    })
                                }
                                className={`min-h-11 min-w-20 rounded-md px-3 text-sm font-medium disabled:opacity-50 ${scope.mode === mode ? 'bg-white text-[#5532C8] forced-colors:underline' : 'text-[#626573] hover:bg-[#EAE9F2]'} ${FOCUS}`}
                            >
                                {t(mode === 'TEAM' ? 'requestCapacity.teamScope' : 'requestCapacity.groupScope')}
                            </button>
                        ))}
                    </div>
                ) : null}
                {canRemove ? (
                    <button
                        type="button"
                        disabled={disabled}
                        aria-label={`${typeLabel} ${t('requestCapacity.remove')}`}
                        onClick={onRemove}
                        className={`-mr-2 min-h-11 shrink-0 rounded-md px-2 text-sm text-[#626573] hover:bg-[#F1F1F6] disabled:opacity-50 ${FOCUS}`}
                    >
                        {t('requestCapacity.remove')}
                    </button>
                ) : null}
            </div>
            {hasGroups ? (
                <div className="mt-5">
                    <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-[#626573]">
                        <span>{t('requestCapacity.group')}</span>
                        <span>
                            {t('requestCapacity.dailyMax')} · {t('requestCapacity.blankUnlimited')}
                        </span>
                    </div>
                    <div className="grid gap-3">
                        {groups.map((group, index) => {
                            const value = row.groups.find((rule) => rule.groupId === group.groupId)?.max ?? '';

                            return (
                                <div key={group.groupId} className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                                    <label
                                        htmlFor={`${id}-${group.groupId}`}
                                        className="min-w-0 text-sm font-medium break-words text-[#242633]"
                                    >
                                        {group.name}
                                    </label>
                                    <CapacityNumber
                                        id={`${id}-${group.groupId}`}
                                        name={`${typeLabel} ${group.name} ${t('requestCapacity.groupLimit')}`}
                                        value={value}
                                        optional
                                        disabled={disabled}
                                        invalid={showErrors && ((value !== '' && !valid(value)) || (missingGroupLimit && index === 0))}
                                        onChange={(max) =>
                                            onChange({
                                                groups: [
                                                    ...row.groups.filter((rule) => rule.groupId !== group.groupId),
                                                    ...(max === '' ? [] : [{groupId: group.groupId, max}]),
                                                ],
                                            })
                                        }
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-5 rounded-lg bg-[#F8F7FC] px-4 py-3">
                        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md text-sm font-medium text-[#454252] focus-within:bg-[#EAE4FF] focus-within:text-[#422395]">
                            <input
                                type="checkbox"
                                checked={scope.includeTeam}
                                disabled={disabled}
                                aria-label={`${typeLabel} ${t('requestCapacity.includeTeam')}`}
                                onChange={(event) => onScopeChange({...scope, includeTeam: event.target.checked})}
                                className={`grid size-5 shrink-0 appearance-none place-content-center rounded bg-[#E1DEEC] checked:bg-[#6242D9] checked:before:text-sm checked:before:font-semibold checked:before:text-white checked:before:content-['✓'] focus-visible:before:text-[#422395] forced-colors:appearance-auto ${FOCUS}`}
                            />
                            {t('requestCapacity.includeTeam')}
                        </label>
                        {scope.includeTeam ? (
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                                <label htmlFor={`${id}-team`} className="text-sm text-[#454252]">
                                    {t('requestCapacity.teamTotal')}
                                </label>
                                <CapacityNumber
                                    id={`${id}-team`}
                                    name={teamName}
                                    value={row.teamMax}
                                    disabled={disabled}
                                    invalid={teamInvalid}
                                    onChange={(teamMax) => onChange({teamMax})}
                                />
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : (
                <div className="mt-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <label htmlFor={`${id}-team`} className="text-sm font-medium text-[#242633]">
                            {t('requestCapacity.dailyMax')}
                        </label>
                        <CapacityNumber
                            id={`${id}-team`}
                            name={teamName}
                            value={row.teamMax}
                            disabled={disabled}
                            invalid={teamInvalid}
                            onChange={(teamMax) => onChange({teamMax})}
                        />
                    </div>
                    <p className={`mt-3 text-sm leading-6 ${teamInvalid ? 'text-[#BA3830]' : 'text-[#626573]'}`}>
                        {teamInvalid
                            ? t('requestCapacity.enterCount')
                            : row.teamMax === '0'
                              ? t('requestCapacity.zeroHint')
                              : valid(row.teamMax)
                                ? t('requestCapacity.firstCome', {count: Number(row.teamMax)})
                                : t('requestCapacity.countHint')}
                    </p>
                </div>
            )}
        </div>
    );
}
