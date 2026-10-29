import * as Tooltip from '@radix-ui/react-tooltip';
import {type ReactNode, useRef, useState} from 'react';
import './info-tip.css';

/** Short, optional help. Keep essential instructions in the page itself. */
export function InfoTip({label, children}: {label: string; children: ReactNode}) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [pinned, setPinned] = useState(false);
    const [transient, setTransient] = useState(false);
    const open = pinned || transient;
    const close = () => {
        setPinned(false);
        setTransient(false);
    };

    return (
        <Tooltip.Provider delayDuration={150}>
            <Tooltip.Root
                open={open}
                onOpenChange={(next) => {
                    if (!pinned) setTransient(next);
                }}
            >
                <Tooltip.Trigger asChild>
                    <button
                        type="button"
                        ref={triggerRef}
                        className="hospital-info-tip"
                        aria-label={label}
                        aria-expanded={open}
                        onClick={() => {
                            setPinned((previous) => !previous);
                            setTransient(false);
                        }}
                        onBlur={close}
                    >
                        <span className="hospital-info-tip__icon" aria-hidden="true">
                            i
                        </span>
                    </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content
                        className="hospital-info-tip__content"
                        side="top"
                        sideOffset={6}
                        collisionPadding={16}
                        onEscapeKeyDown={close}
                        onPointerDownOutside={(event) => {
                            const target = event.detail.originalEvent.target;

                            if (target instanceof Node && triggerRef.current?.contains(target)) {
                                event.preventDefault();

                                return;
                            }

                            close();
                        }}
                    >
                        {children}
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
    );
}
