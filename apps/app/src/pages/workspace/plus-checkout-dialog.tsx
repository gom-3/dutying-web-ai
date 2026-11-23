import * as Dialog from '@radix-ui/react-dialog';
import type {ReactNode} from 'react';
import {useCopy} from './workspace-ui';

export function PlusCheckoutInfoDialog({
    label,
    description,
    children,
    consentItem = false,
}: {
    label: string;
    description: string;
    children: ReactNode;
    consentItem?: boolean;
}) {
    const t = useCopy();
    const portalContainer = typeof document === 'undefined' ? undefined : (document.getElementById('modal-root') ?? document.body);

    return (
        <Dialog.Root>
            <Dialog.Trigger asChild>
                <button
                    type="button"
                    className={consentItem ? 'plus-checkout-policy-row plus-checkout-policy-row--consent' : 'plus-checkout-policy-row'}
                >
                    {consentItem ? (
                        <svg className="plus-checkout-policy-check" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="m9.2 17.4-5-5 1.8-1.8 3.2 3.2 8-8 1.8 1.8z" />
                        </svg>
                    ) : null}
                    <span>{label}</span>
                    {!consentItem ? (
                        <svg className="plus-checkout-policy-chevron" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="m8.6 4-1.4 1.4 6.6 6.6-6.6 6.6L8.6 20l8-8-8-8Z" />
                        </svg>
                    ) : null}
                </button>
            </Dialog.Trigger>
            <Dialog.Portal container={portalContainer}>
                <Dialog.Overlay className="plus-checkout-modal-backdrop" />
                <Dialog.Content className="plus-checkout-modal">
                    <header className="plus-checkout-modal__header">
                        <div>
                            <Dialog.Title className="plus-checkout-modal__title">{label}</Dialog.Title>
                            <Dialog.Description className="plus-checkout-modal__description">{description}</Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <button type="button" className="plus-checkout-modal__close" aria-label={t('팝업 닫기', 'Close dialog')}>
                                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
                                </svg>
                            </button>
                        </Dialog.Close>
                    </header>
                    <div className="plus-checkout-modal__body" tabIndex={0} role="region" aria-label={label}>
                        {children}
                    </div>
                    <footer className="plus-checkout-modal__footer">
                        <Dialog.Close asChild>
                            <button type="button" className="plus-checkout-modal__done">
                                {t('닫기', 'Close')}
                            </button>
                        </Dialog.Close>
                    </footer>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
