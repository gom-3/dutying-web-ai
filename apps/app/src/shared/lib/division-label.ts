type TTranslate = (key: string, values?: Record<string, string | number>) => string;

// Keep the stored default compatible with existing ward and onboarding data.
export const getDefaultDivisionName = (divisionNum: number) => `그룹${divisionNum}`;

export const getDivisionCustomName = (divisionNum: number, divisionName?: string | null) => {
    const name = divisionName?.trim();

    return name && name !== getDefaultDivisionName(divisionNum) ? name : '';
};

export const getDivisionDisplayLabel = (divisionNum: number, divisionName: string | null | undefined, t: TTranslate) => {
    const name = getDivisionCustomName(divisionNum, divisionName);

    return name || t('shared.division.defaultName', {number: divisionNum});
};
