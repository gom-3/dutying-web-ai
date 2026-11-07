import * as Dialog from '@radix-ui/react-dialog';
import {GripHorizontal} from 'lucide-react';
import {useEffect, useRef, useState, type KeyboardEvent, type ReactNode} from 'react';
import Draggable, {type ControlPosition} from 'react-draggable';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

const arrowMoves: Partial<Record<string, ControlPosition>> = {
    ArrowLeft: {x: -24, y: 0},
    ArrowRight: {x: 24, y: 0},
    ArrowUp: {x: 0, y: -24},
    ArrowDown: {x: 0, y: 24},
};

function keepDetailsInView(position: ControlPosition, dialog: HTMLDivElement) {
    const frame = dialog.parentElement;

    if (!frame) return position;

    const {offsetLeft, offsetTop, offsetWidth, offsetHeight} = dialog;
    const x = Math.max(-offsetLeft, Math.min(position.x, frame.clientWidth - offsetLeft - offsetWidth));
    const y = Math.max(-offsetTop, Math.min(position.y, frame.clientHeight - offsetTop - offsetHeight));

    return x === position.x && y === position.y ? position : {x, y};
}

export function AiScheduleResultDetailsDialog({
    title,
    description,
    dismissDetails,
    children,
    actions,
}: {
    title: string;
    description: string;
    dismissDetails: boolean;
    children: ReactNode;
    actions?: ReactNode;
}) {
    const {t} = useTypedTranslation();
    const dialogRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<ControlPosition>({x: 0, y: 0});

    useEffect(() => {
        const dialog = dialogRef.current;
        const frame = dialog?.parentElement;

        if (!dialog || !frame) return;

        const fit = () => setPosition((current) => keepDetailsInView(current, dialog));
        const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(fit);

        observer?.observe(dialog);
        observer?.observe(frame);
        window.addEventListener('resize', fit);

        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', fit);
        };
    }, []);

    const moveWithKeyboard = (event: KeyboardEvent<HTMLElement>) => {
        const dialog = dialogRef.current;
        const move = arrowMoves[event.key];

        if (event.target !== event.currentTarget || !dialog || !move) return;

        event.preventDefault();
        setPosition(({x, y}) => keepDetailsInView({x: x + move.x, y: y + move.y}, dialog));
    };

    return (
        <Draggable
            nodeRef={dialogRef}
            bounds="parent"
            handle="[data-schedule-details-drag-handle]"
            cancel="button"
            enableUserSelectHack={false}
            position={position}
            onDrag={(_, {x, y}) => setPosition({x, y})}
        >
            <Dialog.Content
                ref={dialogRef}
                className="pointer-events-auto relative flex max-h-[min(600px,100%)] w-full max-w-[560px] flex-col overflow-hidden rounded-[20px] bg-white font-apple text-sub-1 focus:outline-none"
                onKeyDown={(event) => event.stopPropagation()}
                onPaste={(event) => event.stopPropagation()}
                onCloseAutoFocus={dismissDetails ? (event) => event.preventDefault() : undefined}
            >
                <header
                    data-schedule-details-drag-handle
                    role="group"
                    tabIndex={0}
                    aria-label={t('aiAutofillUi.conversationResult.moveDetails')}
                    aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
                    onKeyDown={moveWithKeyboard}
                    className="forced-colors:focus-visible:outline-auto relative flex shrink-0 cursor-grab touch-none items-start justify-between gap-3 px-5 pt-5 pb-3 select-none focus-visible:bg-main-light focus-visible:text-[#4524A8] focus-visible:outline-none active:cursor-grabbing sm:px-6"
                >
                    <GripHorizontal
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1 left-1/2 size-4 -translate-x-1/2 text-[#7A8495]"
                    />
                    <div className="min-w-0">
                        <Dialog.Title className="text-[20px] leading-7 font-semibold break-keep">{title}</Dialog.Title>
                        <Dialog.Description className="mt-1 text-[13px] leading-5 text-[#667085]">{description}</Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                        <button
                            type="button"
                            aria-label={t('aiAdjust.snapshot.close')}
                            className="forced-colors:focus-visible:outline-auto -mt-2 -mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#667085] transition-colors hover:text-sub-1 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none motion-reduce:transition-none"
                        >
                            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                                <path d="m5.4 4 4.6 4.6L14.6 4 16 5.4 11.4 10l4.6 4.6-1.4 1.4-4.6-4.6L5.4 16 4 14.6 8.6 10 4 5.4 5.4 4Z" />
                            </svg>
                        </button>
                    </Dialog.Close>
                </header>
                <div className="navigation-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3 sm:px-6">{children}</div>
                {actions && <footer className="shrink-0 px-5 pt-3 pb-5 sm:px-6">{actions}</footer>}
            </Dialog.Content>
        </Draggable>
    );
}
