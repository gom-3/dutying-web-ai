export type TAiAutofillStatus = 'idle' | 'loading' | 'success' | 'error';

export function canConfirmAiAutofill(status: TAiAutofillStatus): boolean {
    return status !== 'loading';
}

export function getAiAutofillStatusTone(status: TAiAutofillStatus): 'neutral' | 'progress' | 'success' | 'danger' {
    switch (status) {
        case 'loading':
            return 'progress';
        case 'success':
            return 'success';
        case 'error':
            return 'danger';
        default:
            return 'neutral';
    }
}

export function getAiAutofillActionLabel(status: TAiAutofillStatus): 'action' | 'retry' | 'generating' {
    switch (status) {
        case 'loading':
            return 'generating';
        case 'error':
            return 'retry';
        default:
            return 'action';
    }
}

export function getAiAutofillStatusDescription(status: TAiAutofillStatus, hasDraftChanges: boolean): string[] {
    const draftMessage = hasDraftChanges ? '현재 편집본은 유지되고 자동 저장돼요.' : '아직 저장된 편집본 없이 기본 근무표를 보고 있어요.';

    switch (status) {
        case 'loading':
            return ['응답을 기다리는 동안에는 확정과 재요청을 잠시 막아둘게요.', draftMessage];
        case 'success':
            return ['AI가 새 근무표를 반영했어요. 검토 후 직접 수정하거나 바로 확정할 수 있어요.', draftMessage];
        case 'error':
            return ['AI 요청이 실패했어요. 현재 화면의 근무표는 그대로 유지되며 바로 다시 시도할 수 있어요.', draftMessage];
        default:
            return ['이전 단계에서 정리한 조건으로 AI 자동 채우기를 시작할 수 있어요.', draftMessage];
    }
}
