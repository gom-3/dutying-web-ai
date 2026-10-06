import type {TSemanticPlan} from '../../src/pages/make-shift/model/schedule-conversation-api';

/** Deliberately limited local fixture grammar, never a substitute for the AI service. */
export function reviewConditions(text: string, names: string[], year: number, month: number): TSemanticPlan['conditions'] | null {
    const escapedNames = [...names].sort((a, b) => b.length - a.length).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const targets = [...text.matchAll(new RegExp(escapedNames.join('|'), 'g'))];
    if (!targets.length || text.slice(0, targets[0].index).trim()) return null;
    const conditions: TSemanticPlan['conditions'] = [];
    for (const [index, target] of targets.entries()) {
        const quote = text.slice(target.index, targets[index + 1]?.index ?? text.length).trim();
        const clause = quote
            .slice(target[0].length)
            .replace(/[,，.。\s]+$/, '')
            .replace(/\s*그리고$/, '')
            .trim();
        const match = clause.match(
            /^(?:는|은|의|에게)?\s*(?:(\d+)월\s*)?(?:(\d+)\s*(?:~|부터)\s*(\d+)일|(?:(\d+)일까지)|(\d+)일)(?:에|에는)?\s*([DENO])\s*(?:근무)?\s*(?:를|을|는|은|로)?\s*(.+)$/,
        );
        if (!match || (match[1] && Number(match[1]) !== month)) return null;
        const start = match[4] ? 1 : Number(match[2] ?? match[5]);
        const end = Number(match[3] ?? match[4] ?? match[5]);
        const lastDay = new Date(year, month, 0).getDate();
        if (start < 1 || end < start || end > lastDay) return null;
        const instruction = match[7].replace(/\s+/g, '');
        const forbid =
            /^(?:없게(?:해줘|해주세요)?|없이(?:배정(?:해줘|해주세요|하고)?)?|배정하지않(?:게해줘|도록해줘|아요)|제외(?:해줘|해주세요)?)$/.test(
                instruction,
            );
        const assign = /^(?:배정(?:해줘|해주세요|하고)?|넣어(?:줘|주세요))$/.test(instruction);
        if (!forbid && !assign) return null;
        conditions.push({
            intentId: `local-intent-${index + 1}`,
            action: forbid ? 'FORBID' : 'ASSIGN',
            nurseIds: [names.indexOf(target[0]) + 1],
            dates: Array.from(
                {length: end - start + 1},
                (_, offset) => `${year}-${String(month).padStart(2, '0')}-${String(start + offset).padStart(2, '0')}`,
            ),
            shiftCodes: [match[6]],
            quantifier: 'EACH',
            modality: 'HARD',
            operator: null,
            count: null,
            sourceSpan: {quote},
        });
    }
    return conditions;
}
