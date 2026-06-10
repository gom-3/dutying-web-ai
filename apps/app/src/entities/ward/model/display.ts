import i18n from '@/i18n';

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
        primaryName: wardName ?? hospitalName ?? i18n.t('entity.ward.displayInfo'),
    };
};

export const getWardDisplayTitle = (ward?: TWardDisplaySource | null) => {
    const {supportingName, primaryName} = getWardDisplayIdentity(ward);

    return supportingName ? `${supportingName} ${primaryName}` : primaryName;
};

export const getWardDisplayCode = (ward?: TWardDisplaySource | null, fallback = i18n.t('entity.ward.codeFallback')) => {
    return getNonEmptyWardText(ward?.code) ?? fallback;
};
