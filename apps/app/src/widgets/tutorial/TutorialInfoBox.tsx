import {type RefObject} from 'react';
import {twMerge} from 'tailwind-merge';
import {type ITutorialStepConfig} from './tutorial.types';

type TTutorialInfoBoxProps = {
    currentStep?: ITutorialStepConfig;
    infoBoxElement: RefObject<HTMLDivElement | null>;
    onNext: () => void;
    onPrevious: () => void;
    stepIndex: number;
    totalSteps: number;
};

const secondaryButtonClassName =
    'inline-flex h-10 min-w-16 items-center justify-center rounded-xl bg-[#F2F4F6] px-4 text-[.9375rem] font-semibold text-[#4E5968] transition-colors hover:enabled:bg-[#E5E8EB] disabled:bg-transparent disabled:text-[#B0B8C1]';
const primaryButtonClassName =
    'inline-flex h-10 min-w-16 items-center justify-center rounded-xl bg-[#3182F6] px-4 text-[.9375rem] font-semibold text-white transition-colors hover:bg-[#1B64DA]';

export function TutorialInfoBox({currentStep, infoBoxElement, onNext, onPrevious, stepIndex, totalSteps}: TTutorialInfoBoxProps) {
    const isLastStep = stepIndex === totalSteps - 1;

    return (
        <div
            id="InfoBox"
            className="group/infobox fixed top-25 z-[1000] flex w-[24rem] max-w-[calc(100vw-2rem)] flex-col overflow-visible rounded-[1.25rem] bg-white px-5 py-4 font-apple shadow-[0_18px_48px_rgba(0,0,0,0.2)]"
            ref={infoBoxElement}
        >
            <span
                aria-hidden="true"
                className="pointer-events-none absolute left-[var(--tutorial-arrow-left,50%)] size-4 -translate-x-1/2 rotate-45 rounded-[.1875rem] bg-white group-data-[placement=bottom]/infobox:-top-1.5 group-data-[placement=left]/infobox:top-[var(--tutorial-arrow-top,50%)] group-data-[placement=left]/infobox:right-[-0.375rem] group-data-[placement=left]/infobox:left-auto group-data-[placement=left]/infobox:translate-x-0 group-data-[placement=left]/infobox:-translate-y-1/2 group-data-[placement=right]/infobox:top-[var(--tutorial-arrow-top,50%)] group-data-[placement=right]/infobox:left-[-0.375rem] group-data-[placement=right]/infobox:translate-x-0 group-data-[placement=right]/infobox:-translate-y-1/2 group-data-[placement=top]/infobox:-bottom-1.5"
            />
            <div className="flex flex-1 flex-col">
                <div id="InfoTitle" className="flex items-start">
                    <p className="min-w-0 text-[1.125rem] leading-7 font-bold [text-wrap:pretty] [overflow-wrap:break-word] break-keep text-[#191F28]">
                        {currentStep?.title}
                    </p>
                </div>
                <div id="InfoContent" className="mt-3 scrollbar-hide max-h-36 overflow-y-auto">
                    {currentStep?.info?.split('\n').map((line, index) => (
                        <p
                            key={index}
                            className="text-[.9375rem] leading-6 font-medium [text-wrap:pretty] [overflow-wrap:break-word] break-keep text-[#4E5968]"
                        >
                            {line}
                        </p>
                    ))}
                </div>
            </div>
            <div id="BoxFooter" className="mt-4 flex min-w-0 justify-end">
                <div id="ButtonWrapper" className="flex max-w-full flex-wrap items-center justify-end gap-2">
                    {currentStep?.ctaUrl && currentStep?.ctaText ? (
                        <a
                            className="inline-flex h-10 min-w-0 items-center justify-center rounded-xl bg-[#F2F8FF] px-3 text-[.9375rem] font-semibold whitespace-nowrap text-[#3182F6] transition-colors hover:bg-[#E8F3FF]"
                            href={currentStep.ctaUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {currentStep.ctaText}
                        </a>
                    ) : null}
                    <button className={secondaryButtonClassName} onClick={onPrevious} disabled={stepIndex === 0}>
                        이전
                    </button>
                    <button className={twMerge(primaryButtonClassName, isLastStep && 'min-w-[4.5rem]')} onClick={onNext}>
                        {isLastStep ? '완료' : '다음'}
                    </button>
                </div>
            </div>
        </div>
    );
}
