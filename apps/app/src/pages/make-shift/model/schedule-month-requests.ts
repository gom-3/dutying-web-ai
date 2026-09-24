import type {
    TAutofillAdjustKnob,
    TScheduleMonthRequestItem,
    TScheduleMonthRequestLifetime,
    TScheduleMonthRequestRes,
    TScheduleMonthRequestSeverity,
} from '@dutying/api/ward';

export type TAdjustKnobs = Partial<Record<TAutofillAdjustKnob, number>>;

/** 서버 `AdjustKnobCatalog` 와 같은 범위. 합산 뒤 여기로 자른다. */
const KNOB_RANGES: Record<TAutofillAdjustKnob, [number, number]> = {
    OFF_BALANCE: [0, 2],
    CLUSTERING: [-1, 1],
    SENIORITY_MIX: [0, 1],
};

function isKnob(value: unknown): value is TAutofillAdjustKnob {
    return typeof value === 'string' && value in KNOB_RANGES;
}

/**
 * 이 달의 ACTIVE·KNOB 요청을 축으로 합산한다. 서버가 조절에 쓰는 계산과 같다 —
 * 칩이 켜져 보이는 상태와 실제로 걸린 축이 어긋나면 화면이 거짓말을 한다.
 */
export function deriveAdjustKnobs(requests: TScheduleMonthRequestRes[]): TAdjustKnobs {
    const summed: TAdjustKnobs = {};

    for (const request of requests) {
        if (request.status !== 'ACTIVE' || request.kind !== 'KNOB') continue;

        if (!isKnob(request.knob) || typeof request.value !== 'number') continue;

        summed[request.knob] = (summed[request.knob] ?? 0) + request.value;
    }

    const clamped: TAdjustKnobs = {};

    for (const [knob, value] of Object.entries(summed) as [TAutofillAdjustKnob, number][]) {
        const [min, max] = KNOB_RANGES[knob];
        const next = Math.min(max, Math.max(min, value));

        if (next !== 0) clamped[knob] = next;
    }

    return clamped;
}

/** 칩 하나가 만든 ACTIVE 요청. 끌 때 PATCH 할 대상이다. */
export function findActiveKnobRequests(requests: TScheduleMonthRequestRes[], knob: TAutofillAdjustKnob): TScheduleMonthRequestRes[] {
    return requests.filter((request) => request.status === 'ACTIVE' && request.kind === 'KNOB' && request.knob === knob);
}

export function activeRequests(requests: TScheduleMonthRequestRes[]): TScheduleMonthRequestRes[] {
    return requests.filter((request) => request.status === 'ACTIVE');
}

/**
 * 확정 시 병동 제약조건으로 남길 수 있는 요청.
 *
 * 축(KNOB)은 대상이 아니다 — 그쪽은 팀 스타일 프로필로 가는 별도 경로가 있고, 수명 배지로
 * 이미 사용자가 정한다. 여기서 묻는 것은 문장으로 건 **규칙**뿐이다.
 *
 * 이미 승격된 행(promotedRuleId)은 뺀다. 다시 고르면 같은 제약조건이 두 벌이 된다.
 * 템플릿이 없는 행도 뺀다 — 5단계 이전의 RULE 행이라 실행된 적도, 승격할 것도 없다.
 */
export function promotableRuleRequests(requests: TScheduleMonthRequestRes[]): TScheduleMonthRequestRes[] {
    return requests.filter(
        (request) => request.status === 'ACTIVE' && request.kind === 'RULE' && Boolean(request.templateCode) && !request.promotedRuleId,
    );
}

export function toChipRequestItem(knob: TAutofillAdjustKnob, value: number, displayLabel: string): TScheduleMonthRequestItem {
    return {kind: 'KNOB', knob, value, lifetime: 'MONTH', origin: 'CHIP', displayLabel};
}

/** 카드에서 수락한 CELL 항목. 표에 바로 반영할 한 칸이다. */
export type TInterpretCell = {
    nurseId: number;
    date: string;
    shiftCode: string;
};

/**
 * 카드 항목 중 표에 직접 반영할 칸들.
 *
 * "김OO 쌤 15일은 오프 줘" 처럼 사람·날짜·근무가 모두 정해진 문장은 규칙으로 표현할 수 없다.
 * 세 값이 다 있는 것만 고른다 — 하나라도 비면 어느 칸인지 정해지지 않는다.
 */
export function toInterpretCells(cardItems: TInterpretCardItem[]): TInterpretCell[] {
    const singleCells = cardItems
        .filter(({item}) => item.kind === 'CELL')
        .map(({item}) => item)
        .filter(
            (item): item is TScheduleMonthRequestItem & TInterpretCell =>
                typeof item.nurseId === 'number' && typeof item.date === 'string' && typeof item.shiftCode === 'string',
        )
        .map(({nurseId, date, shiftCode}) => ({nurseId, date, shiftCode}));
    const cellSets = cardItems
        .filter(({item}) => item.kind === 'CELL_SET')
        .flatMap(({item}) => {
            if (!Array.isArray(item.nurseIds) || !Array.isArray(item.dates) || typeof item.shiftCode !== 'string') return [];
            return item.nurseIds.flatMap((nurseId) =>
                item.dates!.map((date) => ({nurseId, date, shiftCode: item.shiftCode!})),
            );
        });
    return [...singleCells, ...cellSets].filter(
        (cell, index, all) => all.findIndex((candidate) =>
            candidate.nurseId === cell.nurseId && candidate.date === cell.date,
        ) === index,
    );
}

export type TInterpretCardItem = {
    item: TScheduleMonthRequestItem;
    lifetime: TScheduleMonthRequestLifetime;
    /** RULE 일 때 카드의 "권장 / 꼭" 토글 값. KNOB 에는 의미가 없다. */
    severity: TScheduleMonthRequestSeverity;
};

/**
 * 카드에서 수락한 항목을 autofill 의 `adjust.requests` 로 바꾼다.
 *
 * RULE 도 보낸다(5단계). 이번 달에만 걸리는 제약조건으로 저장되고 엔진 호출 때 저장 규칙
 * 뒤에 이어 붙는다 — 병동 제약조건 목록은 건드리지 않으며, 남기는 것은 확정 시 사용자가 고른다.
 * RULE의 TEAM도 카드에서 사용자가 확인한 값이다. 확정 시 승격 질문을 한 번 더 거친다.
 */
export function toTextRequestItems(cardItems: TInterpretCardItem[], requestText: string): TScheduleMonthRequestItem[] {
    return cardItems
        // CELL 은 규칙이 아니라 표의 한 자리다. 이번 달 요청으로 보내면 서버가 거절하고,
        // 저장된다 해도 재생성 때마다 한 칸짜리 지정이 되살아난다. 표에 직접 반영한다.
        .filter(({item}) => item.kind !== 'CELL' && item.kind !== 'CELL_SET')
        .map(({item, lifetime, severity}) =>
        item.kind === 'RULE'
            ? {
                  kind: 'RULE' as const,
                  templateCode: item.templateCode,
                  params: item.params,
                  ...(item.condition ? {condition: item.condition} : {}),
                  severity,
                  displayLabel: item.displayLabel,
                  lifetime,
                  ...(item.applyMonths?.length ? {applyMonths: item.applyMonths} : {}),
                  origin: 'TEXT' as const,
                  requestText,
                  assumedSlots: item.assumedSlots,
              }
            : item.kind === 'OFF_GOAL'
              ? {
                    kind: 'OFF_GOAL' as const,
                    operation: item.operation,
                    minimumOff: item.minimumOff,
                    targetOff: item.targetOff,
                    source: item.source,
                    displayLabel: item.displayLabel,
                    lifetime: 'MONTH' as const,
                    origin: 'TEXT' as const,
                    requestText,
                    assumedSlots: item.assumedSlots,
                    ...(item.applyMonths?.length ? {applyMonths: item.applyMonths} : {}),
                }
            : {
                  kind: 'KNOB' as const,
                  knob: item.knob,
                  value: item.value,
                  displayLabel: item.displayLabel,
                  lifetime,
                  origin: 'TEXT' as const,
                  requestText,
                  assumedSlots: item.assumedSlots,
                  ...(item.applyMonths?.length ? {applyMonths: item.applyMonths} : {}),
              },
    );
}

type TCarryOverKey = {wardId: number; shiftTeamId: number; year: number; month: number};

function carryOverAnsweredStorageKey({wardId, shiftTeamId, year, month}: TCarryOverKey) {
    return `make-shift:adjust-carry-over-answered:${wardId}:${shiftTeamId}:${year}:${month}`;
}

/** 되묻기 카드는 세션에서 한 번만 묻는다. 적용이든 건너뛰기든 답하면 다시 띄우지 않는다. */
export function isCarryOverAnswered(key: TCarryOverKey): boolean {
    if (typeof window === 'undefined') return false;

    try {
        return window.sessionStorage.getItem(carryOverAnsweredStorageKey(key)) === '1';
    } catch {
        return false;
    }
}

export function markCarryOverAnswered(key: TCarryOverKey) {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(carryOverAnsweredStorageKey(key), '1');
    } catch {
        // 저장이 막힌 브라우저에서는 다음 진입에 한 번 더 묻는다. 그뿐이다.
    }
}
