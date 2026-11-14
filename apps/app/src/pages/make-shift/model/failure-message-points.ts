import i18n from '@/i18n';

/** Preserve server wording while making each sentence or supplied bullet readable. */
export function failureMessagePoints(message: string): string[] {
    return message
        .split(/(?:\r?\n)+|(?<=[.!?])\s+|(?<=[。！？])/u)
        .map((line) => line.replace(/^\s*[-•]\s*/, '').trim())
        .filter(Boolean);
}

/** Only known UI notices are translated; user text and server diagnostics stay intact. */
export function localizeStoredFailureMessage(message: string): string {
    const keys = ['aiAdjust.failed', 'aiAutofillUi.adjustmentFailed', 'page.makeShift.aiRefill.adjust.failed'];

    for (const key of keys) {
        if (['ko', 'en', 'ja'].some((language) => i18n.getFixedT(language)(key) === message)) return i18n.t(key);
    }

    return message;
}
