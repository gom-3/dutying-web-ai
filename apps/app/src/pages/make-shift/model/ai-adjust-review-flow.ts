import type {TScheduleMonthRequestItem} from '@dutying/api/ward';
import type {TAdjustCard} from '../ui/steps/ai-auto-fill/ai-adjust-interpret-card';

export type TReviewQuestionKind = 'proposal' | 'lifetime' | 'severity' | 'offDifference' | 'targetNurses' | 'comparisonNurses';
export type TReviewQuestion = {id: string; kind: TReviewQuestionKind; itemIndex: number};
export type TReviewValue = 'CONFIRM' | 'MONTH' | 'TEAM' | 'SOFT' | 'HARD' | number | number[];
export type TReviewReply = {questionId: string; value: TReviewValue};

export function getReviewQuestions(card: TAdjustCard): TReviewQuestion[] {
    const questions = card.items.flatMap(({item}, itemIndex) => {
        const kinds: TReviewQuestionKind[] = [];
        if (item.kind === 'KNOB' || item.kind === 'RULE') kinds.push('lifetime');
        if (item.kind === 'RULE') kinds.push('severity');
        if (item.kind === 'GOAL') kinds.push('offDifference', 'targetNurses', 'comparisonNurses');
        return kinds.map((kind) => ({id: `${itemIndex}:${kind}`, kind, itemIndex}));
    });

    // Simple cell requests already have a final apply choice. Confirm interpretations
    // with follow-up questions before collecting their scope or priority.
    return questions.length ? [{id: 'proposal', kind: 'proposal', itemIndex: -1}, ...questions] : questions;
}

export function answerReviewQuestion(card: TAdjustCard, question: TReviewQuestion, value: TReviewValue): TAdjustCard | null {
    if (
        !getReviewQuestions(card).some(
            (current) => current.id === question.id && current.kind === question.kind && current.itemIndex === question.itemIndex,
        )
    )
        return null;

    if (question.kind === 'proposal') return value === 'CONFIRM' ? card : null;

    const entry = card.items[question.itemIndex];

    if (!entry) return null;
    let updated = {...entry};
    if (question.kind === 'lifetime') {
        if (value !== 'MONTH' && value !== 'TEAM') return null;
        updated.lifetime = value;
    } else if (question.kind === 'severity') {
        if (value !== 'SOFT' && value !== 'HARD') return null;
        updated.severity = value;
    } else if (question.kind === 'offDifference') {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 31) return null;
        updated.item = {...entry.item, maxOffDifference: value};
    } else {
        if (
            !Array.isArray(value) ||
            value.some((id) => !Number.isInteger(id)) ||
            new Set(value).size !== value.length ||
            value.length < (question.kind === 'comparisonNurses' ? 2 : 1)
        )
            return null;
        const field: keyof TScheduleMonthRequestItem = question.kind === 'targetNurses' ? 'targetNurseIds' : 'comparisonNurseIds';
        updated.item = {...entry.item, [field]: value};
    }
    return {...card, items: card.items.map((item, index) => (index === question.itemIndex ? updated : item))};
}

export function isReviewComplete(card: TAdjustCard, replies: TReviewReply[]): boolean {
    const questions = getReviewQuestions(card);
    return (
        questions.length === replies.length &&
        questions.every((question, index) => {
            const reply = replies[index];
            return reply?.questionId === question.id && answerReviewQuestion(card, question, reply.value) !== null;
        })
    );
}

/** Only explicit answers to the current question are handled locally. Other text is reinterpreted. */
export function parseReviewReply(question: TReviewQuestion | undefined, text: string): TReviewValue | null {
    if (!question) return null;
    const normalized = text
        .trim()
        .replace(/[.!?。！？]+$/, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();

    if (question.kind === 'proposal') {
        return /^(네|예|응|좋아요|이대로좋아요|네이대로좋아요|네반영해주세요|반영해주세요|반영해줘|적용해주세요|yes|yesplease|yeslooksgood|looksgood)$/.test(
            normalized.replace(/[,\s]/g, ''),
        )
            ? 'CONFIRM'
            : null;
    }
    if (question.kind === 'lifetime') {
        if (
            /^(이번 ?달(만|로)?|한 ?달(만)?)( ?(적용|반영)(해 ?줘|해 ?주세요)?)?$/.test(normalized) ||
            /^this month( only)?$/.test(normalized)
        )
            return 'MONTH';
        if (
            /^(매달|계속|앞으로( 계속)?)( ?(적용|반영)(해 ?줘|해 ?주세요)?)?$/.test(normalized) ||
            /^(every month|ongoing)$/.test(normalized)
        )
            return 'TEAM';
    }
    if (question.kind === 'severity') {
        if (/^(꼭|반드시)( (반영|적용)(해 ?줘|해 ?주세요)?)?$/.test(normalized) || normalized === 'must follow') return 'HARD';
        if (/^(가능하면( 반영)?|되도록|가능한 만큼|if possible)$/.test(normalized)) return 'SOFT';
    }
    if (question.kind === 'offDifference' && /^\d{1,2}\s*(일)?\s*(이내|이내로|로)?$/.test(normalized)) {
        const value = Number.parseInt(normalized, 10);
        return value <= 31 ? value : null;
    }
    return null;
}
