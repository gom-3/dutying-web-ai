import {getCountryCallingCode} from 'libphonenumber-js/max';
import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {getLocaleForLanguage} from '@/shared/i18n/locale';
import {PHONE_COUNTRIES, type TPhoneCountry} from '@/shared/lib/global-contact-phone';

type TPhoneCountrySelectProps = {
    id: string;
    value?: TPhoneCountry;
    onChange: (country?: TPhoneCountry) => void;
};

export default function PhoneCountrySelect({id, value, onChange}: TPhoneCountrySelectProps) {
    const {t} = useTypedTranslation();
    const {i18n} = useTranslation();
    const locale = getLocaleForLanguage(i18n.resolvedLanguage ?? i18n.language);
    const countries = useMemo(() => {
        const names = new Intl.DisplayNames([locale], {type: 'region'});
        const collator = new Intl.Collator(locale);

        return PHONE_COUNTRIES.map((country) => ({
            country,
            label: `${names.of(country) ?? country} (+${getCountryCallingCode(country)})`,
        })).sort((left, right) => collator.compare(left.label, right.label));
    }, [locale]);

    return (
        <div className="min-w-0">
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-sub-2">
                {t('shared.contactPhone.country')}
            </label>
            <select
                id={id}
                value={value ?? ''}
                onChange={(event) => onChange((event.target.value || undefined) as TPhoneCountry | undefined)}
                className="h-11 w-full min-w-0 rounded-[12px] bg-gray-7 px-3.5 text-base text-sub-1 focus-visible:bg-main-light focus-visible:text-main-1"
                autoComplete="country"
            >
                <option value="">{t('shared.contactPhone.international')}</option>
                {countries.map(({country, label}) => (
                    <option key={country} value={country}>
                        {label}
                    </option>
                ))}
            </select>
        </div>
    );
}
