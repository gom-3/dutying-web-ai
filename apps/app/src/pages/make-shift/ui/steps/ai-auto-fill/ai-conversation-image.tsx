import {ZoomIn} from 'lucide-react';
import {memo, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {TShift} from '@/entities/shift';
import type {TDutyDoc} from '@/features/shift-editor/model/types';
import i18n from '@/i18n';
import {queueConversationCapture, readConversationImage, saveConversationImage} from '../../../model/conversation-image-cache';
import {buildConversationSnapshot} from '../../../model/conversation-snapshot';
import type {TResultVersion} from '../../../model/schedule-conversation-api';
import {MakeShiftCalendar} from '../shared/make-shift-calendar';
import {AiConversationLoading} from './ai-conversation-loading';

type TImageSource =
    | {snapshot: {doc: TDutyDoc; shift: TShift}; loadVersion?: never}
    | {snapshot?: never; loadVersion: (id: string) => Promise<TResultVersion>};
type TProps = TImageSource & {
    cacheKey: string;
    versionId: string;
    onOpen: (trigger: HTMLButtonElement) => void;
    disabled?: boolean;
};

export const AiConversationImage = memo(function AiConversationImage(props: TProps) {
    return <AiConversationImageSource key={`${props.cacheKey}:${props.versionId}:${i18n.language}`} {...props} />;
});

function AiConversationImageSource({cacheKey, versionId, loadVersion, snapshot: capturedSnapshot, onOpen, disabled = false}: TProps) {
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
    const snapshot = useMemo(() => capturedSnapshot ?? (version ? buildConversationSnapshot(version) : null), [capturedSnapshot, version]);
    const [year, month] = snapshot?.doc.columns[0]?.split('-').map(Number) ?? [];
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

        if (capturedSnapshot) return;

        loadVersion?.(versionId)
            .then((value) => {
                if (!cancelled) setVersion(value);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });

        return () => {
            cancelled = true;
        };
    }, [visible, key, versionId, loadVersion, capturedSnapshot, attempt]);

    useEffect(() => {
        if (!visible || !snapshot || !capture.current || readConversationImage(key)) return;

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
    }, [visible, snapshot, key, attempt]);

    useEffect(() => {
        if (!blob) return;

        const value = URL.createObjectURL(blob);

        setUrl(value);

        return () => URL.revokeObjectURL(value);
    }, [blob]);

    return (
        <div ref={host} className="my-3 min-w-0">
            <button
                type="button"
                disabled={disabled}
                onClick={(event) => onOpen(event.currentTarget)}
                className="group block min-h-11 w-full overflow-hidden rounded-xl bg-white p-2 text-left transition-colors hover:bg-[#F2EFFF] focus-visible:bg-[#E9E1FF] focus-visible:text-[#5931B9] focus-visible:outline-none disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
                aria-label={copy('근무표 살펴보기', 'Explore schedule')}
                title={copy('근무표 크게 보기', 'Enlarge schedule')}
            >
                <div className="relative flex min-h-32 items-center justify-center overflow-hidden rounded-lg bg-[#F7F8FA]">
                    {url ? (
                        <img src={url} alt={title} decoding="async" className="max-h-56 w-full object-contain" />
                    ) : failed ? (
                        <span className="px-12 py-8 text-center text-[13px] leading-5 text-[#667085]" role="status">
                            {copy('미리보기 없이도 근무표를 살펴볼 수 있어요.', 'You can explore the schedule without a preview.')}
                        </span>
                    ) : (
                        <AiConversationLoading
                            label={copy('미리보기 준비 중', 'Preparing preview')}
                            className="justify-center px-12 py-8"
                        />
                    )}
                    <span
                        aria-hidden="true"
                        className="absolute top-2 right-2 grid size-10 place-items-center rounded-[10px] bg-[#F0EBFF] text-[#5931B9] transition-colors group-hover:bg-main-1 group-hover:text-white group-focus-visible:bg-main-1 group-focus-visible:text-white motion-reduce:transition-none"
                    >
                        <ZoomIn className="size-5" />
                    </span>
                </div>
            </button>
            {failed && (
                <button
                    type="button"
                    disabled={disabled}
                    className="mt-1 min-h-11 rounded-lg px-3 text-xs font-medium text-[#667085] hover:bg-[#E9E1FF] hover:text-[#5931B9] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
                    onClick={() => setAttempt((value) => value + 1)}
                >
                    {copy('미리보기 다시 불러오기', 'Retry preview')}
                </button>
            )}
            {visible &&
                snapshot &&
                !blob &&
                createPortal(
                    <div aria-hidden="true" inert style={{position: 'fixed', left: -20000, top: 0, width: 1280, pointerEvents: 'none'}}>
                        <div ref={capture} style={{width: 1280, padding: 24, background: 'white'}}>
                            <p className="mb-3 text-xl font-semibold">
                                {year}
                                {copy('년 ', ' / ')}
                                {month}
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
}
