import {cn} from '@dutying/utils/style';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {Link} from 'react-router';
import useAuthStore from '@/features/auth/model/store';
import {commercialGet, commercialPost, commercialQueryKey} from '@/features/commercial/api';
import {sanitizeInternalPath} from '@/shared/config/runtime';
import {ActionsFeedback, ErrorView, Section, useAction, useCopy} from './workspace-ui';
import './workspace-notices.css';

export type TWorkspaceNotice = {id: string; message: string; targetPath: string; readAt?: string | null; createdAt?: string; kind?: string};
type TNoticeFilter = 'all' | 'unread' | 'read';

function NoticeItem({notice, onRead}: {notice: TWorkspaceNotice; onRead: (id: string) => void}) {
    const t = useCopy();
    const action = useAction();
    const ko = t('ko', 'en') === 'ko';
    const unread = !notice.readAt;
    const created = notice.createdAt
        ? new Date(/[Z+-]\d*:?.*$/.test(notice.createdAt.slice(10)) ? notice.createdAt : `${notice.createdAt}Z`)
        : null;
    const markRead = () => {
        if (!unread || action.busy) return;

        void action.run(async () => {
            await commercialPost(`/notices/${notice.id}/read`);
            onRead(notice.id);
        });
    };

    return (
        <li className={cn('workspace-notices-item', unread && 'workspace-notices-item-unread')}>
            <div className="workspace-notices-content">
                <div className="workspace-notices-meta">
                    <span className="workspace-notices-state">{unread ? t('안 읽음', 'Unread') : t('읽음', 'Read')}</span>
                    {created && Number.isFinite(created.getTime()) ? (
                        <time dateTime={created.toISOString()}>
                            {created.toLocaleString(ko ? 'ko-KR' : 'en-US', {
                                timeZone: 'Asia/Seoul',
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                            })}
                        </time>
                    ) : null}
                </div>
                <p>{notice.message}</p>
            </div>
            <div className="workspace-notices-actions">
                <Link to={sanitizeInternalPath(notice.targetPath, '/workspace')} onClick={markRead}>
                    {t('자세히 보기', 'View details')}
                    <span aria-hidden="true">↗</span>
                </Link>
                {unread ? (
                    <button type="button" className="secondary" disabled={action.busy} onClick={markRead}>
                        {action.busy ? t('처리 중…', 'Saving…') : t('읽음 표시', 'Mark as read')}
                    </button>
                ) : null}
            </div>
            <ActionsFeedback action={action} />
        </li>
    );
}

export function WorkspaceNotices() {
    const t = useCopy();
    const accountId = useAuthStore((state) => state.accountId);
    const client = useQueryClient();
    const [filter, setFilter] = useState<TNoticeFilter>('all');
    const key = commercialQueryKey(accountId, 'notices');
    const query = useQuery({
        queryKey: key,
        queryFn: () => commercialGet<TWorkspaceNotice[]>('/notices'),
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
        retry: false,
    });
    const notices = query.data ?? [];
    const unread = notices.filter((notice) => !notice.readAt).length;
    const filtered = notices.filter((notice) => filter === 'all' || (filter === 'unread' ? !notice.readAt : !!notice.readAt));
    const markRead = (id: string) =>
        client.setQueryData<TWorkspaceNotice[]>(key, (previous) =>
            previous?.map((notice) => (notice.id === id ? {...notice, readAt: new Date().toISOString()} : notice)),
        );

    return (
        <div className="workspace-notices-page">
            <Section
                title={t('받은 알림', 'Your notices')}
                className="workspace-notices-section"
                help={t(
                    '요금·계약·이벤트와 관련된 개인 알림입니다. 내용을 열거나 읽음 표시를 누르면 읽음 상태가 저장됩니다.',
                    'Personal notices about billing, contracts and events. Opening a notice or marking it read saves its read status.',
                )}
                actions={
                    <button
                        className="secondary workspace-notices-refresh"
                        type="button"
                        disabled={query.isFetching}
                        onClick={() => void query.refetch()}
                    >
                        {t('새로고침', 'Refresh')}
                    </button>
                }
            >
                <div className="workspace-notices-toolbar">
                    <div
                        className="workspace-notices-filters"
                        role="group"
                        aria-label={t('알림 읽음 상태 필터', 'Filter notices by read status')}
                    >
                        {(
                            [
                                ['all', t('전체', 'All'), notices.length],
                                ['unread', t('안 읽음', 'Unread'), unread],
                                ['read', t('읽음', 'Read'), notices.length - unread],
                            ] as const
                        ).map(([value, label, count]) => (
                            <button
                                type="button"
                                key={value}
                                aria-pressed={filter === value}
                                aria-label={`${label} ${count}`}
                                onClick={() => setFilter(value)}
                            >
                                {label}
                                <span>{count}</span>
                            </button>
                        ))}
                    </div>
                    <span className="workspace-notices-unread-count" aria-live="polite">
                        {t(`안 읽은 알림 ${unread}개`, `${unread} unread notices`)}
                    </span>
                </div>
                {query.isPending ? (
                    <p className="workspace-notices-empty" role="status">
                        {t('알림을 불러오는 중입니다.', 'Loading notices…')}
                    </p>
                ) : query.error && !query.data ? (
                    <div className="workspace-notices-load-error">
                        <ErrorView error={query.error} />
                        <button type="button" className="secondary" onClick={() => void query.refetch()}>
                            {t('다시 불러오기', 'Try again')}
                        </button>
                    </div>
                ) : (
                    <>
                        {query.error ? (
                            <div className="workspace-notices-load-error">
                                <ErrorView error={query.error} />
                                <p>{t('마지막으로 불러온 알림을 표시하고 있습니다.', 'Showing the most recently loaded notices.')}</p>
                            </div>
                        ) : null}
                        {filtered.length ? (
                            <ul className="workspace-notices-list" aria-busy={query.isFetching}>
                                {filtered.map((notice) => (
                                    <NoticeItem key={notice.id} notice={notice} onRead={markRead} />
                                ))}
                            </ul>
                        ) : (
                            <div className="workspace-notices-empty">
                                <strong>
                                    {filter === 'unread'
                                        ? t('안 읽은 알림이 없습니다', 'No unread notices')
                                        : filter === 'read'
                                          ? t('읽은 알림이 없습니다', 'No read notices')
                                          : t('아직 받은 알림이 없습니다', 'No notices yet')}
                                </strong>
                                {filter !== 'all' && notices.length ? (
                                    <button type="button" className="secondary" onClick={() => setFilter('all')}>
                                        {t('전체 알림 보기', 'View all notices')}
                                    </button>
                                ) : null}
                            </div>
                        )}
                    </>
                )}
            </Section>
        </div>
    );
}
