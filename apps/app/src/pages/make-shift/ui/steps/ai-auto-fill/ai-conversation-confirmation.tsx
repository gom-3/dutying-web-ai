import type {TScheduleMonthRequestItem} from '@dutying/api/ward';
import {useState} from 'react';

type TProps = {
    items: TScheduleMonthRequestItem[];
    nurses: {nurseId: number; name: string}[];
    disabled: boolean;
    onConfirm: (items: TScheduleMonthRequestItem[]) => Promise<void>;
    copy: (ko: string, en: string) => string;
};

/** Every card edit is saved as a new server interpretation before it becomes executable. */
export function ConversationConfirmation({items, nurses, disabled, onConfirm, copy}: TProps) {
    const [edited, setEdited] = useState(items);
    const [reviewed, setReviewed] = useState<number[]>([]);
    const update = (index: number, patch: Partial<TScheduleMonthRequestItem>) => {
        setEdited((current) => current.map((item, position) => (position === index ? {...item, ...patch} : item)));
        setReviewed((current) => current.filter((position) => position !== index));
    };
    const valid = edited.every(
        (item) =>
            item.kind !== 'CELL' &&
            item.kind !== 'CELL_SET' &&
            (item.kind !== 'GOAL' ||
                (Number.isInteger(item.maxOffDifference) &&
                    (item.maxOffDifference ?? -1) >= 0 &&
                    (item.maxOffDifference ?? 32) <= 31 &&
                    Boolean(item.targetNurseIds?.length) &&
                    (item.comparisonNurseIds?.length ?? 0) >= 2)),
    );

    return (
        <details className="mt-2 text-sm" open>
            <summary>{copy('조건 수정하기', 'Edit conditions')}</summary>
            {edited.map((item, index) => (
                <fieldset key={index} className="my-2 space-y-2 rounded-lg bg-white p-3" disabled={disabled}>
                    <legend>{item.displayLabel}</legend>
                    {item.kind === 'GOAL' && (
                        <>
                            <label className="block">
                                {copy('오프 개수 차이', 'Allowed off-day difference')}
                                <input
                                    className="ml-2 w-16 rounded bg-gray-7 p-2 focus:bg-main-light focus:text-main-1 focus:outline-none"
                                    type="number"
                                    min={0}
                                    max={31}
                                    value={item.maxOffDifference ?? ''}
                                    onChange={(event) =>
                                        update(index, {
                                            maxOffDifference: event.target.value === '' ? undefined : Number(event.target.value),
                                        })
                                    }
                                />
                            </label>
                            {(['targetNurseIds', 'comparisonNurseIds'] as const).map((field) => (
                                <div key={field}>
                                    <p>
                                        {copy(
                                            field === 'targetNurseIds' ? '근무를 바꿀 사람' : '오프 개수를 비교할 사람',
                                            field === 'targetNurseIds' ? 'Target nurses' : 'Off-day comparison group',
                                        )}
                                    </p>
                                    {nurses.map((nurse) => (
                                        <label className="mr-2 inline-flex gap-1" key={nurse.nurseId}>
                                            <input
                                                type="checkbox"
                                                checked={item[field]?.includes(nurse.nurseId) ?? false}
                                                onChange={(event) =>
                                                    update(index, {
                                                        [field]: event.target.checked
                                                            ? [...(item[field] ?? []), nurse.nurseId]
                                                            : item[field]?.filter((id) => id !== nurse.nurseId),
                                                    })
                                                }
                                            />
                                            {nurse.name}
                                        </label>
                                    ))}
                                </div>
                            ))}
                            <label className="flex gap-1">
                                <input
                                    type="checkbox"
                                    checked={item.required ?? false}
                                    onChange={(event) => update(index, {required: event.target.checked})}
                                />
                                {copy('꼭 지켜주세요', 'Require the goal to be satisfied')}
                            </label>
                        </>
                    )}
                    {item.kind === 'RULE' &&
                        Object.entries(item.params ?? {})
                            .filter(([, value]) => typeof value === 'number')
                            .map(([key, value]) => (
                                <label className="block" key={key}>
                                    {copy('조건 수치', 'Condition value')}
                                    <input
                                        className="ml-2 w-16 rounded bg-gray-7 p-2 focus:bg-main-light focus:text-main-1 focus:outline-none"
                                        type="number"
                                        value={String(value)}
                                        onChange={(event) => update(index, {params: {...item.params, [key]: Number(event.target.value)}})}
                                    />
                                </label>
                            ))}
                    {item.kind === 'RULE' && (
                        <label className="block">
                            {copy('적용 강도', 'Strength')}
                            <select
                                className="ml-2 rounded bg-gray-7 p-2 focus:bg-main-light focus:text-main-1 focus:outline-none"
                                value={item.severity ?? 'SOFT'}
                                onChange={(event) => update(index, {severity: event.target.value as 'SOFT' | 'HARD'})}
                            >
                                <option value="SOFT">{copy('가능하면', 'If possible')}</option>
                                <option value="HARD">{copy('반드시', 'Required')}</option>
                            </select>
                        </label>
                    )}
                    <label className="flex gap-1">
                        <input
                            type="checkbox"
                            checked={reviewed.includes(index)}
                            onChange={(event) =>
                                setReviewed((current) =>
                                    event.target.checked ? [...current, index] : current.filter((position) => position !== index),
                                )
                            }
                        />
                        {copy('이 내용으로 할게요', 'I confirmed the values and group · this execution only')}
                    </label>
                </fieldset>
            ))}
            <button
                className="min-h-11 rounded-lg bg-main-light px-3 py-2 text-main-1 focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40"
                disabled={disabled || !valid || reviewed.length !== edited.length}
                onClick={() =>
                    void onConfirm(
                        edited.map((item) => ({
                            ...item,
                            requiresConfirmation: false,
                            confirmationReasons: [],
                            assumedSlots: [],
                            lifetime: 'MONTH',
                            lifetimeHint: 'MONTH',
                            applyMonths: undefined,
                        })),
                    )
                }
            >
                {copy('이 내용으로 정하기', 'Confirm these details')}
            </button>
        </details>
    );
}
