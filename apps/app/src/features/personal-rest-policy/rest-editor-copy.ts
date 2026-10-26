import {useTranslation} from 'react-i18next';

const copy = {
    ko: {
        tab: '휴무 설정 충돌',
        reason: '이 설정이 충돌한 이유',
        action: '휴무 설정 수정',
        conditions: '근무 조건',
        nurse: '간호사',
        off: 'OFF',
        day: '일',
        month: (year: number, month: number) => `${year}년 ${month}월`,
        intro: '이전 실행에서 함께 맞추지 못한 설정이에요. 현재 값을 확인해 주세요.',
        hint: '빈칸은 기존 설정을 따르고, 0일은 배정하지 않아요.',
        next: '목표는 다음 자동채우기에 적용해요. 현재 근무표는 그대로예요. 야간전담의 OFF 목표는 최소 일수예요.',
        total: (days: number) => `OFF·연차 목표 합계 ${days}일`,
        inherit: '기존 설정 사용',
        save: '설정 저장',
        back: '취소',
        refresh: '조건 다시 확인',
        refreshFailed: '목표는 저장했지만 조건을 다시 불러오지 못했어요. 조건 다시 확인을 눌러 주세요.',
        saved: '휴무 목표를 저장했어요. 다음 자동채우기에서 다른 조건과 함께 확인할게요.',
    },
    en: {
        tab: 'Days off conflict',
        reason: 'Why these settings conflicted',
        action: 'Edit days off settings',
        conditions: 'Work constraints',
        nurse: 'Nurse',
        off: 'OFF',
        day: 'days',
        month: (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`,
        intro: 'These settings conflicted in the previous attempt. Review the current values.',
        hint: 'Leave blank to use existing settings. Zero means no assignments.',
        next: 'Targets apply to the next autofill. The current schedule stays as it is. OFF targets are a minimum for night-only staff.',
        total: (days: number) => `OFF and annual leave targets: ${days} days in total.`,
        inherit: 'Use existing settings',
        save: 'Save settings',
        back: 'Cancel',
        refresh: 'Refresh conditions',
        refreshFailed: 'Targets were saved, but conditions could not be refreshed. Select Refresh conditions.',
        saved: 'Days off targets saved. The next autofill will check them with the other conditions.',
    },
    ja: {
        tab: '休みの設定の矛盾',
        reason: '設定が矛盾した理由',
        action: '休みの設定を修正',
        conditions: '勤務条件',
        nurse: '看護師',
        off: '公休（OFF）',
        day: '日',
        month: (year: number, month: number) => `${year}年${month}月`,
        intro: '前回の実行で同時に満たせなかった設定です。現在の値を確認してください。',
        hint: '空欄は既存の設定を使います。0日は割り当てません。',
        next: '次の自動作成に適用します。現在の勤務表は変わりません。夜勤専従の公休目標は最低日数です。',
        total: (days: number) => `公休・年休の目標合計${days}日`,
        inherit: '既存の設定を使う',
        save: '設定を保存',
        back: 'キャンセル',
        refresh: '条件を再確認',
        refreshFailed: '目標は保存しましたが、条件を取得できませんでした。条件を再確認してください。',
        saved: '休みの目標を保存しました。次の自動作成で他の条件と一緒に確認します。',
    },
};

export function useRestEditorCopy() {
    const {i18n} = useTranslation();
    const language = i18n.resolvedLanguage ?? i18n.language;

    return language.startsWith('ko') ? copy.ko : language.startsWith('ja') ? copy.ja : copy.en;
}
