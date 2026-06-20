import {cn} from '@dutying/utils/style';
import {useInfiniteQuery} from '@tanstack/react-query';
import {Bell, ChevronLeft, ChevronRight, Pin} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {NoticeAPI} from '@/shared/api';
import type {TNoticeListItem, TNoticePlatform} from '@/shared/api/notice';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {getLocaleForLanguage} from '@/shared/i18n/locale';
import PageState from '@/shared/ui/PageState';

const NOTICE_PAGE_SIZE = 20;
const NOTICE_PLATFORM: TNoticePlatform = 'WEB';
const noticeQueryKeys = {
    all: () => ['notice'],
    lists: () => [...noticeQueryKeys.all(), 'list'],
    list: (platform: TNoticePlatform, size: number) => [...noticeQueryKeys.lists(), platform, size],
};
const formatNoticeDate = (value: string | undefined, locale: string) => {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat(locale, {year: 'numeric', month: 'long', day: 'numeric'}).format(date);
};

function NoticeListSkeleton() {
    return (
        <div className="overflow-hidden rounded-[16px] border border-gray-6 bg-white" aria-hidden="true">
            {Array.from({length: 4}, (_, index) => (
                <div key={index} className="border-b border-gray-6 px-5 py-5 last:border-b-0">
                    <div className="h-4 w-20 rounded-full bg-gray-7" />
                    <div className="mt-4 h-5 w-2/3 rounded-full bg-gray-7" />
                    <div className="mt-3 h-4 w-full rounded-full bg-gray-7" />
                    <div className="mt-2 h-4 w-1/2 rounded-full bg-gray-7" />
                </div>
            ))}
        </div>
    );
}

function NoticeListItem({notice, locale}: {notice: TNoticeListItem; locale: string}) {
    const {t} = useTypedTranslation();
    const dateLabel = formatNoticeDate(notice.createdAt ?? notice.updatedAt, locale);

    return (
        <Link
            to={`${ROUTE.DUTYING_NOTICES}/${notice.id}`}
            className="group flex w-full items-start gap-4 px-5 py-5 text-left transition-colors hover:bg-gray-7 focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:outline-none focus-visible:ring-inset"
        >
            <span
                className={cn(
                    'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[12px]',
                    notice.isPinned ? 'bg-main-light text-main-1' : 'bg-gray-7 text-gray-3',
                )}
            >
                {notice.isPinned ? (
                    <Pin className="size-4" strokeWidth={2} aria-hidden="true" />
                ) : (
                    <Bell className="size-4" aria-hidden="true" />
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                    {notice.isPinned ? (
                        <span className="inline-flex h-6 items-center rounded-full bg-main-light px-2.5 text-[12px] font-semibold text-main-1">
                            {t('page.dutying.notice.pinned')}
                        </span>
                    ) : null}
                    {dateLabel ? <span className="text-[12px] font-medium text-gray-4">{dateLabel}</span> : null}
                </span>
                <span className="mt-2 block text-[17px] leading-6 font-semibold break-words text-sub-1">{notice.title}</span>
                {notice.summary ? (
                    <span className="mt-1.5 block text-[14px] leading-6 break-words whitespace-pre-line text-gray-3">{notice.summary}</span>
                ) : null}
            </span>
            <ChevronRight
                className="mt-3 size-4 shrink-0 text-gray-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
            />
        </Link>
    );
}

function DutyingNoticesPage() {
    const {t} = useTypedTranslation();
    const {i18n} = useTranslation();
    const locale = getLocaleForLanguage(i18n.resolvedLanguage ?? i18n.language);
    const noticesQuery = useInfiniteQuery({
        queryKey: noticeQueryKeys.list(NOTICE_PLATFORM, NOTICE_PAGE_SIZE),
        initialPageParam: undefined as number | undefined,
        queryFn: ({pageParam}) =>
            NoticeAPI.getNotices({
                platform: NOTICE_PLATFORM,
                size: NOTICE_PAGE_SIZE,
                cursorId: pageParam,
            }),
        getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.nextCursorId : undefined),
    });
    const notices = noticesQuery.data?.pages.flatMap((page) => page.items) ?? [];
    const isInitialLoading = noticesQuery.isPending;

    return (
        <div className="mx-auto w-full max-w-[760px] px-4 py-8 md:px-0">
            <div className="mx-auto max-w-[640px]">
                <Link
                    to={ROUTE.DUTYING}
                    className="inline-flex h-9 items-center gap-1 rounded-[8px] pr-3 pl-1 text-[14px] font-semibold text-gray-3 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    {t('page.dutying.notice.backToDutying')}
                </Link>
                <h1 className="mt-5 font-apple text-[32px] font-semibold tracking-normal text-sub-1">
                    {t('page.dutying.items.notice.title')}
                </h1>
                <p className="mt-2 font-apple text-[15px] leading-6 text-gray-3">{t('page.dutying.items.notice.description')}</p>
            </div>

            <div className="mx-auto mt-6 max-w-[640px]">
                {isInitialLoading ? (
                    <NoticeListSkeleton />
                ) : noticesQuery.isError ? (
                    <PageState
                        tone="error"
                        title={t('page.dutying.notice.errorTitle')}
                        description={t('page.dutying.notice.errorDescription')}
                        action={{label: t('page.dutying.notice.retry'), onClick: () => void noticesQuery.refetch()}}
                        layout="panel"
                        className="rounded-[16px] border border-gray-6 bg-white"
                    />
                ) : notices.length === 0 ? (
                    <PageState
                        tone="empty"
                        title={t('page.dutying.notice.emptyTitle')}
                        description={t('page.dutying.notice.emptyDescription')}
                        layout="panel"
                        className="rounded-[16px] border border-gray-6 bg-white"
                    />
                ) : (
                    <>
                        <div
                            className="overflow-hidden rounded-[16px] border border-gray-6 bg-white"
                            aria-label={t('page.dutying.notice.listAria')}
                        >
                            {notices.map((notice) => (
                                <div key={notice.id} className="border-b border-gray-6 last:border-b-0">
                                    <NoticeListItem notice={notice} locale={locale} />
                                </div>
                            ))}
                        </div>
                        {noticesQuery.hasNextPage ? (
                            <div className="mt-5 flex justify-center">
                                <button
                                    type="button"
                                    className="inline-flex h-10 items-center justify-center rounded-[8px] border border-gray-6 bg-white px-4 text-[14px] font-semibold text-sub-1 transition-colors hover:bg-gray-7 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={() => void noticesQuery.fetchNextPage()}
                                    disabled={noticesQuery.isFetchingNextPage}
                                >
                                    {t('page.dutying.notice.loadMore')}
                                </button>
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}

export default DutyingNoticesPage;
