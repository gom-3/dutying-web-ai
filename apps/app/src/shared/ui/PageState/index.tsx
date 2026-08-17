import {cn} from '@dutying/utils/style';
import {RotateCcw} from 'lucide-react';
import type {ButtonHTMLAttributes, ReactNode} from 'react';
import {BouncingDots} from '@/components/loading-ui/bouncing-dots';
import pageEmptyStateIcon from '@/shared/assets/images/page-empty-state.png';
import redWarnIcon from '@/shared/assets/images/red_warn.png';
import Button from '@/shared/ui/form-controls/Button';

type TPageStateTone = 'loading' | 'error' | 'empty';
type TPageStateLayout = 'screen' | 'panel' | 'inline';
export type TPageStateLoadingColor = 'purple' | 'white';

type TPageStateAction = {
    label: string;
    onClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
};

type TPageStateProps = {
    tone: TPageStateTone;
    title: ReactNode;
    description?: string;
    action?: TPageStateAction;
    layout?: TPageStateLayout;
    loadingColor?: TPageStateLoadingColor;
    className?: string;
    contentClassName?: string;
    titleClassName?: string;
    titlePlacement?: 'aboveIcon' | 'belowIcon';
    visual?: ReactNode;
    children?: ReactNode;
};

const containerClassName: Record<TPageStateLayout, string> = {
    screen: 'flex min-h-screen w-full items-center justify-center px-6 py-10',
    panel: 'flex min-h-[300px] w-full items-center justify-center px-4 py-4 sm:px-6 sm:py-10',
    inline: 'flex w-full items-center justify-center px-4 py-6',
};
const cardClassName: Record<TPageStateTone, string> = {
    loading: 'bg-white',
    error: '',
    empty: '',
};
const iconWrapperClassName: Record<Exclude<TPageStateTone, 'error'>, string> = {
    loading: 'bg-main-light text-main-1',
    empty: 'bg-white text-gray-4',
};

function PageStateIcon({tone}: {tone: TPageStateTone}) {
    if (tone === 'error') {
        return <img src={redWarnIcon} alt="" className="h-12 w-12 object-contain" aria-hidden="true" />;
    }

    return <img src={pageEmptyStateIcon} alt="" className="h-[53px] w-[53px] object-contain" aria-hidden="true" />;
}

const loadingColorClassName: Record<TPageStateLoadingColor, string> = {
    purple: 'text-[#8b5cf6]',
    white: 'text-white',
};

function PageState({
    tone,
    title,
    description,
    action,
    layout = 'panel',
    loadingColor = 'purple',
    className,
    contentClassName,
    titleClassName,
    titlePlacement = 'belowIcon',
    visual,
    children,
}: TPageStateProps) {
    const isLoading = tone === 'loading';
    const titleElement = (
        <h2
            className={cn(
                'font-apple text-[20px] leading-[1.45] font-semibold tracking-normal break-keep whitespace-pre-line text-sub-1',
                titlePlacement === 'aboveIcon' ? 'mb-10' : 'mt-4',
                titleClassName,
            )}
        >
            {title}
        </h2>
    );

    if (isLoading) {
        return (
            <div className={cn(containerClassName[layout], className)}>
                <div aria-live="polite" className="flex flex-col items-center justify-center text-center">
                    <BouncingDots className={cn('w-[36.3px]', loadingColorClassName[loadingColor])} />
                    {title ? (
                        <h2
                            className={cn(
                                'mt-4 font-apple text-[20px] leading-[1.45] font-semibold tracking-normal break-keep whitespace-pre-line text-sub-1',
                                titleClassName,
                            )}
                        >
                            {title}
                        </h2>
                    ) : null}
                    {description ? <p className="mt-2 font-apple text-[14px] leading-6 text-gray-3">{description}</p> : null}
                </div>
            </div>
        );
    }

    return (
        <div className={cn(containerClassName[layout], className)}>
            <div
                className={cn(
                    'w-full max-w-[28rem] rounded-[20px] px-4 py-6 text-center sm:px-6 sm:py-7',
                    cardClassName[tone],
                    contentClassName,
                )}
                role={tone === 'error' ? 'alert' : 'status'}
                aria-live={tone === 'error' ? 'assertive' : 'polite'}
            >
                {titlePlacement === 'aboveIcon' ? titleElement : null}

                {visual ? (
                    <div className="mx-auto flex justify-center">{visual}</div>
                ) : (
                    <div
                        className={cn(
                            'mx-auto flex size-[53px] items-center justify-center',
                            tone === 'error' ? null : cn('rounded-[16px]', iconWrapperClassName[tone]),
                        )}
                    >
                        <PageStateIcon tone={tone} />
                    </div>
                )}

                {titlePlacement === 'belowIcon' ? titleElement : null}
                {description ? <p className="mt-2 font-apple text-[14px] leading-6 text-gray-3">{description}</p> : null}

                {action ? (
                    <div className="mt-6 flex justify-center">
                        <Button
                            onClick={action.onClick}
                            type="button"
                            variant={tone === 'error' ? 'link' : 'default'}
                            size="md"
                            className={cn(
                                tone === 'error'
                                    ? 'h-auto cursor-pointer rounded-none px-0 font-semibold text-main-1 no-underline hover:bg-transparent hover:text-main-2 hover:no-underline'
                                    : 'h-11 cursor-pointer rounded-[14px] px-5 font-semibold',
                            )}
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
