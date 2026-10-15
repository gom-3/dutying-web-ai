import * as Dialog from '@radix-ui/react-dialog';
import {memo, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import i18n from '@/i18n';
import {buildConversationSnapshot} from '../../../model/conversation-snapshot';
import {queueConversationCapture, readConversationImage, saveConversationImage} from '../../../model/conversation-image-cache';
import type {TResultVersion} from '../../../model/schedule-conversation-api';
import {MakeShiftCalendar} from '../shared/make-shift-calendar';

export const AiConversationImage = memo(function AiConversationImage({
    cacheKey,
    versionId,
    loadVersion,
}: {
    cacheKey: string;
    versionId: string;
    loadVersion: (id: string) => Promise<TResultVersion>;
}) {
    const ko = i18n.language.startsWith('ko');
    const copy = (kr: string, en: string) => (ko ? kr : en);
    const key = `${cacheKey}:${versionId}:${i18n.language}`;
    const host = useRef<HTMLDivElement>(null);
    const capture = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    const [version, setVersion] = useState<TResultVersion>();
    const [blob, setBlob] = useState<Blob>();
    const [url, setUrl] = useState('');
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [open, setOpen] = useState(false);
    const [actualSize, setActualSize] = useState(false);
    const snapshot = useMemo(() => (version ? buildConversationSnapshot(version) : null), [version]);
    const violations = useMemo(() => new Map(), []);
    const title = copy('근무표 결과 이미지', 'Schedule result image');

    useEffect(() => {
        if (!host.current) return;
        if (typeof IntersectionObserver === 'undefined') {
            setVisible(true);
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            {rootMargin: '120px'},
        );
        observer.observe(host.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        setFailed(false);
        const cached = readConversationImage(key);
        if (cached) {
            setBlob(cached);
            return;
        }
        loadVersion(versionId)
            .then((value) => {
                if (!cancelled) setVersion(value);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, [visible, key, versionId, loadVersion, attempt]);

    useEffect(() => {
        if (!version || !capture.current) return;
        let cancelled = false;
        const element = capture.current;
        queueConversationCapture(async () => {
            if (cancelled) return;
            const cached = readConversationImage(key);
            if (cached) return cached;
            const {toBlob} = await import('html-to-image');
            await document.fonts?.ready;
            if (cancelled) return;
            const height = element.scrollHeight;
            const image = await toBlob(element, {
                backgroundColor: '#ffffff',
                width: 1280,
                height,
                pixelRatio: Math.min(1.5, Math.sqrt(6_000_000 / (1280 * Math.max(height, 1)))),
                style: {position: 'static', left: 'auto', top: 'auto'},
                filter: (node) => !(node instanceof Element && node.hasAttribute('data-private-annual-leave')),
            });
            if (!image) throw new Error('Image unavailable');
            saveConversationImage(key, image);
            return image;
        })
            .then((image) => {
                if (!cancelled && image) {
                    setBlob(image);
                    setVersion(undefined);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setFailed(true);
                    setVersion(undefined);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [version, key]);

    useEffect(() => {
        if (!blob) return;
        const value = URL.createObjectURL(blob);
        setUrl(value);
        return () => URL.revokeObjectURL(value);
    }, [blob]);

    return (
        <div ref={host} className="my-3">
            {url ? (
                <>
                    <button
                        type="button"
                        onClick={() => {
                            setActualSize(false);
                            setOpen(true);
                        }}
                        className="block w-full overflow-hidden rounded-xl border border-gray-6 bg-white text-left focus-visible:outline-2 focus-visible:outline-main-1"
                        aria-label={copy('근무표 이미지 크게 보기', 'Enlarge schedule image')}
                    >
                        <img src={url} alt={title} decoding="async" className="max-h-64 w-full object-contain" />
                        <span className="block border-t border-gray-6 px-3 py-2 text-sm">{copy('눌러서 크게 보기', 'Tap to enlarge')}</span>
                    </button>
                    <Dialog.Root open={open} onOpenChange={setOpen}>
                        <Dialog.Portal>
                            <Dialog.Overlay className="fixed inset-0 z-[1500] bg-black/40" />
                            <Dialog.Content
                                className="fixed inset-0 z-[1501] flex flex-col bg-white p-4 outline-none"
                                onKeyDown={(event) => event.stopPropagation()}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                                    <div>
                                        <Dialog.Title className="font-semibold">{title}</Dialog.Title>
                                        <Dialog.Description className="text-sm text-gray-4">
                                            {copy(
                                                '이 결과를 만든 시점의 근무표예요.',
                                                'This image preserves the schedule at the time of this result.',
                                            )}
                                        </Dialog.Description>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            className="rounded-lg border px-3 py-2 text-sm"
                                            onClick={() => setActualSize(!actualSize)}
                                        >
                                            {actualSize ? copy('화면에 맞추기', 'Fit to screen') : copy('확대하기', 'Zoom in')}
                                        </button>
                                        <Dialog.Close className="rounded-lg border px-3 py-2 text-sm">
                                            {copy('이미지 닫기', 'Close image')}
                                        </Dialog.Close>
                                    </div>
                                </div>
                                <div className="min-h-0 flex-1 overflow-auto bg-gray-7 p-2">
                                    <img
                                        src={url}
                                        alt={title}
                                        className={actualSize ? 'max-w-none bg-white' : 'h-full w-full bg-white object-contain'}
                                        style={actualSize ? {width: 1280} : undefined}
                                    />
                                </div>
                            </Dialog.Content>
                        </Dialog.Portal>
                    </Dialog.Root>
                </>
            ) : (
                <div
                    className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-gray-6 bg-gray-7 p-4 text-sm"
                    role="status"
                >
                    {failed ? (
                        <>
                            <p>
                                {copy(
                                    '근무표 이미지를 불러오지 못했어요. 아래 ‘근무표 열기’로 확인해 주세요.',
                                    'The image could not be loaded. Use Open schedule below.',
                                )}
                            </p>
                            <button type="button" className="rounded border px-3 py-2" onClick={() => setAttempt((value) => value + 1)}>
                                {copy('이미지 다시 불러오기', 'Retry image')}
                            </button>
                        </>
                    ) : (
                        copy('근무표 이미지를 준비하고 있어요.', 'Preparing schedule image…')
                    )}
                </div>
            )}
            {snapshot &&
                createPortal(
                    <div aria-hidden="true" inert style={{position: 'fixed', left: -20000, top: 0, width: 1280, pointerEvents: 'none'}}>
                        <div ref={capture} style={{width: 1280, padding: 24, background: 'white'}}>
                            <p className="mb-3 text-xl font-semibold">
                                {version!.year}
                                {copy('년 ', ' / ')}
                                {version!.month}
                                {copy('월 근무표', ' schedule')}
                            </p>
                            <div className="[container-type:inline-size]">
                                <MakeShiftCalendar
                                    shift={snapshot.shift}
                                    doc={snapshot.doc}
                                    violationMap={violations}
                                    showFaults={false}
                                    readonly
                                    staticPreview
                                    borderlessPreview
                                    showCellStatusPins
                                    showDivisionHeaders
                                    showDivisionStatistics
                                    nurseNameMaxChars={10}
                                />
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
});
