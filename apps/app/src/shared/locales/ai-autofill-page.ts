export const aiAutofillPageKo = {
    requiredGoalUnmet: '필수 목표를 달성하지 못해 결과를 적용하지 않았어요.',
    adjustmentUnavailable: '요청한 방향으로 조절한 근무표를 제공하지 못했어요. 기존 근무표는 그대로예요.',
    candidateStale: '표가 변경되어 이전 조절 후보를 적용할 수 없어요. 다시 계산해 주세요.',
    candidateUnavailable: '표가 변경되었거나 이미 처리된 후보라 적용할 수 없어요.',
    undoUnavailable: '다른 편집이 있어 목표 조절 결과를 안전하게 되돌릴 수 없어요.',
    batchConfirm:
        '생성 결과 {{count}}칸을 현재 임시 근무표에 적용할까요? 직접 편집한 값은 바뀔 수 있습니다. 고정·신청 근무는 유지하며, 저장·확정은 검토 후 별도로 해주세요. 추가 횟수는 사용하지 않습니다.',
    batchInvalid: '결과의 팀·편성 월·명단 또는 검증 상태를 확인해 주세요. 저장·확정 전에 현재 규칙으로 다시 검증해야 합니다.',
    batchReady: '여러 팀 전체 생성 결과가 준비되어 있습니다. 현재 명단과 보호할 근무를 확인한 뒤 불러옵니다.',
    batchReview: '결과 불러와 검토하기 · 추가 차감 없음',
};

export const aiAutofillPageEn: typeof aiAutofillPageKo = {
    requiredGoalUnmet: 'The required goal was not met, so the result was not applied.',
    adjustmentUnavailable: 'A schedule with the requested adjustment could not be provided. Your current schedule is unchanged.',
    candidateStale: 'The schedule has changed, so this earlier adjustment cannot be applied. Please calculate it again.',
    candidateUnavailable: 'The schedule has changed or this result has already been processed, so it cannot be applied.',
    undoUnavailable: 'Other edits prevent this adjustment from being safely undone.',
    batchConfirm:
        'Apply {{count}} generated cells to this draft? Unsaved edits may change. Fixed and requested cells stay protected. Review before saving or confirming. No additional use is charged.',
    batchInvalid:
        'Check the result’s team, month, roster and validation status. Validate against current rules before saving or confirming.',
    batchReady: 'Review the batch result against the current roster and protected shifts.',
    batchReview: 'Load result for review · no extra use',
};

export const aiAutofillPageJa: typeof aiAutofillPageKo = {
    requiredGoalUnmet: '必須の目標を達成できなかったため、結果を適用しませんでした。',
    adjustmentUnavailable: 'ご希望の条件に沿った勤務表を作成できませんでした。現在の勤務表は変更されていません。',
    candidateStale: '勤務表が変更されたため、以前の調整案は適用できません。再計算してください。',
    candidateUnavailable: '勤務表が変更されたか、この調整案がすでに処理されているため適用できません。',
    undoUnavailable: 'ほかの編集があるため、調整結果を安全に元に戻せません。',
    batchConfirm:
        '生成した{{count}}マスを現在の下書きに適用しますか？手動で編集した内容が変わる場合があります。固定済みの勤務と希望勤務は維持されます。内容を確認してから、別途保存・確定してください。追加の利用回数は消費しません。',
    batchInvalid: '結果のチーム・作成月・メンバー・検証状態を確認してください。保存・確定する前に、現在のルールで再検証が必要です。',
    batchReady: '複数チームの生成結果が用意できました。現在のメンバーと保護する勤務を確認してから読み込んでください。',
    batchReview: '結果を読み込んで確認する · 追加消費なし',
};
