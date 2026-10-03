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
        <details className="mt-2 text-sm">
            <summary>{copy('조건 카드 수정·확인', 'Edit and confirm the card')}</summary>
            {edited.map((item, index) => (
                <fieldset key={index} className="my-2 space-y-2 rounded border border-gray-5 p-2" disabled={disabled}>
                    <legend>{item.displayLabel}</legend>
                    {item.kind === 'GOAL' && (
                        <>
                            <label className="block">
                                {copy('휴무 수 차이 허용치', 'Allowed off-day difference')}
                                <input
                                    className="ml-2 w-16 rounded border p-1"
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
                                            field === 'targetNurseIds' ? '조절 대상' : '휴무 수 비교 대상',
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
                                {copy('목표를 충족한 결과만 허용', 'Require the goal to be satisfied')}
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
                                        className="ml-2 w-16 rounded border p-1"
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
                                className="ml-2 rounded border p-1"
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
                        {copy('대상과 수치를 확인했어요 · 이번 실행에 적용', 'I confirmed the values and group · this execution only')}
                    </label>
                </fieldset>
            ))}
            <button
                className="rounded-lg border border-gray-5 px-3 py-2 disabled:opacity-40"
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
                {copy('확인한 내용으로 새 카드 저장', 'Save a new confirmed card')}
            </button>
        </details>
    );
}
