export type TWardDisplaySource = {
    hospitalName?: string | null;
    name?: string | null;
    code?: string | null;
};

export const getNonEmptyWardText = (value?: string | null) => {
    const trimmedValue = value?.trim();

    if (!trimmedValue) return undefined;

    return trimmedValue;
};

export const getWardDisplayIdentity = (ward?: TWardDisplaySource | null) => {
    const hospitalName = getNonEmptyWardText(ward?.hospitalName);
    const wardName = getNonEmptyWardText(ward?.name);

    return {
        supportingName: hospitalName && wardName ? hospitalName : undefined,
        primaryName: wardName ?? hospitalName ?? '병동 정보',
    };
};

export const getWardDisplayTitle = (ward?: TWardDisplaySource | null) => {
    const {supportingName, primaryName} = getWardDisplayIdentity(ward);

    return supportingName ? `${supportingName} ${primaryName}` : primaryName;
};

export const getWardDisplayCode = (ward?: TWardDisplaySource | null, fallback = '병동코드') => {
    return getNonEmptyWardText(ward?.code) ?? fallback;
};
