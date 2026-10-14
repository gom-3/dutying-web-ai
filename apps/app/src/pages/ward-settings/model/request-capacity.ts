import type {TReqShiftCapacityRule, TReqShiftCapacitySettings, TWardShiftTypeResponse} from '@dutying/api/ward';

export type TCapacityDraftRow = {wardShiftTypeId: number; teamMax: string; groups: {groupId: number; max: string}[]};

export function capacityDraftRows(settings: TReqShiftCapacitySettings, types: TWardShiftTypeResponse[]): TCapacityDraftRow[] {
    const rows: TCapacityDraftRow[] = [];

    for (const rule of settings.rules) {
        let row = rows.find((candidate) => candidate.wardShiftTypeId === rule.wardShiftTypeId);

        if (!row) {
            row = {wardShiftTypeId: rule.wardShiftTypeId, teamMax: '', groups: []};
            rows.push(row);
        }

        if (rule.groupId === null) row.teamMax = String(rule.maxPerDay);
        else row.groups.push({groupId: rule.groupId, max: String(rule.maxPerDay)});
    }

    const offTypes = types.filter((type) => type.classification === 'OFF' && type.isActive !== false);

    if (rows.length === 0 && offTypes.length === 1) rows.push({wardShiftTypeId: offTypes[0].wardShiftTypeId, teamMax: '', groups: []});

    return rows;
}

export function capacityDraftRules(rows: TCapacityDraftRow[]): TReqShiftCapacityRule[] | null {
    const rules: TReqShiftCapacityRule[] = [];
    const keys = new Set<string>();
    const add = (type: number, group: number | null, value: string) => {
        const scope = `${type}:${group}`;

        if (!/^\d+$/.test(value) || Number(value) > 10000 || keys.has(scope)) return false;

        keys.add(scope);
        rules.push({wardShiftTypeId: type, groupId: group, maxPerDay: Number(value)});

        return true;
    };

    if (new Set(rows.map((row) => row.wardShiftTypeId)).size !== rows.length) return null;

    for (const row of rows) {
        if (row.teamMax !== '' && !add(row.wardShiftTypeId, null, row.teamMax)) return null;

        for (const group of row.groups) if (!add(row.wardShiftTypeId, group.groupId, group.max)) return null;
    }

    return rules;
}
