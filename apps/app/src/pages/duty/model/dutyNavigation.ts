import ROUTE from '@/shared/constant/path';

export function getNextYearMonth(year: number, month: number) {
    return {
        year: month === 12 ? year + 1 : year,
        month: month === 12 ? 1 : month + 1,
    };
}

type TBuildMakeShiftPathParams = {
    year: number;
    month: number;
    shiftTeamId: number | null;
};

export function buildMakeShiftPath({year, month, shiftTeamId}: TBuildMakeShiftPathParams) {
    const params = new URLSearchParams({
        year: String(year),
        month: String(month),
    });

    if (shiftTeamId !== null) {
        params.set('shiftTeamId', String(shiftTeamId));
    }

    return `${ROUTE.MAKE}?${params.toString()}`;
}
