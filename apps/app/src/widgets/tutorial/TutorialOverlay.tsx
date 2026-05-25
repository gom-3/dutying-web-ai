import {type MouseEvent, type PointerEvent, type TouchEvent, type UIEvent} from 'react';
import {type ITutorialConfig} from './tutorial.types';
import {TutorialInfoBox} from './TutorialInfoBox';
import {useTutorialOverlay} from './useTutorialOverlay';

interface ITutorialOverlayProps {
    config: ITutorialConfig;
    closeCallback: () => void;
    initialStepIndex?: number;
}

export const TutorialOverlay = ({config, closeCallback, initialStepIndex}: ITutorialOverlayProps) => {
    const {currentStep, infoBoxElement, nextStep, previousStep, rectStyles, stepIndex, totalSteps} = useTutorialOverlay({
        config,
        closeCallback,
        initialStepIndex,
    });
    const blockTutorialInteraction = (event: UIEvent | MouseEvent | PointerEvent | TouchEvent) => {
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <>
            <div
                aria-hidden="true"
                className="fixed inset-0 z-[997] cursor-default touch-none"
                onClick={blockTutorialInteraction}
                onMouseDown={blockTutorialInteraction}
                onPointerDown={blockTutorialInteraction}
                onTouchMove={blockTutorialInteraction}
                onWheel={blockTutorialInteraction}
            />
            <TutorialInfoBox
                currentStep={currentStep}
                infoBoxElement={infoBoxElement}
                onNext={nextStep}
                onPrevious={previousStep}
                stepIndex={stepIndex}
                totalSteps={totalSteps}
            />
            {rectStyles.map((style, index) => (
                <div
                    key={style.id}
                    id="HighlightedElement"
                    style={{
                        ...style,
                        boxShadow: index === 0 ? '0 0 0 9999px rgba(0, 0, 0, 0.76), 0 18px 44px rgba(0, 0, 0, 0.28)' : undefined,
                    }}
                    className="pointer-events-none fixed z-[998] box-content rounded-[1rem] transition-[top,left,width,height] duration-200 ease-out"
                />
            ))}
        </>
    );
};
