import {useQuery} from '@tanstack/react-query';
import {ChevronLeft, Pin} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Link, useParams} from 'react-router-dom';
import {NoticeAPI} from '@/shared/api';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {getLocaleForLanguage} from '@/shared/i18n/locale';
import PageState from '@/shared/ui/PageState';

const noticeQueryKeys = {
    all: () => ['notice'],
    details: () => [...noticeQueryKeys.all(), 'detail'],
    detail: (noticeId: number) => [...noticeQueryKeys.details(), noticeId],
};
const parseNoticeId = (value: string | undefined) => {
    const noticeId = Number(value);

    return Number.isInteger(noticeId) && noticeId > 0 ? noticeId : null;
};
const formatNoticeDate = (value: string | undefined, locale: string) => {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat(locale, {year: 'numeric', month: 'long', day: 'numeric'}).format(date);
};

function DutyingNoticeDetailPage() {
    const {noticeId: noticeIdParam} = useParams();
    const {t} = useTypedTranslation();
    const {i18n} = useTranslation();
    const locale = getLocaleForLanguage(i18n.resolvedLanguage ?? i18n.language);
    const noticeId = parseNoticeId(noticeIdParam);
    const noticeQuery = useQuery({
        queryKey: noticeQueryKeys.detail(noticeId ?? 0),
        queryFn: () => NoticeAPI.getNotice(noticeId!),
        enabled: noticeId !== null,
    });
    const notice = noticeQuery.data;
    const createdAt = formatNoticeDate(notice?.createdAt, locale);
    const updatedAt = notice?.updatedAt && notice.updatedAt !== notice.createdAt ? formatNoticeDate(notice.updatedAt, locale) : '';

    return (
        <div className="mx-auto w-full max-w-[760px] px-4 py-8 md:px-0">
            <div className="mx-auto max-w-[640px]">
                <Link
                    to={ROUTE.DUTYING_NOTICES}
                    className="inline-flex h-9 items-center gap-1 rounded-[8px] pr-3 pl-1 text-[14px] font-semibold text-gray-3 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    {t('page.dutying.notice.backToList')}
                </Link>

                {noticeId === null ? (
                    <PageState
                        tone="empty"
                        title={t('page.dutying.notice.invalidTitle')}
                        description={t('page.dutying.notice.invalidDescription')}
                        layout="panel"
                        className="mt-6 rounded-[16px] border border-gray-6 bg-white"
                    />
                ) : noticeQuery.isPending ? (
                    <PageState tone="loading" title={t('page.dutying.notice.loadingTitle')} layout="panel" className="mt-6" />
                ) : noticeQuery.isError || !notice ? (
                    <PageState
                        tone="error"
                        title={t('page.dutying.notice.detailErrorTitle')}
                        description={t('page.dutying.notice.detailErrorDescription')}
                        action={{label: t('page.dutying.notice.retry'), onClick: () => void noticeQuery.refetch()}}
                        layout="panel"
                        className="mt-6 rounded-[16px] border border-gray-6 bg-white"
                    />
                ) : (
                    <article className="mt-6 rounded-[16px] border border-gray-6 bg-white px-6 py-6">
                        <div className="flex flex-wrap items-center gap-2">
                            {notice.isPinned ? (
                                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-main-light px-2.5 text-[12px] font-semibold text-main-1">
                                    <Pin className="size-3.5" strokeWidth={2} aria-hidden="true" />
                                    {t('page.dutying.notice.pinned')}
                                </span>
                            ) : null}
                            {createdAt ? (
                                <span className="text-[13px] font-medium text-gray-4">
                                    {t('page.dutying.notice.publishedAt', {date: createdAt})}
                                </span>
                            ) : null}
                            {updatedAt ? (
                                <span className="text-[13px] font-medium text-gray-4">
                                    {t('page.dutying.notice.updatedAt', {date: updatedAt})}
                                </span>
                            ) : null}
                        </div>
                        <h1 className="mt-4 text-[28px] leading-10 font-semibold break-words text-sub-1">{notice.title}</h1>
                        <div className="mt-6 border-t border-gray-6 pt-6 text-[15px] leading-7 break-words whitespace-pre-wrap text-sub-1">
                            {notice.content}
                        </div>
                    </article>
                )}
            </div>
        </div>
    );
}

export default DutyingNoticeDetailPage;
