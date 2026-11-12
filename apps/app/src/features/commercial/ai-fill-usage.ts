import type {Entitlement, Usage} from './api';

export function aiFillRemainingLabel(usage: Usage | undefined, ko: boolean): string {
    if (!usage) return ko ? '확인 중' : 'Checking';

    if (usage.enforced === false) return ko ? '제한 해제' : 'No plan limit';

    return ko ? `${usage.remaining}회 남음` : `${usage.remaining} remaining`;
}

/** The v2 server is authoritative. Legacy cached payloads never turn 30 + 10 into 40. */
export function aiFillUsage(e: Pick<Entitlement, 'usage' | 'restrictionStates'> | undefined): Usage | undefined {
    const usage = e?.usage ?? [];
    const unified = usage.find((usage) => usage.meter === 'AI_FILL');

    if (unified) return unified;

    const full = usage.find((usage) => usage.meter === 'FULL_GENERATE');
    const partial = usage.find((usage) => usage.meter === 'PARTIAL_ADJUST');

    if (!full) return undefined;

    const bonus = (source: string) => source === 'PURCHASE' || source === 'COMPENSATION';
    const extra = partial?.lots?.filter((lot) => bonus(lot.source)) ?? [];
    const fullBonus = full.lots?.filter((lot) => bonus(lot.source)) ?? [];
    const baseDebt = Math.max(
        0,
        (partial?.used ?? 0) + (partial?.reserved ?? 0) - extra.reduce((sum, lot) => sum + lot.consumed + lot.reserved, 0),
    );
    const fullBonusRemaining = fullBonus.reduce((sum, lot) => sum + lot.available, 0);

    let baseRemaining = Math.max(0, full.remaining - fullBonusRemaining - baseDebt);

    const lots = [...(full.lots ?? []), ...extra].map((lot) => {
        const available = bonus(lot.source) ? lot.available : Math.min(lot.available, baseRemaining);

        if (!bonus(lot.source)) baseRemaining -= available;

        return {...lot, meter: 'AI_FILL', available};
    });

    return {
        meter: 'AI_FILL',
        enforced: e?.restrictionStates?.AI_FILL ?? e?.restrictionStates?.AI_FULL ?? full.enforced,
        granted: (full.granted ?? full.used + full.reserved + full.remaining) + extra.reduce((sum, lot) => sum + lot.granted, 0),
        used: full.used + (partial?.used ?? 0),
        reserved: full.reserved + (partial?.reserved ?? 0),
        remaining:
            Math.max(0, full.remaining - fullBonusRemaining - baseDebt) +
            fullBonusRemaining +
            extra.reduce((sum, lot) => sum + lot.available, 0),
        lots,
    };
}
