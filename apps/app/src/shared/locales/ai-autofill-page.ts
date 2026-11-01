export const aiAutofillPageKo = {
    requiredGoalUnmet: '꼭 지켜야 할 조건을 맞추지 못해 결과를 근무표에 반영하지 않았어요.',
    adjustmentUnavailable: '요청한 내용에 맞는 근무표를 만들지 못했어요. 근무표는 변경되지 않았어요.',
    candidateStale: '근무표가 바뀌어 이전 변경안을 반영할 수 없어요. 현재 근무표를 기준으로 다시 요청해 주세요.',
    candidateUnavailable: '근무표가 바뀌었거나 이미 처리한 변경안이라 반영할 수 없어요.',
    undoUnavailable: '다른 편집 내용이 있어 이전 반영을 취소하지 않았어요. 현재 근무표를 확인해 주세요.',
    batchConfirm:
        '계산 결과 {{count}}칸을 작성 중인 근무표에 반영할까요? 직접 수정한 내용은 바뀔 수 있어요. 고정한 근무와 신청 근무는 유지해요. 결과를 검토한 뒤 저장·확정해 주세요. 사용 횟수는 추가로 차감하지 않아요.',
    batchInvalid:
        '현재 팀, 작성 중인 달, 간호사 명단과 계산 결과가 맞는지 확인해 주세요. 저장·확정 전에 현재 근무 조건을 다시 확인해야 해요.',
    batchReady: '여러 팀의 근무표를 만들었어요. 현재 명단과 보호할 근무를 확인한 뒤 불러와 주세요.',
    batchReview: '결과 불러와 확인하기 · 추가 사용 없음',
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
