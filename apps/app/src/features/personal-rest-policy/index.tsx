import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {TWardShiftType} from '@/entities';
import type {TShift} from '@/entities/shift';
import {useShiftEditorStore} from '@/features/shift-editor/model/store';
import {adminAxiosInstance} from '@/shared/api/client';

const copy = {
    ko: {
        title: '개인별 월 OFF·연차 목표',
        month: '적용 월',
        off: '일반 OFF 목표',
        annual: '연차 배정 일수',
        noAnnualTypes: '연차 유형이 등록되어 있지 않아 연차 일수를 입력할 수 없어요. 근무 설정에서 연차 유형을 등록해 주세요.',
        inherit: '기존 설정 유지',
        save: '이번 달 목표 저장',
        reset: '입력 취소',
        loading: '불러오는 중…',
        saving: '저장 중…',
        hint: 'OFF와 연차는 따로 셉니다. OFF 9일 + 연차 2일이면 총 11일을 쉽니다. 야간전담의 OFF 목표는 최소 일수입니다.',
        preserve:
            '목표 저장은 기존 근무표·고정 근무·승인된 신청·연차 잔액을 바꾸지 않습니다. 다음 자동완성·조절에서 다른 조건과 함께 검증합니다.',
        override: '개인 목표를 지정하면 이번 달에는 해당 휴무를 배정할 수 있습니다. 연차를 지정할 때는 OFF 목표도 입력해 주세요.',
        saved: '저장했어요. 다음 자동완성·조절에 적용됩니다. 생성 가능 여부는 아직 검증하지 않았어요.',
        failure: '저장하지 못했어요. 입력값을 확인한 뒤 다시 시도해 주세요.',
        stale: '다른 곳에서 설정이 바뀌었어요. 새로 불러온 값을 확인해 주세요.',
        invalid: '0부터 이번 달 일수까지 정수로 입력하고, OFF·연차 합계가 월 일수를 넘지 않게 해 주세요.',
        annualOff: '연차를 지정할 때는 별도의 OFF 목표도 입력해 주세요.',
        loadFailed: '휴무 설정을 불러오지 못했어요.',
        retry: '다시 불러오기',
        legacyTitle: '기존 휴무 배정 설정',
        legacyHint:
            '기존 선택을 그대로 보존했어요. 꺼진 휴무는 신규 자동 배정이 제한돼요. 이미 고정되거나 승인된 휴무는 유지됩니다. 변경은 간호사 정보 저장으로 반영됩니다.',
        allowed: '허용',
        blocked: '제한됨',
    },
    ja: {
        title: '個人別・月の公休と年休目標',
        month: '対象月',
        off: '通常の公休（OFF）日数',
        annual: '年休の割当日数',
        noAnnualTypes: '年休の種類が登録されていないため、日数を入力できません。勤務設定で年休の種類を登録してください。',
        inherit: '既存の設定を維持',
        save: '今月の目標を保存',
        reset: '入力を取り消す',
        loading: '読み込み中…',
        saving: '保存中…',
        hint: '公休と年休は別に数えます。公休9日＋年休2日なら休みは計11日です。夜勤専従の公休目標は最低日数です。',
        preserve:
            '保存しても既存の勤務表、固定勤務、承認済み申請、年休残高は変わりません。次の自動作成・調整で他の条件と一緒に検証します。',
        override: '個人目標を指定すると、今月は対象の休みを割り当てられます。年休を指定する場合は公休目標も入力してください。',
        saved: '保存しました。次の自動作成・調整に適用します。作成できるかはまだ検証していません。',
        failure: '保存できませんでした。入力内容を確認して再度お試しください。',
        stale: '別の場所で設定が変更されました。再取得した内容を確認してください。',
        invalid: '0から今月の日数までの整数を入力し、公休と年休の合計が今月の日数を超えないようにしてください。',
        annualOff: '年休を指定する場合は、公休目標も入力してください。',
        loadFailed: '休みの設定を読み込めませんでした。',
        retry: '再読み込み',
        legacyTitle: '既存の休みの割当設定',
        legacyHint:
            '以前の選択を維持しています。オフの種類は新規の自動割当が制限されます。固定・承認済みの休みは維持します。変更は看護師情報の保存で反映します。',
        allowed: '許可',
        blocked: '制限あり',
    },
    en: {
        title: 'Personal monthly OFF and annual leave',
        month: 'Month',
        off: 'Regular OFF target',
        annual: 'Annual leave days',
        noAnnualTypes:
            'Annual leave days are unavailable because no annual-leave type is registered. Add an annual-leave type in Shift settings.',
        inherit: 'Keep existing settings',
        save: 'Save targets for this month',
        reset: 'Discard edits',
        loading: 'Loading…',
        saving: 'Saving…',
        hint: 'OFF and annual leave are counted separately. 9 OFF + 2 annual leave means 11 days off. For night-only staff, OFF is a minimum.',
        preserve:
            'Saving targets does not change the schedule, fixed assignments, approved requests, or leave balances. The next autofill or adjustment validates all conditions together.',
        override: 'A personal target authorizes that rest type for this month. Enter an OFF target when specifying annual leave.',
        saved: 'Saved for the next autofill or adjustment. Schedule feasibility has not been checked yet.',
        failure: 'Could not save. Check the values and try again.',
        stale: 'Settings changed elsewhere. Review the refreshed values.',
        invalid:
            'Enter whole numbers between 0 and the number of days in this month. OFF plus annual leave cannot exceed the month length.',
        annualOff: 'Enter an OFF target when specifying annual leave.',
        loadFailed: 'Could not load rest settings.',
        retry: 'Reload',
        legacyTitle: 'Existing rest allocation settings',
        legacyHint:
            'Your previous selections are preserved. Disabled rest types restrict new automatic assignments. Fixed and approved rest stays unchanged. Save nurse details to apply changes here.',
        allowed: 'Allowed',
        blocked: 'Restricted',
    },
};

export function usePersonalRestText() {
    const {i18n} = useTranslation();
    const lang = i18n.resolvedLanguage ?? i18n.language;

    return lang.startsWith('ko') ? copy.ko : lang.startsWith('ja') ? copy.ja : copy.en;
}
type TPersonalRestPolicy = {
    nurseId: number;
    year: number;
    month: number;
    offDays: number | null;
    annualDaysByWardShiftTypeId: Record<string, number>;
    version: number | null;
};
export function PersonalRestPolicy({
    nurseId,
    nurseName,
    shiftTypes,
    year,
    month,
    onDirtyChange,
}: {
    nurseId: number;
    nurseName: string;
    shiftTypes: TWardShiftType[];
    year?: number;
    month?: number;
    onDirtyChange?: (dirty: boolean) => void;
}) {
    const text = usePersonalRestText();
    const client = useQueryClient();
    const now = new Date();
    const [period, setPeriod] = useState(`${year ?? now.getFullYear()}-${String(month ?? now.getMonth() + 1).padStart(2, '0')}`);
    const [open, setOpen] = useState(false);
    const [y, m] = period.split('-').map(Number);
    const endpoint = `/nurses/${nurseId}/monthly-rest-policy/${y}/${m}`;
    const query = useQuery({
        queryKey: ['personal-rest-policy', nurseId, y, m],
        enabled: open && !!nurseId && !!y && !!m,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        queryFn: async () => (await adminAxiosInstance.get<TPersonalRestPolicy>(endpoint)).data,
    });
    const [off, setOff] = useState('');
    const [annual, setAnnual] = useState<Record<string, string>>({});
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const errorRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        if (error) errorRef.current?.focus();
    }, [error]);

    const [saved, setSaved] = useState(false);

    useEffect(() => {
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    const annualTypes = shiftTypes.filter((type) => type.isActive !== false && type.classification === 'ANNUAL_LEAVE');
    const reset = () => {
        setOff(query.data?.offDays == null ? '' : String(query.data.offDays));
        setAnnual(
            Object.fromEntries(Object.entries(query.data?.annualDaysByWardShiftTypeId ?? {}).map(([id, days]) => [id, String(days)])),
        );
        setDirty(false);
        setError('');
    };

    useEffect(() => {
        if (!dirty) reset();
    }, [query.data, nurseId, period]);

    const save = async () => {
        const days = new Date(y, m, 0).getDate();
        const values = [off, ...Object.values(annual)].filter((v) => v !== '');

        if (values.some((v) => !/^\d+$/.test(v) || Number(v) > days) || values.reduce((sum, v) => sum + Number(v), 0) > days) {
            setError(text.invalid);

            return;
        }

        const annualValues = Object.fromEntries(
            Object.entries(annual)
                .filter(([, value]) => value !== '')
                .map(([id, value]) => [id, Number(value)]),
        );

        if (Object.keys(annualValues).length && off === '') {
            setError(text.annualOff);

            return;
        }

        setSaving(true);
        setError('');
        setSaved(false);

        try {
            const {data} = await adminAxiosInstance.put<TPersonalRestPolicy>(endpoint, {
                offDays: off === '' ? null : Number(off),
                annualDaysByWardShiftTypeId: annualValues,
                version: query.data?.version ?? null,
            });

            client.setQueryData(['personal-rest-policy', nurseId, y, m], data);
            setDirty(false);
            setSaved(true);
            // Only invalidate validation metadata, never cells or history.
            useShiftEditorStore.getState().setRulesHash(null);
            useShiftEditorStore.getState().setScheduleValidationSnapshot(null);
        } catch (e) {
            const status = (e as {response?: {status?: number}}).response?.status;

            if (status === 409) {
                await query.refetch();
                setError(text.stale);
            } else setError(text.failure);
        } finally {
            setSaving(false);
        }
    };

    return (
        <details onToggle={(event) => setOpen(event.currentTarget.open)} className="my-3 rounded-xl border border-gray-6 p-3">
            <summary className="cursor-pointer py-2 font-semibold">
                {nurseName} · {text.title}
            </summary>
            <ul className="my-3 list-disc space-y-2 pl-5 text-sm">
                <li>{text.hint}</li>
                <li>{text.preserve}</li>
                <li>{text.override}</li>
            </ul>
            <label className="mb-3 flex flex-wrap items-center gap-3">
                {text.month}
                <input
                    type="month"
                    value={period}
                    min="2000-01"
                    max="2100-12"
                    disabled={dirty || saving || !!year}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="min-h-11 rounded border border-gray-5 px-2"
                />
            </label>
            {query.isPending ? (
                <p role="status">{text.loading}</p>
            ) : query.isError ? (
                <div role="alert">
                    <ul className="list-disc pl-5">
                        <li>{text.loadFailed}</li>
                    </ul>
                    <button type="button" className="min-h-11 underline" onClick={() => void query.refetch()}>
                        {text.retry}
                    </button>
                </div>
            ) : (
                <>
                    <label className="my-2 grid gap-2">
                        {text.off}
                        <input
                            type="number"
                            min="0"
                            max={new Date(y, m, 0).getDate()}
                            step="1"
                            value={off}
                            placeholder={text.inherit}
                            disabled={saving || query.isFetching}
                            onChange={(e) => {
                                setOff(e.target.value);
                                setDirty(true);
                                setSaved(false);
                            }}
                            className="min-h-11 rounded border border-gray-5 px-3"
                        />
                    </label>
                    {annualTypes.length === 0 && (
                        <ul className="my-3 list-disc pl-5 text-sm">
                            <li>{text.noAnnualTypes}</li>
                        </ul>
                    )}
                    {annualTypes.map((type) => (
                        <label key={type.wardShiftTypeId} className="my-2 grid gap-2">
                            {type.name} · {text.annual}
                            <input
                                type="number"
                                min="0"
                                max={new Date(y, m, 0).getDate()}
                                step="1"
                                value={annual[type.wardShiftTypeId] ?? ''}
                                placeholder={text.inherit}
                                disabled={saving || query.isFetching}
                                onChange={(e) => {
                                    setAnnual({...annual, [type.wardShiftTypeId]: e.target.value});
                                    setDirty(true);
                                    setSaved(false);
                                }}
                                className="min-h-11 rounded border border-gray-5 px-3"
                            />
                        </label>
                    ))}
                    {error && (
                        <ul ref={errorRef} tabIndex={-1} role="alert" className="my-3 list-disc pl-5 text-red">
                            <li>{error}</li>
                        </ul>
                    )}
                    {saved && (
                        <p role="status" className="my-3 text-sm">
                            {text.saved}
                        </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3">
                        <button
                            type="button"
                            disabled={!dirty || saving}
                            onClick={() => void save()}
                            className="min-h-11 rounded-lg bg-main-1 px-4 text-white disabled:opacity-50"
                        >
                            {saving ? text.saving : text.save}
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                                setOff('');
                                setAnnual({});
                                setDirty(true);
                                setSaved(false);
                            }}
                            className="min-h-11 px-3 underline"
                        >
                            {text.inherit}
                        </button>
                        <button type="button" disabled={!dirty || saving} onClick={reset} className="min-h-11 px-3 underline">
                            {text.reset}
                        </button>
                    </div>
                </>
            )}
        </details>
    );
}

export function PersonalRestTeamPanel({shift, year, month, disabled}: {shift: TShift; year: number; month: number; disabled: boolean}) {
    const text = usePersonalRestText();
    const rows = shift.divisionShiftNurses.flat().map((row) => row.shiftNurse);
    const [selected, setSelected] = useState<number | null>(null);
    const [dirty, setDirty] = useState(false);
    const nurse = rows.find((row) => row.nurseId === selected) ?? rows[0];

    if (!nurse) return null;

    return (
        <details className="my-3 rounded-xl border border-gray-6 p-3">
            <summary className="cursor-pointer py-2 font-semibold">
                {text.title} · {year}-{String(month).padStart(2, '0')}
            </summary>
            <fieldset disabled={disabled} className="mt-2 min-w-0">
                <label className="grid gap-2">
                    {text.title}
                    <select
                        className="min-h-11 rounded border border-gray-5 px-3"
                        value={nurse.nurseId}
                        disabled={dirty}
                        onChange={(e) => setSelected(Number(e.target.value))}
                    >
                        {rows.map((row) => (
                            <option key={row.nurseId} value={row.nurseId}>
                                {row.name}
                            </option>
                        ))}
                    </select>
                </label>
                <PersonalRestPolicy
                    key={`${nurse.nurseId}:${year}:${month}`}
                    nurseId={nurse.nurseId}
                    nurseName={nurse.name}
                    shiftTypes={shift.wardShiftTypes}
                    year={year}
                    month={month}
                    onDirtyChange={setDirty}
                />
            </fieldset>
        </details>
    );
}
