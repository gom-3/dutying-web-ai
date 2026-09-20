import Holidays from 'date-holidays';

export const HOLIDAY_COUNTRIES = [
    'KR',
    'JP',
    'US',
    'CN',
    'TH',
    'VN',
    'GB',
    'IE',
    'MT',
    'DE',
    'FR',
    'ES',
    'IT',
    'NL',
    'BE',
    'AT',
    'CH',
    'PT',
    'SE',
    'NO',
    'DK',
    'FI',
    'PL',
    'CZ',
    'GR',
    'IS',
    'LU',
    'LI',
    'EE',
    'LV',
    'LT',
    'HU',
    'SK',
    'SI',
    'HR',
    'RO',
    'BG',
    'CY',
    'AU',
    'CA',
    'NZ',
] as const;
export type THolidayCountry = (typeof HOLIDAY_COUNTRIES)[number];

const catalog = new Holidays();
const regions = new Map<THolidayCountry, Record<string, string>>();

export function getHolidayRegions(country: THolidayCountry): Record<string, string> {
    let result = regions.get(country);

    if (!result) {
        result = catalog.getStates(country) || {};

        if (country === 'GB')
            result = Object.fromEntries(Object.entries(result).filter(([code]) => ['ENG', 'WLS', 'SCT', 'NIR'].includes(code)));

        regions.set(country, result);
    }

    return result;
}

export function getHolidayCountryName(country: THolidayCountry, language: string) {
    return new Intl.DisplayNames([language], {type: 'region'}).of(country) ?? country;
}
