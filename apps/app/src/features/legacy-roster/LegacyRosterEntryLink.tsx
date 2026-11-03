import {useTranslation} from 'react-i18next';
import ROUTE from '@/shared/constant/path';
import {legacyRosterCopy} from './copy';

export function LegacyRosterEntryLink() {
    const {i18n} = useTranslation();
    const c = legacyRosterCopy(i18n.resolvedLanguage ?? i18n.language ?? 'ko');

    return (
        <a className="mx-auto mt-6 flex min-h-11 max-w-[334px] items-center justify-center text-sm underline" href={ROUTE.LEGACY_ROSTER}>
            {c.entry}
        </a>
    );
}
