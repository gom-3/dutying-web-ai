import {describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import {PHONE_COUNTRIES} from '@/shared/lib/global-contact-phone';
import {render, screen} from '@/shared/util/test-utils';
import PhoneCountrySelect from '../PhoneCountrySelect';

describe('localized phone country choices', () => {
    it.each([
        ['ko', '중국 (+86)'],
        ['ja', '中国 (+86)'],
        ['en', 'China (+86)'],
        ['zh', '中国 (+86)'],
        ['zh-TW', '中國 (+86)'],
        ['th', 'จีน (+86)'],
        ['vi', 'Trung Quốc (+86)'],
    ] as const)('provides every supported country using %s names', async (language, chineseLabel) => {
        await i18n.changeLanguage(language);
        render(<PhoneCountrySelect id="phone-country-test" value="CN" onChange={() => {}} />);

        expect(screen.getByRole('combobox')).toHaveValue('CN');
        expect(screen.getByRole('option', {name: chineseLabel})).toBeInTheDocument();
        expect(screen.getAllByRole('option')).toHaveLength(PHONE_COUNTRIES.length + 1);
        expect(screen.getByLabelText(i18n.t('shared.contactPhone.country'))).toBeVisible();
    });
});
