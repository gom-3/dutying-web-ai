import type {TReqShiftCapacityGroup, TWardShiftTypeResponse} from '@dutying/api/ward';
import {useId} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TCapacityDraftRow} from '../model/request-capacity';

const FOCUS =
    'focus-visible:bg-[#DED4FF] focus-visible:text-[#351778] focus-visible:outline-none forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2';

function CapacityNumber({
    id,
    name,
    value,
    disabled,
    invalid,
    prominent = false,
    allowEmpty = false,
    onChange,
}: {
    id: string;
    name: string;
    value: string;
    disabled: boolean;
    invalid: boolean;
    prominent?: boolean;
    allowEmpty?: boolean;
    onChange: (value: string) => void;
}) {
    const {t} = useTypedTranslation();

    return (
        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
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
                aria-describedby={invalid ? `${id}-error` : undefined}
                placeholder={t(prominent && !allowEmpty ? 'requestCapacity.enterCount' : 'requestCapacity.unlimited')}
                className={`min-w-0 [appearance:textfield] appearance-none rounded-lg px-3 text-center font-bold tabular-nums disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                    prominent
                        ? 'h-[4.5rem] w-[5.5ch] max-w-full text-[2.5rem] leading-none placeholder:text-base placeholder:font-medium placeholder:text-[#74638E]'
                        : 'h-12 w-[7.5rem] max-w-full text-xl placeholder:text-sm placeholder:font-normal placeholder:text-[#626573]'
                } ${invalid ? 'bg-[#FDE7E5] text-[#A52D26]' : prominent ? 'bg-white text-[#5630C4]' : 'bg-[#F1F2F6] text-[#252735]'} ${FOCUS}`}
                onChange={(event) => onChange(event.target.value)}
            />
            <span className={`${prominent ? 'text-xl' : 'text-base'} font-medium text-[#454856]`}>{t('requestCapacity.people')}</span>
            {invalid ? (
                <p id={`${id}-error`} className="basis-full text-sm leading-6 font-medium text-[#A52D26]">
                    {t('requestCapacity.numberError')}
                </p>
            ) : null}
        </div>
    );
}

export function RequestCapacityRule({
    row,
    type,
    groups,
    groupsOpen,
    disabled,
    showErrors,
    onChange,
    onToggleGroups,
    onRemove,
    canRemove,
}: {
    row: TCapacityDraftRow;
    type: TWardShiftTypeResponse | undefined;
    groups: TReqShiftCapacityGroup[];
    groupsOpen: boolean;
    disabled: boolean;
    showErrors: boolean;
    onChange: (patch: Partial<TCapacityDraftRow>) => void;
    onToggleGroups: () => void;
    onRemove: () => void;
    canRemove: boolean;
}) {
    const {t} = useTypedTranslation();
    const id = useId();
    const typeLabel = type?.shortName ?? t('requestCapacity.type');
    const valid = (value: string) => /^\d+$/.test(value) && Number(value) <= 10000;
    const teamInvalid = showErrors && (row.teamMax !== '' ? !valid(row.teamMax) : row.groups.length === 0);
    const hasTeamLimit = valid(row.teamMax);
    const hasGroupLimit = row.groups.length > 0;

    return (
        <article data-shift-type={row.wardShiftTypeId} className="min-w-0" aria-label={`${typeLabel} ${t('requestCapacity.title')}`}>
            <div className="rounded-xl bg-[#EEE9FC] p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-x-7 gap-y-5">
                    <h4 className="min-w-0 text-[#252735]">
                        <span className="inline-block rounded-md bg-[#6242D9] px-3 py-2 text-xl leading-7 font-bold break-all text-white">
                            {typeLabel}
                        </span>
                        <span className="mt-2 block text-base font-semibold break-words">{type?.name}</span>
                    </h4>
                    <div className="min-w-0">
                        <label htmlFor={`${id}-team`} className="mb-2 block text-sm font-semibold text-[#4C4561]">
                            {t('requestCapacity.teamDailyMax')}
                        </label>
                        <CapacityNumber
                            id={`${id}-team`}
                            name={`${typeLabel} ${t('requestCapacity.teamLimit')}`}
                            value={row.teamMax}
                            prominent
                            allowEmpty={hasGroupLimit}
                            disabled={disabled}
                            invalid={teamInvalid}
                            onChange={(teamMax) => onChange({teamMax})}
                        />
                    </div>
                    {canRemove ? (
                        <button
                            type="button"
                            disabled={disabled}
                            aria-label={`${typeLabel} ${t('requestCapacity.remove')}`}
                            onClick={onRemove}
                            className={`ml-auto min-h-11 rounded-md px-3 text-sm font-medium text-[#5C506F] hover:bg-[#DED4F8] disabled:opacity-50 ${FOCUS}`}
                        >
                            {t('requestCapacity.remove')}
                        </button>
                    ) : null}
                </div>
                <p className="mt-5 text-sm leading-6 font-medium text-[#51406F]">
                    {row.teamMax === '0'
                        ? t('requestCapacity.zeroHint')
                        : hasTeamLimit
                          ? t('requestCapacity.autoClose', {count: Number(row.teamMax)})
                          : hasGroupLimit
                            ? t('requestCapacity.groupOnly')
                            : t('requestCapacity.countHint')}
                </p>
                {hasGroupLimit && row.teamMax !== '' ? (
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange({teamMax: ''})}
                        className={`mt-1 min-h-11 rounded-md px-2 text-sm font-semibold text-[#5630C4] hover:bg-[#DED4F8] disabled:opacity-50 ${FOCUS}`}
                    >
                        {t('requestCapacity.removeTeamLimit')}
                    </button>
                ) : null}
            </div>
            {groups.length > 0 ? (
                <div className="mt-2 min-w-0 rounded-xl bg-white">
                    <button
                        type="button"
                        disabled={disabled}
                        aria-label={`${typeLabel} ${t('requestCapacity.groups')}`}
                        aria-expanded={groupsOpen}
                        aria-controls={`${id}-groups`}
                        onClick={onToggleGroups}
                        className={`flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-5 py-3 text-left text-[#363244] disabled:opacity-50 sm:px-6 ${FOCUS}`}
                    >
                        <span className="text-base font-semibold">{t('requestCapacity.groups')}</span>
                        {!groupsOpen && hasGroupLimit ? (
                            <span className="text-sm leading-6 text-[#626573]">
                                {row.groups
                                    .map((rule) =>
                                        t('requestCapacity.groupSummary', {
                                            group: groups.find((group) => group.groupId === rule.groupId)?.name ?? '',
                                            count: rule.max,
                                        }),
                                    )
                                    .join(' · ')}
                            </span>
                        ) : null}
                        <span aria-hidden="true" className="ml-auto text-xl font-normal text-[#5630C4]">
                            {groupsOpen ? '−' : '＋'}
                        </span>
                    </button>
                    <div id={`${id}-groups`} hidden={!groupsOpen} className="px-5 pb-5 sm:px-6 sm:pb-6">
                        <p className="mb-4 text-sm leading-6 text-[#626573]">
                            {t(hasTeamLimit ? 'requestCapacity.groupBoth' : 'requestCapacity.groupHint')}
                        </p>
                        <div className="grid grid-cols-1 gap-3">
                            {groups.map((group) => {
                                const value = row.groups.find((rule) => rule.groupId === group.groupId)?.max ?? '';
                                const invalid = showErrors && value !== '' && !valid(value);

                                return (
                                    <div key={group.groupId} className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2 py-1">
                                        <label
                                            htmlFor={`${id}-${group.groupId}`}
                                            className="min-w-0 flex-1 text-base font-semibold break-words text-[#363244]"
                                        >
                                            {group.name}
                                        </label>
                                        <div className="min-w-0">
                                            <CapacityNumber
                                                id={`${id}-${group.groupId}`}
                                                name={`${typeLabel} ${group.name} ${t('requestCapacity.groupLimit')}`}
                                                value={value}
                                                disabled={disabled}
                                                invalid={invalid}
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
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm leading-6 text-[#626573]">{t('requestCapacity.blankUnlimited')}</p>
                            {hasGroupLimit ? (
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => onChange({groups: []})}
                                    aria-label={`${typeLabel} ${t('requestCapacity.clearGroups')}`}
                                    className={`min-h-11 rounded-md px-2 text-sm font-medium text-[#626573] hover:bg-[#F1F2F6] disabled:opacity-50 ${FOCUS}`}
                                >
                                    {t('requestCapacity.clearGroups')}
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}
        </article>
    );
}
