import {Inbox, RotateCcw, TriangleAlert} from 'lucide-react';
import type {ButtonHTMLAttributes, ReactNode} from 'react';
import Button from '@/shared/ui/Button';
import {cn} from '@/shared/util/style';

type TPageStateTone = 'loading' | 'error' | 'empty';
type TPageStateLayout = 'screen' | 'panel' | 'inline';

type TPageStateAction = {
    label: string;
    onClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
};

type TPageStateProps = {
    tone: TPageStateTone;
    title: string;
    description?: string;
    action?: TPageStateAction;
    layout?: TPageStateLayout;
    className?: string;
    children?: ReactNode;
};

const containerClassName: Record<TPageStateLayout, string> = {
    screen: 'flex min-h-screen w-full items-center justify-center px-6 py-10',
    panel: 'flex h-full min-h-[300px] w-full items-center justify-center px-6 py-10',
    inline: 'flex w-full items-center justify-center px-4 py-6',
};
const cardClassName: Record<TPageStateTone, string> = {
    loading: 'border-main-3/40 bg-white/95',
    error: 'border-red/20 bg-white/95',
    empty: 'border-gray-6 bg-gray-7/70',
};
const iconWrapperClassName: Record<TPageStateTone, string> = {
    loading: 'bg-main-light text-main-1',
    error: 'bg-[#FFE7EA] text-red',
    empty: 'bg-white text-sub-3',
};

function PageStateIcon({tone}: {tone: TPageStateTone}) {
    if (tone === 'loading') {
        return <div className="size-[42px] animate-spin rounded-full border-[3px] border-main-2/25 border-t-main-1" aria-label="loading" />;
    }

    if (tone === 'error') {
        return <TriangleAlert className="size-8" strokeWidth={2.2} aria-hidden="true" />;
    }

    return <Inbox className="size-8" strokeWidth={2.2} aria-hidden="true" />;
}

function PageState({tone, title, description, action, layout = 'panel', className, children}: TPageStateProps) {
    const isLoading = tone === 'loading';

    return (
        <div className={cn(containerClassName[layout], className)}>
            <div
                className={cn(
                    'w-full max-w-[34rem] rounded-[28px] border px-8 py-9 text-center shadow-[0_20px_60px_rgba(18,23,38,0.06)]',
                    cardClassName[tone],
                )}
                role={tone === 'error' ? 'alert' : 'status'}
                aria-live={tone === 'error' ? 'assertive' : 'polite'}
            >
                <div className={cn('mx-auto flex size-[4.5rem] items-center justify-center rounded-[22px]', iconWrapperClassName[tone])}>
                    <PageStateIcon tone={tone} />
                </div>

                <h2 className="mt-5 font-apple text-[1.75rem] font-semibold tracking-[-0.02em] text-sub-1">{title}</h2>
                {description ? <p className="mt-3 font-apple text-base leading-7 text-gray-3">{description}</p> : null}

                {action ? (
                    <div className="mt-6 flex justify-center">
                        <Button
                            onClick={action.onClick}
                            type="button"
                            size="md"
                            className="rounded-[14px] px-5 font-semibold"
                            disabled={isLoading}
                        >
                            <RotateCcw className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
                            {action.label}
                        </Button>
                    </div>
                ) : null}

                {children ? <div className="mt-5">{children}</div> : null}
            </div>
        </div>
    );
}

export default PageState;
