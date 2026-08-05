import type {TShiftTeamResponse, TWardChatMessageResponse, TWardChatUnreadCountResponse} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {type QueryClient, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {AnimationItem} from 'lottie-web';
import {ChevronUp, ImagePlus, Loader2, RefreshCcw, SendHorizontal, ShieldCheck, Users, X} from 'lucide-react';
import {Fragment, type FormEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {ProfileImage} from '@/entities/account/ui/profile-image';
import useAuth from '@/features/auth';
import {getWardAdminAccountIdFromAccessToken} from '@/features/auth/model/admin-token';
import {uploadImageToS3} from '@/features/file/model/upload-file';
import i18n from '@/i18n';
import {FileAPI, WardAPI} from '@/shared/api';
import {FILE_TYPE} from '@/shared/api/file/type';
import popiconsChatDotsAnimation from '@/shared/assets/animation/popicons-chat-dots.json';
import wardCodeChatImage from '@/shared/assets/images/ward-code-chat.png';
import {isWardChatEnabled} from '@/shared/config/feature-flags';
import {RUNTIME_CONFIG} from '@/shared/config/runtime';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {getLocaleForLanguage} from '@/shared/i18n/locale';
import {Button} from '@/shared/ui/primitives/button';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';
import {WardChatPreviewBubble} from '@/widgets/ward-chat/ui/ward-chat-preview-bubble';

const CHAT_PAGE_SIZE = 30;
const OPEN_REFETCH_INTERVAL_MS = 5000;
const UNREAD_REFETCH_INTERVAL_MS = 15000;
const REALTIME_RECONNECT_DELAY_MS = 3000;
const WARD_CHAT_REALTIME_EVENT_TYPE = 'WARD_CHAT_MESSAGE_CREATED';
const WARD_CHAT_ICON_REST_FRAME = 40;
const WARD_CHAT_ICON_HOVER_SEGMENT: [number, number] = [40, 80];
const WARD_CHAT_ICON_HOVER_SPEED = 0.45;
const WARD_CHAT_MESSAGE_PREVIEW_MS = 4800;
const CHAT_IMAGE_MAX_COUNT = 5;
const CHAT_IMAGE_MAX_SIZE_MB = 10;
const CHAT_IMAGE_MAX_SIZE_BYTES = CHAT_IMAGE_MAX_SIZE_MB * 1024 * 1024;
const CHAT_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif']);
const CHAT_IMAGE_URL_KEYS = ['imageUrls', 'images', 'photoUrls', 'photos', 'attachments'] as const;
const wardChatQueryKeys = {
    connectedMembers: (wardId: number) => ['ward-chat', 'connected-members', wardId] as const,
    messages: (wardId: number) => ['ward-chat', 'messages', wardId] as const,
    unread: (wardId: number) => ['ward-chat', 'unread', wardId] as const,
};
const homeWardChatUnreadQueryKey = (wardId: number) => ['home', 'ward-chat-unread', wardId] as const;

type TWardChatRealtimePayload = Record<string, unknown>;
type TWardChatMessagePreview = {
    messageId: number;
    senderName: string;
    senderProfileImgUrl?: string | null;
    text: string;
};
type TChatImageAttachment = {
    id: string;
    file: File;
    name: string;
    previewUrl: string;
    extension: string;
    uploadedUrl?: string;
    isUploading: boolean;
};
type TSendWardChatMessageInput = {
    text: string;
    imageUrls: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    if (typeof value === 'string' && value.trim()) {
        const numberValue = Number(value);

        return Number.isFinite(numberValue) ? numberValue : null;
    }

    return null;
}

function toNullableNumber(value: unknown): number | null {
    return value == null ? null : toFiniteNumber(value);
}

function toUnreadCount(value: unknown): number | null {
    const unreadCount = toFiniteNumber(value);

    if (unreadCount == null) return null;

    return Math.max(0, Math.trunc(unreadCount));
}

function toTrimmedStringList(value: unknown) {
    if (!Array.isArray(value)) return [];

    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => item.length > 0);
}

function readChatImageUrls(record: Record<string, unknown>) {
    const imageUrls: string[] = [];
    const seenUrls = new Set<string>();

    CHAT_IMAGE_URL_KEYS.forEach((key) => {
        toTrimmedStringList(record[key]).forEach((imageUrl) => {
            if (seenUrls.has(imageUrl)) return;

            seenUrls.add(imageUrl);
            imageUrls.push(imageUrl);
        });
    });

    return imageUrls.slice(0, CHAT_IMAGE_MAX_COUNT);
}

function getChatImageUrls(message: TWardChatMessageResponse) {
    if (message.isDeleted) return [];

    return toTrimmedStringList(message.imageUrls).slice(0, CHAT_IMAGE_MAX_COUNT);
}

function getWardChatPreviewText(message: TWardChatMessageResponse, t: ReturnType<typeof useTypedTranslation>['t']) {
    if (message.isDeleted) return t('widget.wardChat.deletedMessage');

    const text = message.text.trim();

    if (text) return text;

    if (getChatImageUrls(message).length > 0) return t('widget.wardChat.photoPreview');

    return t('widget.wardChat.emptyPreview');
}

function setWardChatUnreadCount(queryClient: QueryClient, wardId: number, unreadCount: number) {
    const updater = (prev: TWardChatUnreadCountResponse | undefined): TWardChatUnreadCountResponse => ({
        moimId: prev?.moimId ?? 0,
        wardId,
        unreadCount,
    });

    queryClient.setQueryData<TWardChatUnreadCountResponse>(wardChatQueryKeys.unread(wardId), updater);
    queryClient.setQueryData<TWardChatUnreadCountResponse>(homeWardChatUnreadQueryKey(wardId), updater);
}

function countConnectedWardMembers(shiftTeams: TShiftTeamResponse[]) {
    return shiftTeams.reduce((count, shiftTeam) => count + shiftTeam.nurses.filter((nurse) => nurse.isConnected).length, 0);
}

function parseSseBlock(block: string) {
    const dataLines: string[] = [];

    let eventName = '';

    block.split(/\r?\n/).forEach((line) => {
        if (!line || line.startsWith(':')) return;

        const separatorIndex = line.indexOf(':');
        const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;

        let value = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : '';

        if (value.startsWith(' ')) value = value.slice(1);

        if (field === 'event') eventName = value;

        if (field === 'data') dataLines.push(value);
    });

    if (dataLines.length === 0) return null;

    return {eventName, data: dataLines.join('\n')};
}

function parseWardChatRealtimePayload(block: string): TWardChatRealtimePayload | null {
    const parsedBlock = parseSseBlock(block);

    if (!parsedBlock) return null;

    try {
        const eventData = asRecord(JSON.parse(parsedBlock.data));
        const eventType = typeof eventData?.type === 'string' ? eventData.type : parsedBlock.eventName;

        if (eventType !== WARD_CHAT_REALTIME_EVENT_TYPE) return null;

        return asRecord(eventData?.payload) ?? eventData;
    } catch {
        return null;
    }
}

function toWardChatMessage(payload: TWardChatRealtimePayload): TWardChatMessageResponse | null {
    const messageId = toFiniteNumber(payload.messageId);
    const wardId = toFiniteNumber(payload.wardId);

    if (messageId == null || messageId <= 0 || wardId == null || wardId <= 0) return null;

    return {
        messageId,
        moimId: toFiniteNumber(payload.moimId) ?? 0,
        wardId,
        senderAccountId: toNullableNumber(payload.senderAccountId),
        senderWardAdminAccountId: toNullableNumber(payload.senderWardAdminAccountId),
        senderType: payload.senderType === 'WARD_ADMIN' ? 'WARD_ADMIN' : 'ACCOUNT',
        senderName: typeof payload.senderName === 'string' ? payload.senderName : '',
        senderProfileImgUrl: typeof payload.senderProfileImgUrl === 'string' ? payload.senderProfileImgUrl : null,
        text: typeof payload.text === 'string' ? payload.text : '',
        imageUrls: readChatImageUrls(payload),
        sentAt: typeof payload.sentAt === 'string' ? payload.sentAt : new Date().toISOString(),
        isDeleted: payload.isDeleted === true,
        unreadMemberCount: toUnreadCount(payload.unreadMemberCount),
    };
}

async function readRealtimeEventStream(response: Response, onPayload: (payload: TWardChatRealtimePayload) => void, signal: AbortSignal) {
    const reader = response.body?.getReader();

    if (!reader) return;

    const decoder = new TextDecoder();

    let buffer = '';

    while (!signal.aborted) {
        const {done, value} = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {stream: true});

        const blocks = buffer.split(/\r?\n\r?\n/);

        buffer = blocks.pop() ?? '';

        blocks.forEach((block) => {
            const payload = parseWardChatRealtimePayload(block);

            if (payload) onPayload(payload);
        });
    }

    buffer += decoder.decode();

    const payload = parseWardChatRealtimePayload(buffer);

    if (payload) onPayload(payload);
}

function waitForRealtimeReconnect(signal: AbortSignal) {
    return new Promise<void>((resolve) => {
        const handleAbort = () => {
            window.clearTimeout(timerId);
            resolve();
        };
        const handleTimeout = () => {
            signal.removeEventListener('abort', handleAbort);
            resolve();
        };
        const timerId = window.setTimeout(handleTimeout, REALTIME_RECONNECT_DELAY_MS);

        signal.addEventListener('abort', handleAbort, {once: true});
    });
}

function isMyMessage(message: TWardChatMessageResponse, accountId: number | null, wardAdminAccountId: number | null) {
    return (
        (accountId != null && message.senderAccountId === accountId) ||
        (wardAdminAccountId != null && message.senderWardAdminAccountId === wardAdminAccountId)
    );
}

function isWardAdminMessage(message: TWardChatMessageResponse) {
    return message.senderType === 'WARD_ADMIN' || message.senderWardAdminAccountId != null;
}

function WardChatImageIcon({className}: {className?: string}) {
    return (
        <img
            src={wardCodeChatImage}
            alt=""
            aria-hidden="true"
            width={156}
            height={160}
            decoding="async"
            className={cn('object-contain', className)}
        />
    );
}

function createClientMessageId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getChatImageFileExtension(file: File) {
    const filenameExtension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const mimeExtension = file.type.split('/').pop()?.toLowerCase() ?? '';
    const extension = filenameExtension || mimeExtension;

    if (extension === 'jpeg') return 'jpg';

    return CHAT_IMAGE_EXTENSIONS.has(extension) ? extension : 'jpg';
}

function isChatImageFile(file: File) {
    if (file.type.toLowerCase().startsWith('image/')) return true;

    return CHAT_IMAGE_EXTENSIONS.has(getChatImageFileExtension(file));
}

function getMessageTime(value: string, formatter: Intl.DateTimeFormat) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return formatter.format(date);
}

function getDateLabel(value: string, formatter: Intl.DateTimeFormat) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return formatter.format(date);
}

function compareMessages(a: TWardChatMessageResponse, b: TWardChatMessageResponse) {
    const sentAtDiff = Date.parse(a.sentAt) - Date.parse(b.sentAt);

    if (Number.isFinite(sentAtDiff) && sentAtDiff !== 0) return sentAtDiff;

    return a.messageId - b.messageId;
}

function mergeMessages(current: TWardChatMessageResponse[], incoming: TWardChatMessageResponse[]) {
    const messages = new Map(current.map((message) => [message.messageId, message]));

    incoming.forEach((message) => {
        const existingMessage = messages.get(message.messageId);

        messages.set(message.messageId, {
            ...existingMessage,
            ...message,
            imageUrls: message.imageUrls ?? existingMessage?.imageUrls,
            unreadMemberCount: message.unreadMemberCount ?? existingMessage?.unreadMemberCount,
        });
    });

    return Array.from(messages.values()).sort(compareMessages);
}

function getNewestMessageId(messages: TWardChatMessageResponse[]) {
    return messages.reduce((newestId, message) => Math.max(newestId, message.messageId), 0);
}

function getUnreadLabel(unreadCount: number) {
    if (unreadCount > 99) return '99+';

    return String(unreadCount);
}

function getNonEmptyTrimmedText(value: string | undefined, fallback: string) {
    if (value == null) return fallback;

    const trimmedValue = value.trim();

    if (trimmedValue.length === 0) return fallback;

    return trimmedValue;
}

function SenderName({message}: {message: TWardChatMessageResponse}) {
    return (
        <span className="flex min-w-0 items-center gap-1.5 px-1 text-[12px] font-semibold text-gray-3">
            {isWardAdminMessage(message) ? (
                <span className="inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full border border-[#F4CF6A] bg-[#FFF4CC] px-1.5 text-[10px] leading-none font-bold text-[#9A6100]">
                    <ShieldCheck className="size-3" strokeWidth={2.3} aria-hidden="true" />
                    <span>운영자</span>
                </span>
            ) : null}
            <span className="truncate">{message.senderName}</span>
        </span>
    );
}

function ChatImageGrid({imageUrls, onPreviewImage}: {imageUrls: string[]; onPreviewImage: (imageUrl: string) => void}) {
    const {t} = useTypedTranslation();
    const urls = imageUrls.slice(0, CHAT_IMAGE_MAX_COUNT);
    const gridClassName =
        urls.length === 1 ? 'grid-cols-1 w-[184px]' : urls.length === 2 ? 'grid-cols-2 w-[212px]' : 'grid-cols-3 w-[212px]';
    const imageClassName = urls.length === 1 ? 'size-[184px]' : urls.length === 2 ? 'size-[104px]' : 'size-[68px]';

    return (
        <div className={cn('grid shrink-0 gap-1 overflow-hidden rounded-[12px]', gridClassName)}>
            {urls.map((imageUrl, index) => (
                <button
                    key={`${imageUrl}-${index}`}
                    type="button"
                    className={cn(
                        'block overflow-hidden bg-gray-6 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none',
                        imageClassName,
                    )}
                    aria-label={t('widget.wardChat.imagePreviewAria', {index: index + 1, total: urls.length})}
                    title={t('widget.wardChat.imagePreviewTitle')}
                    onClick={() => onPreviewImage(imageUrl)}
                >
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                </button>
            ))}
        </div>
    );
}

function ChatMessage({
    message,
    isMine,
    formatTime,
    onPreviewImage,
}: {
    message: TWardChatMessageResponse;
    isMine: boolean;
    formatTime: (value: string) => string;
    onPreviewImage: (imageUrl: string) => void;
}) {
    const {t} = useTypedTranslation();
    const text = message.isDeleted ? t('widget.wardChat.deletedMessage') : message.text;
    const imageUrls = getChatImageUrls(message);
    const hasText = text.trim().length > 0;
    const hasImages = imageUrls.length > 0;
    const unreadMemberCount = isMine ? Math.max(0, Math.trunc(message.unreadMemberCount ?? 0)) : 0;

    return (
        <div className={cn('flex w-full min-w-0 gap-2.5', isMine ? 'justify-end' : 'justify-start')}>
            {isMine ? null : (
                <ProfileImage
                    name={message.senderName}
                    profileImg={message.senderProfileImgUrl ? {profileImgUrl: message.senderProfileImgUrl} : undefined}
                    className="mt-5 size-8 shrink-0 rounded-full"
                />
            )}
            <div className={cn('flex max-w-[78%] min-w-0 flex-col gap-1', isMine ? 'items-end' : 'items-start')}>
                {isMine ? null : <SenderName message={message} />}
                <div className={cn('flex max-w-full min-w-0 items-end gap-1.5', isMine ? 'flex-row-reverse' : 'flex-row')}>
                    <div
                        className={cn(
                            'max-w-full min-w-0 rounded-[18px] shadow-sm',
                            message.isDeleted
                                ? 'border border-[#E1E6EF] bg-[#F3F5F8] text-gray-4 italic shadow-none'
                                : isMine
                                  ? 'rounded-br-[7px] bg-main-1 text-white shadow-[0_8px_18px_rgba(102,61,250,0.18)]'
                                  : 'rounded-bl-[7px] border border-[#EDF0F4] bg-white text-[#242428]',
                            hasImages ? 'p-2' : 'px-3.5 py-2.5',
                        )}
                    >
                        {hasImages ? <ChatImageGrid imageUrls={imageUrls} onPreviewImage={onPreviewImage} /> : null}
                        {hasText ? (
                            <p
                                className={cn(
                                    'max-w-full min-w-0 text-[14px] leading-[21px] [overflow-wrap:anywhere] whitespace-pre-wrap',
                                    hasImages ? 'mt-2 px-1' : '',
                                )}
                            >
                                {text}
                            </p>
                        ) : null}
                    </div>
                    <span
                        className={cn(
                            'mb-1 flex shrink-0 flex-col gap-0.5 text-[11px] font-medium text-gray-4',
                            isMine ? 'items-end' : 'items-start',
                        )}
                    >
                        {unreadMemberCount > 0 ? <span className="font-bold text-main-1">{getUnreadLabel(unreadMemberCount)}</span> : null}
                        <span>{formatTime(message.sentAt)}</span>
                    </span>
                </div>
            </div>
        </div>
    );
}

function ChatImagePreviewModal({imageUrl, onClose}: {imageUrl: string; onClose: () => void}) {
    const {t} = useTypedTranslation();

    return (
        <div
            className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/72 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={t('widget.wardChat.imagePreviewTitle')}
            onClick={onClose}
        >
            <div className="relative max-h-full max-w-full" onClick={(event) => event.stopPropagation()}>
                <button
                    type="button"
                    className="absolute -top-3 -right-3 z-10 flex size-9 items-center justify-center rounded-full bg-white text-sub-1 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-colors hover:bg-gray-7 focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none"
                    aria-label={t('widget.wardChat.closeImagePreviewAria')}
                    onClick={onClose}
                >
                    <X className="size-5" aria-hidden="true" />
                </button>
                <img
                    src={imageUrl}
                    alt=""
                    className="max-h-[84vh] max-w-[92vw] rounded-[8px] bg-white object-contain shadow-[0_18px_60px_rgba(0,0,0,0.35)]"
                />
            </div>
        </div>
    );
}

function MessageSkeleton() {
    return (
        <div className="space-y-4 px-5 py-5">
            {Array.from({length: 4}, (_, index) => (
                <div key={index} className={cn('flex gap-2.5', index % 2 === 0 ? 'justify-start' : 'justify-end')}>
                    {index % 2 === 0 ? <div className="size-8 rounded-full bg-gray-6" /> : null}
                    <div className={cn('h-10 rounded-[18px] bg-gray-6', index % 2 === 0 ? 'w-44' : 'w-32')} />
                </div>
            ))}
        </div>
    );
}

function recolorLottieShapesWhite(value: unknown) {
    if (!value || typeof value !== 'object') return;

    if (Array.isArray(value)) {
        value.forEach(recolorLottieShapesWhite);

        return;
    }

    const record = value as Record<string, unknown>;
    const color = record.c;

    if (color && typeof color === 'object' && Array.isArray((color as Record<string, unknown>).k)) {
        (color as Record<string, unknown>).k = [1, 1, 1];
    }

    Object.values(record).forEach(recolorLottieShapesWhite);
}

function keepChatDotsVisible(animationData: typeof popiconsChatDotsAnimation) {
    animationData.layers.slice(0, 3).forEach((layer) => {
        const dotTransform = layer.shapes?.[0]?.it?.[2];

        if (!dotTransform || !('o' in dotTransform)) return;

        dotTransform.o = {a: 0, k: 100, ix: 2};
    });
}

function clonePopiconsChatDotsAnimation() {
    const animationData = JSON.parse(JSON.stringify(popiconsChatDotsAnimation)) as typeof popiconsChatDotsAnimation;

    recolorLottieShapesWhite(animationData);
    keepChatDotsVisible(animationData);

    return animationData;
}

function WardChatFloatingIcon({isPlaying}: {isPlaying: boolean}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const animationRef = useRef<AnimationItem | null>(null);
    const isPlayingRef = useRef(isPlaying);
    const [isAnimationReady, setIsAnimationReady] = useState(false);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
        let isDisposed = false;

        if (!containerRef.current) return;

        if (import.meta.env.MODE === 'test') return;

        void import('lottie-web/build/player/lottie_light').then(({default: lottiePlayer}) => {
            if (isDisposed || !containerRef.current) return;

            const animation = lottiePlayer.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: false,
                autoplay: false,
                animationData: clonePopiconsChatDotsAnimation(),
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid meet',
                },
            });

            animationRef.current = animation;
            animation.setSpeed(WARD_CHAT_ICON_HOVER_SPEED);
            setIsAnimationReady(true);

            if (isPlayingRef.current) {
                animation.playSegments(WARD_CHAT_ICON_HOVER_SEGMENT, true);

                return;
            }

            animation.goToAndStop(WARD_CHAT_ICON_REST_FRAME, true);
        });

        return () => {
            isDisposed = true;
            animationRef.current?.destroy();
            animationRef.current = null;
        };
    }, []);

    useEffect(() => {
        const animation = animationRef.current;

        if (!animation) return;

        if (isPlaying) {
            animation.playSegments(WARD_CHAT_ICON_HOVER_SEGMENT, true);

            return;
        }

        animation.goToAndStop(WARD_CHAT_ICON_REST_FRAME, true);
    }, [isPlaying]);

    return (
        <span aria-hidden="true" className="relative block size-11 overflow-hidden">
            <svg
                viewBox="0 0 75 75"
                fill="none"
                className={cn(
                    'absolute inset-0 size-full scale-[3.1] transition-opacity duration-150',
                    isAnimationReady ? 'opacity-0' : 'opacity-100',
                )}
            >
                <path
                    d="M45.76 37.3c0 4.44-3.7 8.04-8.25 8.04-.7 0-1.4-.08-2.06-.25-.45-.11-.86-.08-1.3.08-.87.32-2.17.47-3.89.43.7-.73 1.06-1.52 1.12-2.37.04-.45-.12-.85-.39-1.21-.99-1.33-1.57-2.95-1.57-4.72 0-4.44 3.69-8.04 8.25-8.04s8.25 3.6 8.25 8.04z"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle cx="33.5" cy="37.48" r="1" fill="#FFFFFF" />
                <circle cx="37.5" cy="37.48" r="1" fill="#FFFFFF" />
                <circle cx="41.5" cy="37.48" r="1" fill="#FFFFFF" />
            </svg>
            <span
                ref={containerRef}
                className={cn(
                    'absolute inset-0 block size-full scale-[3.1] transition-opacity duration-150 [&>svg]:block [&>svg]:size-full',
                    isAnimationReady ? 'opacity-100' : 'opacity-0',
                )}
            />
        </span>
    );
}

export default function WardChatWidget() {
    const {t} = useTypedTranslation();
    const {
        state: {accessToken, accountId, isDemoExpired, wardId},
    } = useAuth();
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [isFloatingButtonHovered, setIsFloatingButtonHovered] = useState(false);
    const [messagePreview, setMessagePreview] = useState<TWardChatMessagePreview | null>(null);
    const [draft, setDraft] = useState('');
    const [selectedImages, setSelectedImages] = useState<TChatImageAttachment[]>([]);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [messages, setMessages] = useState<TWardChatMessageResponse[]>([]);
    const [nextCursorMessageId, setNextCursorMessageId] = useState<number | null>(null);
    const chatPanelRef = useRef<HTMLElement | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const imagePreviewUrlsRef = useRef<Set<string>>(new Set());
    const isOpenRef = useRef(isOpen);
    const messagePreviewTimerRef = useRef<number | null>(null);
    const acknowledgedMessageIdRef = useRef<number | null>(null);
    const lastPreviewedMessageIdRef = useRef<number | null>(null);
    const lastPreviewedUnreadCountRef = useRef<number | null>(null);
    const skipNextUnreadPreviewRef = useRef(false);
    const effectiveWardId = wardId ?? 0;
    const isWidgetAvailable = Boolean(wardId) && !isDemoExpired && isWardChatEnabled();
    const revokeImagePreviewUrl = useCallback((previewUrl: string) => {
        if (!imagePreviewUrlsRef.current.delete(previewUrl)) return;

        URL.revokeObjectURL(previewUrl);
    }, []);
    const clearSelectedImages = useCallback(() => {
        setSelectedImages((current) => {
            current.forEach((image) => revokeImagePreviewUrl(image.previewUrl));

            return [];
        });

        if (imageInputRef.current) imageInputRef.current.value = '';
    }, [revokeImagePreviewUrl]);
    const removeSelectedImage = useCallback(
        (imageId: string) => {
            setSelectedImages((current) => {
                const target = current.find((image) => image.id === imageId);

                if (target) revokeImagePreviewUrl(target.previewUrl);

                return current.filter((image) => image.id !== imageId);
            });
        },
        [revokeImagePreviewUrl],
    );
    const uploadSelectedImage = useCallback(
        async (attachment: TChatImageAttachment) => {
            try {
                const {presignedUrl, fileUrl} = await FileAPI.getPresignedUrl(FILE_TYPE.CHAT_IMAGE, attachment.extension);

                await uploadImageToS3(presignedUrl, attachment.file);

                setSelectedImages((current) =>
                    current.map((image) =>
                        image.id === attachment.id
                            ? {
                                  ...image,
                                  uploadedUrl: fileUrl,
                                  isUploading: false,
                              }
                            : image,
                    ),
                );
            } catch {
                setSelectedImages((current) => {
                    const target = current.find((image) => image.id === attachment.id);

                    if (target) revokeImagePreviewUrl(target.previewUrl);

                    return current.filter((image) => image.id !== attachment.id);
                });
                toast.error(t('widget.wardChat.toast.imageUploadFailed'));
            }
        },
        [revokeImagePreviewUrl, t],
    );
    const handleSelectImages = useCallback(
        (files: FileList | null) => {
            const selectedFiles = Array.from(files ?? []);

            if (imageInputRef.current) imageInputRef.current.value = '';

            if (selectedFiles.length === 0) return;

            const availableCount = CHAT_IMAGE_MAX_COUNT - selectedImages.length;

            if (availableCount <= 0) {
                toast.error(t('widget.wardChat.toast.maxImageCount', {count: CHAT_IMAGE_MAX_COUNT}));

                return;
            }

            const acceptedImages: TChatImageAttachment[] = [];

            let rejectedForType = false;
            let rejectedForSize = false;

            const omittedForCount = selectedFiles.length > availableCount;

            selectedFiles.slice(0, availableCount).forEach((file) => {
                if (!isChatImageFile(file)) {
                    rejectedForType = true;

                    return;
                }

                if (file.size > CHAT_IMAGE_MAX_SIZE_BYTES) {
                    rejectedForSize = true;

                    return;
                }

                const previewUrl = URL.createObjectURL(file);

                imagePreviewUrlsRef.current.add(previewUrl);
                acceptedImages.push({
                    id: createClientMessageId(),
                    file,
                    name: file.name || t('widget.wardChat.imageFallbackName'),
                    previewUrl,
                    extension: getChatImageFileExtension(file),
                    isUploading: true,
                });
            });

            if (acceptedImages.length === 0) {
                if (rejectedForType) toast.error(t('widget.wardChat.toast.imageOnly'));

                if (rejectedForSize) toast.error(t('widget.wardChat.toast.maxImageSize', {size: CHAT_IMAGE_MAX_SIZE_MB}));

                return;
            }

            setSelectedImages((current) => [...current, ...acceptedImages].slice(0, CHAT_IMAGE_MAX_COUNT));
            acceptedImages.forEach((attachment) => void uploadSelectedImage(attachment));

            if (omittedForCount) toast.error(t('widget.wardChat.toast.maxImageCount', {count: CHAT_IMAGE_MAX_COUNT}));

            if (rejectedForType) toast.error(t('widget.wardChat.toast.imageOnly'));

            if (rejectedForSize) toast.error(t('widget.wardChat.toast.maxImageSize', {size: CHAT_IMAGE_MAX_SIZE_MB}));
        },
        [selectedImages.length, t, uploadSelectedImage],
    );
    const unreadQuery = useQuery({
        queryKey: wardChatQueryKeys.unread(effectiveWardId),
        queryFn: () => WardAPI.getWardChatUnreadCount(effectiveWardId),
        enabled: isWidgetAvailable,
        retry: false,
        refetchInterval: isOpen ? false : UNREAD_REFETCH_INTERVAL_MS,
    });
    const messagesQuery = useQuery({
        queryKey: wardChatQueryKeys.messages(effectiveWardId),
        queryFn: () => WardAPI.getWardChatMessages(effectiveWardId, {size: CHAT_PAGE_SIZE}),
        enabled: isWidgetAvailable && isOpen,
        retry: false,
        refetchInterval: isOpen ? OPEN_REFETCH_INTERVAL_MS : false,
    });
    const connectedMemberCountQuery = useQuery({
        queryKey: wardChatQueryKeys.connectedMembers(effectiveWardId),
        queryFn: async () => countConnectedWardMembers(await WardAPI.getShiftTeams(effectiveWardId)),
        enabled: isWidgetAvailable && isOpen,
        retry: false,
        staleTime: 30000,
    });
    const loadOlderMutation = useMutation({
        mutationFn: (cursorMessageId: number) =>
            WardAPI.getWardChatMessages(effectiveWardId, {
                cursorMessageId,
                size: CHAT_PAGE_SIZE,
            }),
        onSuccess: (data) => {
            setMessages((prev) => mergeMessages(prev, data.messages));
            setNextCursorMessageId(data.nextCursorMessageId ?? null);
        },
    });
    const readMutation = useMutation({
        mutationFn: (lastReadMessageId: number) => WardAPI.readWardChat(effectiveWardId, {lastReadMessageId}),
        onSuccess: () => {
            setWardChatUnreadCount(queryClient, effectiveWardId, 0);
        },
    });
    const sendMutation = useMutation({
        mutationFn: ({text, imageUrls}: TSendWardChatMessageInput) =>
            WardAPI.createWardChatMessage(effectiveWardId, {
                ...(text ? {text} : {}),
                ...(imageUrls.length > 0 ? {imageUrls} : {}),
                clientMessageId: createClientMessageId(),
            }),
        onSuccess: (message) => {
            setMessages((prev) => mergeMessages(prev, [message]));
            setDraft('');
            clearSelectedImages();
            void queryClient.invalidateQueries({queryKey: wardChatQueryKeys.messages(effectiveWardId)});
        },
        onError: () => {
            toast.error(t('widget.wardChat.toast.sendFailed'));
        },
    });
    const isUploadingImages = selectedImages.some((image) => image.isUploading);
    const uploadedImageUrls = selectedImages
        .map((image) => image.uploadedUrl?.trim())
        .filter((imageUrl): imageUrl is string => Boolean(imageUrl));
    const canSendMessage = (draft.trim().length > 0 || uploadedImageUrls.length > 0) && !isUploadingImages && !sendMutation.isPending;
    const unreadCount = unreadQuery.data?.unreadCount ?? messagesQuery.data?.unreadCount ?? 0;
    const connectedMemberLabel =
        typeof connectedMemberCountQuery.data === 'number'
            ? t('widget.wardChat.connectedMemberCount', {count: connectedMemberCountQuery.data})
            : t('widget.wardChat.subtitle');
    const hasOlderMessages = typeof nextCursorMessageId === 'number' && nextCursorMessageId > 0;
    const newestMessageId = useMemo(() => getNewestMessageId(messages), [messages]);
    const locale = getLocaleForLanguage(i18n.resolvedLanguage ?? i18n.language);
    const wardAdminAccountId = useMemo(() => getWardAdminAccountIdFromAccessToken(accessToken), [accessToken]);
    const timeFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat(locale, {
                hour: '2-digit',
                minute: '2-digit',
            }),
        [locale],
    );
    const dateFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat(locale, {
                month: 'long',
                day: 'numeric',
                weekday: 'short',
            }),
        [locale],
    );
    const formatMessageTime = (value: string) => getMessageTime(value, timeFormatter);
    const formatDateLabel = (value: string) => getDateLabel(value, dateFormatter);
    const hideMessagePreview = useCallback(() => {
        if (messagePreviewTimerRef.current != null) {
            window.clearTimeout(messagePreviewTimerRef.current);
            messagePreviewTimerRef.current = null;
        }

        setMessagePreview(null);
    }, []);
    const showMessagePreview = useCallback(
        (message: TWardChatMessageResponse) => {
            const shouldSkipPreview = isOpenRef.current || isMyMessage(message, accountId, wardAdminAccountId);

            if (shouldSkipPreview) return false;

            if (lastPreviewedMessageIdRef.current === message.messageId) return false;

            if (messagePreviewTimerRef.current != null) {
                window.clearTimeout(messagePreviewTimerRef.current);
            }

            lastPreviewedMessageIdRef.current = message.messageId;
            setMessagePreview({
                messageId: message.messageId,
                senderName: message.senderName,
                senderProfileImgUrl: message.senderProfileImgUrl ?? null,
                text: getWardChatPreviewText(message, t),
            });
            messagePreviewTimerRef.current = window.setTimeout(() => {
                setMessagePreview(null);
                messagePreviewTimerRef.current = null;
            }, WARD_CHAT_MESSAGE_PREVIEW_MS);

            return true;
        },
        [accountId, t, wardAdminAccountId],
    );
    const showUnreadFallbackPreview = useCallback(() => {
        if (isOpenRef.current) return;

        if (messagePreviewTimerRef.current != null) {
            window.clearTimeout(messagePreviewTimerRef.current);
        }

        setMessagePreview({
            messageId: 0,
            senderName: t('widget.wardChat.unknownSender'),
            senderProfileImgUrl: null,
            text: t('widget.wardChat.emptyPreview'),
        });
        messagePreviewTimerRef.current = window.setTimeout(() => {
            setMessagePreview(null);
            messagePreviewTimerRef.current = null;
        }, WARD_CHAT_MESSAGE_PREVIEW_MS);
    }, [t]);

    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) hideMessagePreview();
    }, [hideMessagePreview, isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;

            if (!(target instanceof Node)) return;

            if (chatPanelRef.current?.contains(target)) return;

            setIsOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);

        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isOpen]);

    useEffect(() => {
        setMessages([]);
        setNextCursorMessageId(null);
        setDraft('');
        clearSelectedImages();
        setPreviewImageUrl(null);
        hideMessagePreview();
        acknowledgedMessageIdRef.current = null;
        lastPreviewedMessageIdRef.current = null;
        lastPreviewedUnreadCountRef.current = null;
        skipNextUnreadPreviewRef.current = false;
    }, [clearSelectedImages, effectiveWardId, hideMessagePreview]);

    useEffect(() => hideMessagePreview, [hideMessagePreview]);

    useEffect(
        () => () => {
            imagePreviewUrlsRef.current.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
            imagePreviewUrlsRef.current.clear();
        },
        [],
    );

    useEffect(() => {
        const handleOpenWardChat = () => setIsOpen(true);

        window.addEventListener('dutying:open-ward-chat', handleOpenWardChat);

        return () => window.removeEventListener('dutying:open-ward-chat', handleOpenWardChat);
    }, []);

    useEffect(() => {
        if (!isWidgetAvailable || !accessToken || typeof fetch !== 'function') return;

        const abortController = new AbortController();
        const streamUrl = new URL('/events/stream', `${RUNTIME_CONFIG.serverUrl()}/`).toString();
        const handleRealtimePayload = (payload: TWardChatRealtimePayload) => {
            const eventWardId = toFiniteNumber(payload.wardId);

            if (eventWardId !== effectiveWardId) return;

            const unreadCount = toUnreadCount(payload.unreadCount);

            if (unreadCount != null) {
                setWardChatUnreadCount(queryClient, effectiveWardId, unreadCount);
            } else {
                void queryClient.invalidateQueries({queryKey: wardChatQueryKeys.unread(effectiveWardId)});
                void queryClient.invalidateQueries({queryKey: homeWardChatUnreadQueryKey(effectiveWardId)});
            }

            const message = toWardChatMessage(payload);

            if (message) {
                if (isOpenRef.current) {
                    setMessages((prev) => mergeMessages(prev, [message]));
                } else {
                    skipNextUnreadPreviewRef.current = showMessagePreview(message);
                }
            }
        };

        void (async () => {
            while (!abortController.signal.aborted) {
                try {
                    const response = await fetch(streamUrl, {
                        cache: 'no-store',
                        credentials: 'include',
                        headers: {
                            Accept: 'text/event-stream',
                            Authorization: `Bearer ${accessToken}`,
                        },
                        signal: abortController.signal,
                    });

                    if (!response.ok) return;

                    await readRealtimeEventStream(response, handleRealtimePayload, abortController.signal);
                } catch {
                    if (abortController.signal.aborted) return;
                }

                await waitForRealtimeReconnect(abortController.signal);
            }
        })();

        return () => abortController.abort();
    }, [accessToken, effectiveWardId, isWidgetAvailable, queryClient, showMessagePreview]);

    useEffect(() => {
        if (!messagesQuery.data) return;

        setMessages((prev) => mergeMessages(prev, messagesQuery.data.messages));
        setNextCursorMessageId(messagesQuery.data.nextCursorMessageId ?? null);
    }, [messagesQuery.data]);

    useEffect(() => {
        if (!isWidgetAvailable) return;

        if (unreadCount <= 0) {
            lastPreviewedUnreadCountRef.current = 0;
            skipNextUnreadPreviewRef.current = false;

            return;
        }

        if (isOpen) {
            lastPreviewedUnreadCountRef.current = unreadCount;

            return;
        }

        if (skipNextUnreadPreviewRef.current) {
            skipNextUnreadPreviewRef.current = false;
            lastPreviewedUnreadCountRef.current = unreadCount;

            return;
        }

        const previousUnreadCount = lastPreviewedUnreadCountRef.current;
        const shouldShowPreview = previousUnreadCount == null || unreadCount > previousUnreadCount;

        lastPreviewedUnreadCountRef.current = unreadCount;

        if (!shouldShowPreview) return;

        showUnreadFallbackPreview();

        let isDisposed = false;

        void WardAPI.getWardChatMessages(effectiveWardId, {size: 1})
            .then((data) => {
                if (isDisposed || isOpenRef.current) return;

                const newestMessage = data.messages.reduce<TWardChatMessageResponse | null>(
                    (newest, message) => (newest == null || compareMessages(newest, message) < 0 ? message : newest),
                    null,
                );

                if (newestMessage) showMessagePreview(newestMessage);
            })
            .catch(() => undefined);

        return () => {
            isDisposed = true;
        };
    }, [effectiveWardId, isOpen, isWidgetAvailable, showMessagePreview, showUnreadFallbackPreview, unreadCount]);

    useEffect(() => {
        if (!isOpen || !isWidgetAvailable || newestMessageId <= 0) return;

        if (acknowledgedMessageIdRef.current === newestMessageId) return;

        acknowledgedMessageIdRef.current = newestMessageId;
        readMutation.mutate(newestMessageId);
    }, [isOpen, isWidgetAvailable, newestMessageId, readMutation]);

    useEffect(() => {
        if (!isOpen) return;

        const timer = window.setTimeout(() => textareaRef.current?.focus(), 80);

        return () => window.clearTimeout(timer);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        bottomRef.current?.scrollIntoView({block: 'end'});
    }, [isOpen, messages.length]);

    useEffect(() => {
        const textarea = textareaRef.current;

        if (!textarea) return;

        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
    }, [draft]);

    if (!isWidgetAvailable) return null;

    const sendDraft = () => {
        const text = draft.trim();

        if (!canSendMessage) return;

        sendMutation.mutate({text, imageUrls: uploadedImageUrls});
    };
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        sendDraft();
    };
    const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

        event.preventDefault();
        sendDraft();
    };
    const handleLoadOlder = () => {
        if (!hasOlderMessages || loadOlderMutation.isPending) return;

        if (typeof nextCursorMessageId !== 'number') return;

        loadOlderMutation.mutate(nextCursorMessageId);
    };
    const previewSenderName = getNonEmptyTrimmedText(messagePreview?.senderName, t('widget.wardChat.unknownSender'));
    const previewSenderProfileImgUrl = messagePreview?.senderProfileImgUrl ?? null;
    const previewText = getNonEmptyTrimmedText(messagePreview?.text, t('widget.wardChat.emptyPreview'));

    return (
        <div className="fixed right-4 bottom-4 z-[1200] font-pretendard sm:right-6 sm:bottom-6">
            {isOpen ? (
                <section
                    ref={chatPanelRef}
                    aria-label={t('widget.wardChat.title')}
                    className="flex h-[min(640px,calc(100vh-32px))] w-[min(390px,calc(100vw-32px))] animate-in flex-col overflow-hidden rounded-[24px] border border-[#E7EAF0] bg-[#F8FAFC] shadow-[0_24px_70px_rgba(21,24,34,0.22)] duration-200 zoom-in-95 fade-in slide-in-from-bottom-4"
                >
                    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#EDF0F4] bg-white px-5 py-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="flex size-8 items-center justify-center">
                                    <WardChatImageIcon className="size-7" />
                                </span>
                                <h2 className="truncate text-[17px] font-bold text-[#17171C]">{t('widget.wardChat.title')}</h2>
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-gray-3">
                                <Users className="size-3.5" strokeWidth={2} aria-hidden="true" />
                                <span>{connectedMemberLabel}</span>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                            <button
                                type="button"
                                className="flex size-9 items-center justify-center rounded-full text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none"
                                aria-label={t('widget.wardChat.closeAria')}
                                onClick={() => setIsOpen(false)}
                            >
                                <X className="size-5" strokeWidth={2.2} aria-hidden="true" />
                            </button>
                        </div>
                    </header>

                    <div
                        className="scrollbar-hide min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4"
                        role="log"
                        aria-live="polite"
                    >
                        {messagesQuery.isLoading && messages.length === 0 ? <MessageSkeleton /> : null}

                        {messagesQuery.isError && messages.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                                <div className="flex size-12 items-center justify-center rounded-full bg-[#EEF3F7] text-gray-3">
                                    <RefreshCcw className="size-5" strokeWidth={2} aria-hidden="true" />
                                </div>
                                <p className="mt-4 text-[15px] font-bold text-sub-1">{t('widget.wardChat.state.loadFailed')}</p>
                                <Button
                                    type="button"
                                    variant="soft"
                                    size="sm"
                                    className="mt-4 h-9 rounded-full px-4"
                                    onClick={() => void messagesQuery.refetch()}
                                >
                                    {t('widget.wardChat.state.retry')}
                                </Button>
                            </div>
                        ) : null}

                        {!messagesQuery.isLoading && !messagesQuery.isError && messages.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                                <div className="flex size-14 items-center justify-center rounded-full bg-white text-main-1 shadow-sm">
                                    <WardChatImageIcon className="size-8" />
                                </div>
                                <p className="mt-4 text-[15px] font-bold text-sub-1">{t('widget.wardChat.state.emptyTitle')}</p>
                                <p className="mt-1 text-[13px] font-medium text-gray-3">{t('widget.wardChat.state.emptyDescription')}</p>
                            </div>
                        ) : null}

                        {messages.length > 0 ? (
                            <div className="min-w-0 space-y-4">
                                <div className="flex justify-center">
                                    {hasOlderMessages ? (
                                        <button
                                            type="button"
                                            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E5E9F0] bg-white px-3 text-[12px] font-bold text-gray-3 shadow-sm transition-colors hover:border-main-3 hover:text-main-1 focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
                                            disabled={loadOlderMutation.isPending}
                                            onClick={handleLoadOlder}
                                        >
                                            {loadOlderMutation.isPending ? (
                                                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                            ) : (
                                                <ChevronUp className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
                                            )}
                                            {t('widget.wardChat.loadOlder')}
                                        </button>
                                    ) : (
                                        <span className="rounded-full bg-[#EEF3F7] px-3 py-1.5 text-[11px] font-semibold text-gray-4">
                                            {t('widget.wardChat.conversationStart')}
                                        </span>
                                    )}
                                </div>

                                {messages.map((message, index) => {
                                    const dateLabel = formatDateLabel(message.sentAt);
                                    const prevDateLabel = index > 0 ? formatDateLabel(messages[index - 1].sentAt) : '';
                                    const showDateLabel = dateLabel && dateLabel !== prevDateLabel;

                                    return (
                                        <Fragment key={message.messageId}>
                                            {showDateLabel ? (
                                                <div className="flex justify-center">
                                                    <span className="rounded-full bg-[#EEF3F7] px-3 py-1.5 text-[11px] font-semibold text-gray-4">
                                                        {dateLabel}
                                                    </span>
                                                </div>
                                            ) : null}
                                            <ChatMessage
                                                message={message}
                                                isMine={isMyMessage(message, accountId, wardAdminAccountId)}
                                                formatTime={formatMessageTime}
                                                onPreviewImage={setPreviewImageUrl}
                                            />
                                        </Fragment>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>
                        ) : null}
                    </div>

                    <form className="shrink-0 border-t border-[#EDF0F4] bg-white p-3" onSubmit={handleSubmit}>
                        {selectedImages.length > 0 ? (
                            <div className="mb-2 flex max-w-full gap-2 overflow-x-auto pb-1">
                                {selectedImages.map((image) => (
                                    <div key={image.id} className="relative size-16 shrink-0 overflow-hidden rounded-[8px] bg-gray-6">
                                        <img src={image.previewUrl} alt="" className="h-full w-full object-cover" />
                                        {image.isUploading ? (
                                            <div
                                                className="absolute inset-0 flex items-center justify-center bg-black/35 text-white"
                                                role="status"
                                                aria-label={t('widget.wardChat.imageUploadingAria')}
                                            >
                                                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                                            </div>
                                        ) : null}
                                        <button
                                            type="button"
                                            className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-1 focus-visible:outline-none"
                                            aria-label={t('widget.wardChat.removeImageAria', {name: image.name})}
                                            title={t('widget.wardChat.removeImageTitle')}
                                            onClick={() => removeSelectedImage(image.id)}
                                        >
                                            <X className="size-3" aria-hidden="true" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        <div className="flex items-end gap-2 rounded-[20px] border border-[#E1E6EF] bg-[#F8FAFC] px-3 py-2 transition-colors focus-within:border-main-3 focus-within:bg-white">
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(event) => handleSelectImages(event.currentTarget.files)}
                            />
                            <button
                                type="button"
                                aria-label={t('widget.wardChat.addImageAria')}
                                title={t('widget.wardChat.addImageTitle')}
                                disabled={selectedImages.length >= CHAT_IMAGE_MAX_COUNT || sendMutation.isPending}
                                className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-gray-3 transition-colors hover:bg-gray-7 hover:text-main-1 focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none disabled:text-gray-5"
                                onClick={() => imageInputRef.current?.click()}
                            >
                                <ImagePlus className="size-4.5" strokeWidth={2.2} aria-hidden="true" />
                            </button>
                            <textarea
                                ref={textareaRef}
                                value={draft}
                                rows={1}
                                placeholder={t('widget.wardChat.inputPlaceholder')}
                                className="max-h-28 min-h-9 min-w-0 flex-1 resize-none bg-transparent py-2 text-[14px] leading-5 text-sub-1 placeholder:text-gray-4 focus:outline-none"
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={handleTextareaKeyDown}
                            />
                            <button
                                type="submit"
                                aria-label={t('widget.wardChat.sendAria')}
                                disabled={!canSendMessage}
                                className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-main-1 text-white transition-colors hover:bg-[#5631E7] focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none disabled:bg-gray-6 disabled:text-gray-4"
                            >
                                {sendMutation.isPending || isUploadingImages ? (
                                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                ) : (
                                    <SendHorizontal className="size-4" strokeWidth={2.4} aria-hidden="true" />
                                )}
                            </button>
                        </div>
                    </form>
                    {previewImageUrl ? <ChatImagePreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} /> : null}
                </section>
            ) : (
                <TooltipProvider delayDuration={200}>
                    <div className="relative flex items-end gap-2">
                        {messagePreview ? (
                            <WardChatPreviewBubble
                                senderName={previewSenderName}
                                senderProfileImgUrl={previewSenderProfileImgUrl}
                                text={previewText}
                                ariaLabel={t('widget.wardChat.previewOpenAria', {sender: previewSenderName, text: previewText})}
                                position="fixed"
                                onClick={() => {
                                    hideMessagePreview();
                                    setIsOpen(true);
                                }}
                            />
                        ) : null}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={
                                        unreadCount > 0
                                            ? t('widget.wardChat.openWithUnreadAria', {count: getUnreadLabel(unreadCount)})
                                            : t('widget.wardChat.openAria')
                                    }
                                    className="group relative flex size-[60px] items-center justify-center rounded-full bg-main-1 text-white shadow-[0_16px_32px_rgba(102,61,250,0.28)] transition-transform duration-150 hover:scale-[1.03] hover:bg-[#5631E7] focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none"
                                    onPointerEnter={() => setIsFloatingButtonHovered(true)}
                                    onPointerLeave={() => setIsFloatingButtonHovered(false)}
                                    onClick={() => {
                                        hideMessagePreview();
                                        setIsFloatingButtonHovered(false);
                                        setIsOpen(true);
                                    }}
                                >
                                    <WardChatFloatingIcon isPlaying={isFloatingButtonHovered} />
                                    {unreadCount > 0 ? (
                                        <span className="absolute -top-1 -right-1 flex min-w-[24px] items-center justify-center rounded-full border-2 border-white bg-[#E55C6E] px-1.5 text-[11px] leading-5 font-bold text-white">
                                            {getUnreadLabel(unreadCount)}
                                        </span>
                                    ) : null}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent
                                side="left"
                                className="rounded-full bg-[#1C2331] px-3 py-1.5 text-[12px] font-semibold text-white"
                            >
                                {t('widget.wardChat.title')}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            )}
        </div>
    );
}
