import axiosInstance from '../client';

export type TWardBoardPost = {
    id?: number;
    postId?: number;
    title: string;
    content: string;
    authorName?: string;
    writerName?: string;
    createdAt?: string;
    modifiedAt?: string;
    isMine?: boolean;
    isNotice?: boolean;
    viewCount?: number;
    likeCount?: number;
    isLikedByMe?: boolean;
    checkCount?: number;
    isCheckedByMe?: boolean;
    checkedUserNames?: string[];
    imageUrls?: string[];
    commentCount?: number;
    deadlineDate?: string;
};

export type TWardBoardComment = {
    id?: number;
    commentId?: number;
    content: string;
    authorName?: string;
    isMine?: boolean;
    createdAt?: string;
    modifiedAt?: string;
    replies?: TWardBoardComment[];
};

export type TWardBoardChecker = {
    accountId?: number;
    name: string;
};

export type TWardBoardDeadline = {
    postId: number;
    postTitle: string;
    deadlineDate: string;
    writerName?: string;
};

export type TWardBoardScheduleId = string | number;
export type TWardBoardScheduleSourceType = 'MANUAL' | 'BOARD_DEADLINE' | 'MEMBER_BIRTHDAY';
export type TWardBoardScheduleEventType = 'BIRTHDAY' | string;
type TBooleanLike = boolean | number | string | null;

export type TWardBoardSchedule = {
    id?: TWardBoardScheduleId | null;
    scheduleId?: TWardBoardScheduleId | null;
    wardCalendarEventId?: TWardBoardScheduleId | null;
    ward_calendar_event_id?: TWardBoardScheduleId | null;
    eventKey?: string;
    event_key?: string;
    title: string;
    content?: string;
    scheduleDate?: string;
    schedule_date?: string;
    startDate?: string;
    start_date?: string;
    endDate?: string;
    end_date?: string;
    allDay?: boolean;
    isAllDay?: boolean;
    all_day?: TBooleanLike;
    is_all_day?: TBooleanLike;
    startTime?: string | null;
    start_time?: string | null;
    endTime?: string | null;
    end_time?: string | null;
    writerName?: string;
    writer_name?: string;
    authorName?: string;
    author_name?: string;
    createdAt?: string;
    modifiedAt?: string;
    isMine?: boolean;
    editableByMe?: boolean;
    editable_by_me?: TBooleanLike;
    deletableByMe?: boolean;
    deletable_by_me?: TBooleanLike;
    sourceType?: TWardBoardScheduleSourceType;
    source_type?: TWardBoardScheduleSourceType;
    eventType?: TWardBoardScheduleEventType;
    event_type?: TWardBoardScheduleEventType;
    sourceAccountId?: number | null;
    source_account_id?: number | null;
    sourceNurseId?: number | null;
    source_nurse_id?: number | null;
    createdOrigin?: string | null;
    created_origin?: string | null;
    sourcePostId?: number | null;
    source_post_id?: number | null;
    calendarId?: TWardBoardScheduleId | null;
    calendar_id?: TWardBoardScheduleId | null;
    calendarName?: string | null;
    calendar_name?: string | null;
};

type TPostListResponse = {
    posts?: TWardBoardPost[];
    items?: TWardBoardPost[];
    data?: TWardBoardPost[];
    nextCursorId?: number;
    hasNext?: boolean;
};

type TCommentListResponse = {
    comments?: TWardBoardComment[];
    items?: TWardBoardComment[];
    data?: TWardBoardComment[];
    nextCursorId?: number;
};

type TScheduleListResponse = {
    schedules?: TWardBoardSchedule[];
    items?: TWardBoardSchedule[];
    data?: TWardBoardSchedule[];
};

export type TCreateWardBoardPostDTO = {
    title: string;
    content: string;
    deadlineDate?: string;
    imageUrls?: string[];
};

export type TCreateWardBoardScheduleDTO = {
    title: string;
    content?: string;
    scheduleDate: string;
    startDate?: string;
    endDate?: string;
    allDay?: boolean;
    isAllDay?: boolean;
    startTime?: string | null;
    endTime?: string | null;
};

export type TUpdateWardBoardScheduleDTO = TCreateWardBoardScheduleDTO;

type TCreateWardBoardCommentDTO = {
    content: string;
};

const readPostId = (post: TWardBoardPost) => post.postId ?? post.id ?? 0;
const readScheduleId = (schedule: TWardBoardSchedule) =>
    schedule.scheduleId ?? schedule.wardCalendarEventId ?? schedule.ward_calendar_event_id ?? schedule.id ?? 0;
const readScheduleEventKey = (schedule: TWardBoardSchedule) => {
    const explicitEventKey = schedule.eventKey ?? schedule.event_key;

    if (explicitEventKey) return explicitEventKey;

    const scheduleId = readScheduleId(schedule);

    if (scheduleId) return `event-${scheduleId}`;

    const startDate = schedule.startDate ?? schedule.start_date ?? schedule.scheduleDate ?? schedule.schedule_date ?? 'unknown-date';

    return `event-${startDate}-${schedule.title}`;
};
const normalizePosts = (response: TPostListResponse) => response.posts ?? response.items ?? response.data ?? [];
const normalizeComments = (response: TCommentListResponse) => response.comments ?? response.items ?? response.data ?? [];
const toBoolean = (value: unknown) => {
    if (typeof value === 'boolean') return value;

    if (typeof value === 'number') return value === 1;

    if (typeof value === 'string') {
        const normalizedValue = value.trim().toLowerCase();

        if (normalizedValue === 'true' || normalizedValue === '1') return true;

        if (normalizedValue === 'false' || normalizedValue === '0') return false;
    }

    return undefined;
};
const assignIfMissing = (target: TWardBoardSchedule, key: keyof TWardBoardSchedule, value: unknown) => {
    if (value === undefined) return;

    if (target[key] !== undefined && target[key] !== null && target[key] !== '') return;

    (target as Record<string, unknown>)[key] = value;
};
const normalizeSchedule = (schedule: TWardBoardSchedule): TWardBoardSchedule => {
    const allDay = toBoolean(schedule.allDay ?? schedule.isAllDay ?? schedule.all_day ?? schedule.is_all_day);
    const editableByMe = toBoolean(schedule.editableByMe ?? schedule.editable_by_me);
    const deletableByMe = toBoolean(schedule.deletableByMe ?? schedule.deletable_by_me);
    const startDate = schedule.startDate ?? schedule.start_date ?? schedule.scheduleDate ?? schedule.schedule_date;
    const normalizedSchedule = {...schedule};

    assignIfMissing(normalizedSchedule, 'scheduleDate', schedule.schedule_date ?? startDate);
    assignIfMissing(normalizedSchedule, 'startDate', schedule.start_date);
    assignIfMissing(normalizedSchedule, 'endDate', schedule.end_date);
    assignIfMissing(normalizedSchedule, 'allDay', allDay);
    assignIfMissing(normalizedSchedule, 'isAllDay', allDay);
    assignIfMissing(normalizedSchedule, 'startTime', schedule.start_time);
    assignIfMissing(normalizedSchedule, 'endTime', schedule.end_time);
    assignIfMissing(normalizedSchedule, 'writerName', schedule.writer_name);
    assignIfMissing(normalizedSchedule, 'authorName', schedule.author_name);
    assignIfMissing(normalizedSchedule, 'editableByMe', editableByMe);
    assignIfMissing(normalizedSchedule, 'deletableByMe', deletableByMe);
    assignIfMissing(normalizedSchedule, 'eventKey', schedule.event_key ?? readScheduleEventKey(schedule));
    assignIfMissing(normalizedSchedule, 'wardCalendarEventId', schedule.ward_calendar_event_id);
    assignIfMissing(normalizedSchedule, 'sourceType', schedule.source_type);
    assignIfMissing(normalizedSchedule, 'eventType', schedule.event_type);
    assignIfMissing(normalizedSchedule, 'sourceAccountId', schedule.source_account_id);
    assignIfMissing(normalizedSchedule, 'sourceNurseId', schedule.source_nurse_id);
    assignIfMissing(normalizedSchedule, 'createdOrigin', schedule.created_origin);
    assignIfMissing(normalizedSchedule, 'sourcePostId', schedule.source_post_id);
    assignIfMissing(normalizedSchedule, 'calendarId', schedule.calendar_id);
    assignIfMissing(normalizedSchedule, 'calendarName', schedule.calendar_name);

    return normalizedSchedule;
};
const normalizeSchedules = (response: TScheduleListResponse | TWardBoardSchedule[]) =>
    (Array.isArray(response) ? response : (response.schedules ?? response.items ?? response.data ?? [])).map(normalizeSchedule);
const withScheduleAllDayAlias = <TSchedule extends TCreateWardBoardScheduleDTO>(schedule: TSchedule) => {
    const allDay = schedule.allDay ?? schedule.isAllDay;

    if (allDay === undefined) return schedule;

    return {
        ...schedule,
        allDay,
        isAllDay: allDay,
    };
};

class ApiBoardAPI {
    public async getPosts(wardId: number, options?: {cursorId?: number; size?: number; keyword?: string}) {
        const params = new URLSearchParams();

        if (options?.cursorId) params.set('cursorId', String(options.cursorId));

        if (options?.size) params.set('size', String(options.size));

        if (options?.keyword?.trim()) params.set('keyword', options.keyword.trim());

        const query = params.toString();
        const response = (await axiosInstance.get<TPostListResponse>(`/wards/${wardId}/board/posts${query ? `?${query}` : ''}`)).data;

        return {
            posts: normalizePosts(response),
            nextCursorId: response.nextCursorId,
            hasNext: response.hasNext ?? Boolean(response.nextCursorId),
        };
    }

    public async getPost(wardId: number, postId: number) {
        return (
            await axiosInstance.get<TWardBoardPost>(`/wards/${wardId}/board/posts/${postId}`, {
                suppressErrorToast: true,
            })
        ).data;
    }

    public async createPost(wardId: number, post: TCreateWardBoardPostDTO) {
        const payload: TCreateWardBoardPostDTO = {
            title: post.title,
            content: post.content,
        };

        if (post.deadlineDate) payload.deadlineDate = post.deadlineDate;

        if (post.imageUrls?.length) payload.imageUrls = post.imageUrls;

        return (await axiosInstance.post<TWardBoardPost>(`/wards/${wardId}/board/posts`, payload)).data;
    }

    public async deletePost(wardId: number, postId: number) {
        return (await axiosInstance.delete<void>(`/wards/${wardId}/board/posts/${postId}`)).data;
    }

    public async likePost(wardId: number, postId: number) {
        return (await axiosInstance.put<void>(`/wards/${wardId}/board/posts/${postId}/likes`)).data;
    }

    public async unlikePost(wardId: number, postId: number) {
        return (await axiosInstance.delete<void>(`/wards/${wardId}/board/posts/${postId}/likes`)).data;
    }

    public async checkPost(wardId: number, postId: number) {
        return (await axiosInstance.put<void>(`/wards/${wardId}/board/posts/${postId}/checks`)).data;
    }

    public async uncheckPost(wardId: number, postId: number) {
        return (await axiosInstance.delete<void>(`/wards/${wardId}/board/posts/${postId}/checks`)).data;
    }

    public async getCheckers(wardId: number, postId: number) {
        const response = (
            await axiosInstance.get<{checkers?: TWardBoardChecker[]; checkedUserNames?: string[]}>(
                `/wards/${wardId}/board/posts/${postId}/checkers`,
            )
        ).data;
        const checkers: TWardBoardChecker[] =
            response.checkers ?? response.checkedUserNames?.map((name) => ({accountId: undefined, name})) ?? [];

        return {
            checkers,
            checkedUserNames: response.checkedUserNames ?? checkers.map((checker) => checker.name),
        };
    }

    public async getComments(wardId: number, postId: number, options?: {cursorId?: number; size?: number}) {
        const params = new URLSearchParams();

        if (options?.cursorId) params.set('cursorId', String(options.cursorId));

        if (options?.size) params.set('size', String(options.size));

        const query = params.toString();
        const response = (
            await axiosInstance.get<TCommentListResponse>(`/wards/${wardId}/board/posts/${postId}/comments${query ? `?${query}` : ''}`)
        ).data;

        return {
            comments: normalizeComments(response),
            nextCursorId: response.nextCursorId,
        };
    }

    public async createComment(wardId: number, postId: number, comment: TCreateWardBoardCommentDTO) {
        return (await axiosInstance.post<TWardBoardComment>(`/wards/${wardId}/board/posts/${postId}/comments`, comment)).data;
    }

    public async deleteComment(wardId: number, commentId: number) {
        return (await axiosInstance.delete<void>(`/wards/${wardId}/board/comments/${commentId}`)).data;
    }

    public async createReply(wardId: number, commentId: number, comment: TCreateWardBoardCommentDTO) {
        return (await axiosInstance.post<TWardBoardComment>(`/wards/${wardId}/board/comments/${commentId}/replies`, comment)).data;
    }

    public async getDeadlines(wardId: number, startDate: string, endDate: string) {
        const query = new URLSearchParams({startDate, endDate}).toString();

        return (await axiosInstance.get<TWardBoardDeadline[]>(`/wards/${wardId}/board/deadlines?${query}`)).data;
    }

    public async getSchedules(wardId: number, startDate: string, endDate: string) {
        const query = new URLSearchParams({startDate, endDate}).toString();
        const response = (
            await axiosInstance.get<TScheduleListResponse | TWardBoardSchedule[]>(`/wards/${wardId}/board/schedules?${query}`)
        ).data;

        return normalizeSchedules(response);
    }

    public async createSchedule(wardId: number, schedule: TCreateWardBoardScheduleDTO) {
        return (await axiosInstance.post<TWardBoardSchedule>(`/wards/${wardId}/board/schedules`, withScheduleAllDayAlias(schedule))).data;
    }

    public async updateSchedule(wardId: number, scheduleId: TWardBoardScheduleId, schedule: TUpdateWardBoardScheduleDTO) {
        return (
            await axiosInstance.put<TWardBoardSchedule>(`/wards/${wardId}/board/schedules/${scheduleId}`, withScheduleAllDayAlias(schedule))
        ).data;
    }

    public async deleteSchedule(wardId: number, scheduleId: TWardBoardScheduleId) {
        return (await axiosInstance.delete<void>(`/wards/${wardId}/board/schedules/${scheduleId}`)).data;
    }

    public getPostId(post: TWardBoardPost) {
        return readPostId(post);
    }

    public getScheduleId(schedule: TWardBoardSchedule) {
        return readScheduleId(schedule);
    }

    public getScheduleEventKey(schedule: TWardBoardSchedule) {
        return readScheduleEventKey(schedule);
    }
}

export default new ApiBoardAPI();
