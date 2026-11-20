import {useRef, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';
import styles from './steps/shift-type-step.module.css';

export function ShiftTypeErrorHelp({id, shiftName, message}: {id: string; shiftName: string; message: string}) {
    const {t} = useTypedTranslation();
    const [open, setOpen] = useState(false);
    const openBeforeTouch = useRef<boolean | null>(null);
    const sentenceBoundary = message.search(/[.!?](?=\s)|[。！？]/u);
    const paragraphs =
        sentenceBoundary < 0
            ? [message]
            : [message.slice(0, sentenceBoundary + 1), message.slice(sentenceBoundary + 1).trim()].filter(Boolean);

    return (
        <>
            <span id={id} className="sr-only">
                {message}
            </span>
            <TooltipProvider delayDuration={120}>
                <Tooltip open={open} onOpenChange={setOpen}>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            aria-label={t('page.onboardingWardCreate.shiftType.validation.errorDetailsAria', {shiftName})}
                            aria-describedby={id}
                            aria-expanded={open}
                            onPointerDown={(event) => {
                                openBeforeTouch.current = event.pointerType === 'touch' ? open : null;
                            }}
                            onPointerCancel={() => {
                                openBeforeTouch.current = null;
                            }}
                            onKeyDown={() => {
                                openBeforeTouch.current = null;
                            }}
                            onClick={(event) => {
                                event.preventDefault();
                                // Touch focus can open the tooltip before click is delivered.
                                setOpen(openBeforeTouch.current == null || !openBeforeTouch.current);
                                openBeforeTouch.current = null;
                            }}
                            className={styles.errorHelp}
                        >
                            <span aria-hidden="true" className={styles.errorGlyph}>
                                !
                            </span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent
                        side="top"
                        align="end"
                        sideOffset={6}
                        collisionPadding={12}
                        className={`z-[1400] w-max max-w-[min(24rem,calc(100vw-24px))] rounded-lg bg-[#252B36] px-3 py-3 text-left font-apple text-[13px] leading-[1.6] whitespace-normal text-white shadow-none motion-reduce:animate-none ${styles.hintContent}`}
                    >
                        <div className="space-y-1.5">
                            {paragraphs.map((paragraph, index) => (
                                <p key={index} className="[overflow-wrap:anywhere] break-keep">
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </>
    );
}
