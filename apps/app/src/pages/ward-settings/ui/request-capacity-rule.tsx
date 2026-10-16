import type {TReqShiftCapacityGroup, TWardShiftTypeResponse} from '@dutying/api/ward';
import {useId} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TCapacityDraftRow} from '../model/request-capacity';
import {RequestSettingsHelp} from './request-settings-help';

const FOCUS =
    'focus-visible:bg-[#E6DFFF] focus-visible:text-[#432091] focus-visible:outline-none forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2';

function CapacityNumber({
    id,
    name,
    value,
    disabled,
    invalid,
    optional = false,
    onChange,
}: {
    id: string;
    name: string;
    value: string;
    disabled: boolean;
    invalid: boolean;
    optional?: boolean;
    onChange: (value: string) => void;
}) {
    const {t} = useTypedTranslation();

    return (
        <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                    placeholder={t(optional ? 'requestCapacity.unlimited' : 'requestCapacity.enterCount')}
                    className={`h-11 w-[6.25rem] max-w-full min-w-0 [appearance:textfield] appearance-none rounded-lg px-2 text-center text-xl font-semibold tabular-nums placeholder:text-sm placeholder:font-normal placeholder:text-[#666A79] disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${invalid ? 'bg-[#FDE7E5] text-[#A52D26]' : 'bg-white text-[#282B3B]'} ${FOCUS}`}
                    onChange={(event) => onChange(event.target.value)}
                />
                <span className="text-sm font-medium text-[#454856]">{t('requestCapacity.people')}</span>
            </div>
            {invalid ? (
                <p id={`${id}-error`} className="mt-1 text-sm leading-5 text-[#A52D26]">
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
    const hasGroupLimit = row.groups.length > 0;

    return (
        <article
            data-shift-type={row.wardShiftTypeId}
            className="min-w-0 rounded-xl bg-[#F5F6F9] px-4 py-3"
            aria-label={`${typeLabel} ${t('requestCapacity.title')}`}
        >
            <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3">
                <h4 className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 text-[#282B3B]">
                    <span className="text-base font-bold break-all">{typeLabel}</span>
                    <span className="text-sm font-medium break-words text-[#626573]">{type?.name}</span>
                </h4>
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                    <label htmlFor={`${id}-team`} className="text-sm font-medium text-[#454856]">
                        {t('requestCapacity.dailyMax')}
                    </label>
                    <CapacityNumber
                        id={`${id}-team`}
                        name={`${typeLabel} ${t('requestCapacity.teamLimit')}`}
                        value={row.teamMax}
                        optional={hasGroupLimit}
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
                        className={`min-h-11 min-w-11 rounded-lg text-xl text-[#626573] disabled:opacity-50 ${FOCUS}`}
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                ) : null}
            </div>
            {groups.length > 0 ? (
                <>
                    <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
                        <button
                            type="button"
                            disabled={disabled}
                            aria-label={`${typeLabel} ${t('requestCapacity.groups')}`}
                            aria-expanded={groupsOpen}
                            aria-controls={`${id}-groups`}
                            onClick={onToggleGroups}
                            className={`inline-flex min-h-11 max-w-full min-w-0 flex-wrap gap-2 rounded-lg px-1 text-left text-sm leading-5 font-semibold text-[#5833C5] disabled:opacity-50 ${FOCUS}`}
                        >
                            {t('requestCapacity.groupSettings')}
                            <span aria-hidden="true" className="text-xs">
                                {groupsOpen ? '▴' : '▾'}
                            </span>
                            {!groupsOpen && hasGroupLimit ? (
                                <span className="text-sm font-normal text-[#626573]">
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
                        </button>
                        {groupsOpen ? (
                            <RequestSettingsHelp label={`${typeLabel} ${t('requestCapacity.groupSettings')}`}>
                                {t('requestCapacity.groupHelp')}
                            </RequestSettingsHelp>
                        ) : null}
                        {groupsOpen && hasGroupLimit ? (
                            <button
                                type="button"
                                disabled={disabled}
                                aria-label={`${typeLabel} ${t('requestCapacity.clearGroups')}`}
                                onClick={() => onChange({groups: []})}
                                className={`ml-auto min-h-11 rounded-lg px-2 text-sm text-[#626573] disabled:opacity-50 ${FOCUS}`}
                            >
                                {t('requestCapacity.clearGroups')}
                            </button>
                        ) : null}
                    </div>
                    <div id={`${id}-groups`} hidden={!groupsOpen} className="mt-1 grid-cols-1 rounded-lg bg-[#EDEFF4] px-3 py-2">
                        {groups.map((group) => {
                            const value = row.groups.find((rule) => rule.groupId === group.groupId)?.max ?? '';

                            return (
                                <div key={group.groupId} className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 py-1.5">
                                    <label
                                        htmlFor={`${id}-${group.groupId}`}
                                        className="min-w-0 flex-1 text-sm font-medium break-words text-[#36394B]"
                                    >
                                        {group.name}
                                    </label>
                                    <CapacityNumber
                                        id={`${id}-${group.groupId}`}
                                        name={`${typeLabel} ${group.name} ${t('requestCapacity.groupLimit')}`}
                                        value={value}
                                        optional
                                        disabled={disabled}
                                        invalid={showErrors && value !== '' && !valid(value)}
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
                </>
            ) : null}
        </article>
    );
}
