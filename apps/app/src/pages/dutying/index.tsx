import {Bell, ChevronRight, ExternalLink, FileText, MessageCircle, ShieldCheck, type LucideIcon} from 'lucide-react';
import {Link} from 'react-router-dom';
import {RUNTIME_CONFIG} from '@/shared/config/runtime';
import ROUTE from '@/shared/constant/path';
import {type TI18nKey, useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Card from '@/shared/ui/Card';

const INQUIRY_LINK = 'https://ye620.channel.io';
const TERMS_OF_SERVICE_LINK = RUNTIME_CONFIG.docs.termsOfService;
const PRIVACY_POLICY_LINK = RUNTIME_CONFIG.docs.privacyPolicy;

type TDutyingLinkItem = {
    titleKey: TI18nKey;
    descriptionKey: TI18nKey;
    href?: string;
    to?: string;
    Icon: LucideIcon;
};

function DutyingLinkItem({item}: {item: TDutyingLinkItem}) {
    const {t} = useTypedTranslation();
    const Icon = item.Icon;
    const content = (
        <>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-gray-7 text-gray-3">
                <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-apple text-[15px] font-semibold text-sub-1">{t(item.titleKey)}</span>
                <span className="mt-0.5 block font-apple text-[13px] leading-5 text-gray-3">{t(item.descriptionKey)}</span>
            </span>
            {item.href ? (
                <ExternalLink className="size-4 shrink-0 text-gray-4" aria-hidden="true" />
            ) : item.to ? (
                <ChevronRight className="size-4 shrink-0 text-gray-4" aria-hidden="true" />
            ) : (
                <span className="shrink-0 rounded-full bg-gray-7 px-2.5 py-1 font-apple text-[11px] font-semibold text-gray-3">
                    {t('page.dutying.comingSoon')}
                </span>
            )}
        </>
    );
    const className =
        'flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none';

    if (item.to) {
        return (
            <Link to={item.to} className={`${className} hover:bg-gray-7`}>
                {content}
            </Link>
        );
    }

    if (!item.href) {
        return (
            <div aria-disabled="true" className={`${className} cursor-default`}>
                {content}
            </div>
        );
    }

    return (
        <a href={item.href} target="_blank" rel="noreferrer" className={`${className} hover:bg-gray-7`}>
            {content}
        </a>
    );
}

function DutyingPage() {
    const {t} = useTypedTranslation();
    const linkItems: TDutyingLinkItem[] = [
        {
            titleKey: 'page.dutying.items.notice.title',
            descriptionKey: 'page.dutying.items.notice.description',
            to: ROUTE.DUTYING_NOTICES,
            Icon: Bell,
        },
        {
            titleKey: 'page.dutying.items.contact.title',
            descriptionKey: 'page.dutying.items.contact.description',
            href: INQUIRY_LINK,
            Icon: MessageCircle,
        },
        {
            titleKey: 'page.dutying.items.terms.title',
            descriptionKey: 'page.dutying.items.terms.description',
            href: TERMS_OF_SERVICE_LINK,
            Icon: FileText,
        },
        {
            titleKey: 'page.dutying.items.privacy.title',
            descriptionKey: 'page.dutying.items.privacy.description',
            href: PRIVACY_POLICY_LINK,
            Icon: ShieldCheck,
        },
    ];

    return (
        <div className="mx-auto w-full max-w-[640px] px-4 py-8 md:px-0">
            <div className="mx-auto max-w-[520px]">
                <h1 className="font-apple text-[32px] font-semibold tracking-normal text-sub-1">{t('page.dutying.title')}</h1>
                <p className="mt-2 font-apple text-[15px] leading-6 text-gray-3">{t('page.dutying.description')}</p>
            </div>

            <Card className="mx-auto mt-6 max-w-[520px] rounded-[24px] border-transparent p-3">
                <div className="flex flex-col">
                    {linkItems.map((item) => (
                        <DutyingLinkItem key={item.titleKey} item={item} />
                    ))}
                </div>
            </Card>
        </div>
    );
}

export default DutyingPage;
