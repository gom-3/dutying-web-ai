import {useQueryClient} from '@tanstack/react-query';
import {cloneElement, isValidElement, useId, useRef, useState, type ReactElement, type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {commercialError} from '@/features/commercial/api';
import {InfoTip} from './info-tip';

export const useCopy = () => {
    const {i18n} = useTranslation();

    return (ko: string, en: string) => (i18n.language.startsWith('ko') ? ko : en);
};

export function Section({
    title,
    children,
    help,
    actions,
    className = '',
}: {
    title: string;
    children: ReactNode;
    help?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <section className={`workspace-section ${className}`}>
            <div className="workspace-section-heading">
                <div className="workspace-heading-label">
                    <h2>{title}</h2>
                    {help ? <InfoTip label={`${title} 도움말`}>{help}</InfoTip> : null}
                </div>
                {actions}
            </div>
            {children}
        </section>
    );
}

export function Field({label, children, help}: {label: string; children: ReactNode; help?: ReactNode}) {
    const generatedId = useId();
    const control = isValidElement<{id?: string}>(children) ? children : undefined;
    const id = control?.props.id ?? generatedId;

    return (
        <div className="workspace-field">
            <div className="workspace-field-label">
                <label htmlFor={id}>{label}</label>
                {help ? <InfoTip label={`${label} 도움말`}>{help}</InfoTip> : null}
            </div>
            {control ? cloneElement(control as ReactElement<{id?: string}>, {id}) : children}
        </div>
    );
}

export function Notice({children}: {children: ReactNode}) {
    return <p className="workspace-notice">{children}</p>;
}

export function ErrorView({error}: {error: unknown}) {
    return error ? (
        <p className="workspace-error" role="alert">
            {commercialError(error)}
        </p>
    ) : null;
}

export function useAction() {
    const client = useQueryClient();
    const [busy, setBusy] = useState(false);
    const submitting = useRef(false);
    const [error, setError] = useState<unknown>(null);
    const [notice, setNotice] = useState('');
    const keys = useRef(new Map<string, string>());
    const keyFor = (path: string, data: unknown) => {
        const id = path + JSON.stringify(data);

        if (!keys.current.has(id)) keys.current.set(id, crypto.randomUUID());

        return keys.current.get(id)!;
    };
    const run = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
        if (submitting.current) return;

        submitting.current = true;
        setBusy(true);
        setError(null);
        setNotice('');

        try {
            const result = await action();

            await client.invalidateQueries({queryKey: ['commercial']});

            return result;
        } catch (cause) {
            setError(cause);

            return undefined;
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    };

    return {busy, error, notice, setNotice, run, keyFor};
}

export type TWorkspaceAction = ReturnType<typeof useAction>;

export function ActionsFeedback({action}: {action: TWorkspaceAction}) {
    return (
        <>
            <ErrorView error={action.error} />
            {action.notice ? (
                <p className="workspace-feedback" role="status">
                    {action.notice}
                </p>
            ) : null}
        </>
    );
}
