import {useCallback, useEffect, useRef, useState} from 'react';
import {
    type ITutorialConfig,
    type ITutorialHighlightRect,
    type ITutorialStepConfig,
    type TTutorialInfoBoxAlignment,
} from './tutorial.types';

type TUseTutorialOverlayOptions = {
    config: ITutorialConfig;
    closeCallback: () => void;
    initialStepIndex?: number;
};

type THighlightedElement = {
    id: string;
    element: HTMLElement;
    originalInert: boolean;
    originalIsolation: string;
    originalPointerEvents: string;
    originalPosition: string;
    originalZIndex: string;
};
type TInfoBoxPlacement = 'top' | 'bottom' | 'left' | 'right';

const VIEWPORT_MARGIN = 10;
const TUTORIAL_FOREGROUND_Z_INDEX = '1003';
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function getCurrentStep(config: ITutorialConfig, stepIndex: number): ITutorialStepConfig | undefined {
    return config.steps[stepIndex];
}

function normalizeStepIndex(config: ITutorialConfig, stepIndex?: number) {
    if (stepIndex == null) return 0;

    return Math.min(Math.max(stepIndex, 0), Math.max(config.steps.length - 1, 0));
}

export function useTutorialOverlay({config, closeCallback, initialStepIndex}: TUseTutorialOverlayOptions) {
    const normalizedInitialStepIndex = normalizeStepIndex(config, initialStepIndex);
    const [rectStyles, setRectStyles] = useState<ITutorialHighlightRect[]>([]);
    const [stepIndex, setStepIndex] = useState(normalizedInitialStepIndex);
    const stepIndexRef = useRef(normalizedInitialStepIndex);
    const infoBoxElement = useRef<HTMLDivElement>(null);
    const currentElements = useRef<THighlightedElement[]>([]);
    const resizeTimeoutRef = useRef<number | null>(null);
    const currentStep = getCurrentStep(config, stepIndex);
    const totalSteps = config.steps.length;

    useEffect(() => {
        const nextStepIndex = normalizeStepIndex(config, initialStepIndex);

        setStepIndex(nextStepIndex);
        stepIndexRef.current = nextStepIndex;
    }, [config, initialStepIndex]);

    const resetHighlightedElements = useCallback(() => {
        currentElements.current.forEach(
            ({element, originalInert, originalIsolation, originalPointerEvents, originalPosition, originalZIndex}) => {
                element.classList.remove('foreground');
                element.inert = originalInert;
                element.style.isolation = originalIsolation;
                element.style.pointerEvents = originalPointerEvents;
                element.style.position = originalPosition;
                element.style.zIndex = originalZIndex;
            },
        );
        currentElements.current = [];
    }, []);
    const calculateInfoBoxPosition = useCallback(
        (position: ITutorialHighlightRect, alignment?: TTutorialInfoBoxAlignment) => {
            const configuredBoxHeight = config.infoBoxHeight ?? 160;
            const margin = config.infoBoxMargin ?? 30;
            const infoBox = infoBoxElement.current;

            if (!infoBox) return;

            infoBox.style.minHeight = `${configuredBoxHeight}px`;
            infoBox.style.height = 'auto';

            const boxHeight = Math.max(configuredBoxHeight, infoBox.offsetHeight || configuredBoxHeight);
            const boxWidth = infoBox.clientWidth || 336;
            const halfWidth = boxWidth / 2;
            const viewport = {
                left: VIEWPORT_MARGIN,
                right: window.innerWidth - VIEWPORT_MARGIN,
                top: VIEWPORT_MARGIN,
                bottom: window.innerHeight - VIEWPORT_MARGIN,
            };
            const viewportMaxLeft = Math.max(viewport.left, viewport.right - boxWidth);
            const viewportMaxTop = Math.max(viewport.top, viewport.bottom - boxHeight);
            const topPlacementTop = position.top - boxHeight - margin;
            const bottomPlacementTop = position.top + position.height + margin;
            const hasTopRoom = topPlacementTop >= viewport.top;
            const hasBottomRoom = bottomPlacementTop + boxHeight <= viewport.bottom;
            const isTallHighlight = position.height >= window.innerHeight * 0.42;
            const bottomWouldBeLow = bottomPlacementTop > viewport.top + window.innerHeight * 0.62;
            const rightPlacementLeft = position.left + position.width + margin;
            const leftPlacementLeft = position.left - boxWidth - margin;
            const canPlaceRight = rightPlacementLeft + boxWidth <= viewport.right;
            const canPlaceLeft = leftPlacementLeft >= viewport.left;
            const chooseSidePlacement = (): TInfoBoxPlacement | null => {
                if (!canPlaceRight && !canPlaceLeft) return null;

                if (canPlaceRight && !canPlaceLeft) return 'right';

                if (canPlaceLeft && !canPlaceRight) return 'left';

                const highlightCenter = position.left + position.width / 2;
                const viewportCenter = window.innerWidth / 2;

                return highlightCenter < viewportCenter ? 'right' : 'left';
            };
            const sidePlacement = chooseSidePlacement();
            const shouldPreferSide = Boolean(sidePlacement && !hasTopRoom && (isTallHighlight || bottomWouldBeLow || !hasBottomRoom));

            let nextTop = topPlacementTop;
            let nextLeft: number;
            let actualBoxLeft: number;
            let placement: TInfoBoxPlacement = 'top';

            if (shouldPreferSide && sidePlacement) {
                placement = sidePlacement;
            } else if (hasTopRoom) {
                placement = 'top';
            } else if (hasBottomRoom) {
                placement = 'bottom';
            } else if (sidePlacement) {
                placement = sidePlacement;
            } else {
                placement = topPlacementTop >= viewport.top ? 'top' : 'bottom';
            }

            if (placement === 'left' || placement === 'right') {
                nextTop = clamp(position.top + position.height / 2 - boxHeight / 2, viewport.top, viewportMaxTop);
                actualBoxLeft = placement === 'right' ? rightPlacementLeft : leftPlacementLeft;
                nextLeft = actualBoxLeft;

                const arrowTop = clamp(position.top + position.height / 2 - nextTop, 24, boxHeight - 24);

                infoBox.style.setProperty('--tutorial-arrow-top', `${arrowTop}px`);
            } else {
                nextTop = placement === 'top' ? topPlacementTop : bottomPlacementTop;

                if (!hasTopRoom && !hasBottomRoom) {
                    nextTop = clamp(nextTop, viewport.top, viewportMaxTop);
                }

                if (alignment === 'left') {
                    nextLeft = position.left < viewport.left ? viewport.left : position.left;
                    actualBoxLeft = nextLeft;
                } else if (alignment === 'right') {
                    nextLeft = position.left + position.width - boxWidth;
                    actualBoxLeft = nextLeft;
                } else {
                    nextLeft = position.left + position.width / 2;
                    nextLeft = nextLeft - halfWidth < viewport.left ? viewport.left + halfWidth : nextLeft;
                    actualBoxLeft = nextLeft - halfWidth;
                }

                actualBoxLeft = clamp(actualBoxLeft, viewport.left, viewportMaxLeft);
                nextLeft = alignment === 'center' ? actualBoxLeft + halfWidth : actualBoxLeft;

                const arrowLeft = clamp(position.left + position.width / 2 - actualBoxLeft, 24, boxWidth - 24);

                infoBox.style.setProperty('--tutorial-arrow-left', `${arrowLeft}px`);
                infoBox.style.removeProperty('--tutorial-arrow-top');
            }

            infoBox.style.top = `${nextTop}px`;
            infoBox.style.left = `${nextLeft}px`;
            infoBox.style.transform =
                placement === 'top' || placement === 'bottom' ? (alignment === 'center' ? 'translate(-50%)' : '') : '';
            infoBox.dataset.placement = placement;

            const infoContentElement = infoBox.children[0]?.lastChild as HTMLElement | null;

            if (infoContentElement) {
                infoContentElement.style.height = '';
            }

            if (!config.scrollLock) {
                infoBox.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest',
                });
            }
        },
        [config.infoBoxHeight, config.infoBoxMargin, config.scrollLock],
    );
    const setHighlightedElementPositions = useCallback(() => {
        const step = getCurrentStep(config, stepIndexRef.current);
        const highlightIds = step?.highlightIds;

        if (!highlightIds || highlightIds.length === 0) {
            setRectStyles([]);

            return;
        }

        const positions: ITutorialHighlightRect[] = [];
        const highlightedElements: THighlightedElement[] = [];
        const alreadyCalculated = highlightIds[0] === currentElements.current[0]?.id;

        if (!alreadyCalculated) {
            resetHighlightedElements();
        }

        highlightIds.forEach((id, index) => {
            const element = document.getElementById(id);

            if (!element) {
                console.error(`Highlighted element with id ${id} was not found.`);

                return;
            }

            if (!alreadyCalculated) {
                const {position: computedPosition} = window.getComputedStyle(element);

                highlightedElements.push({
                    id,
                    element,
                    originalInert: element.inert,
                    originalIsolation: element.style.isolation,
                    originalPointerEvents: element.style.pointerEvents,
                    originalPosition: element.style.position,
                    originalZIndex: element.style.zIndex,
                });
                element.classList.add('foreground');
                element.inert = true;
                element.style.isolation = 'isolate';
                element.style.pointerEvents = 'none';
                element.style.zIndex = TUTORIAL_FOREGROUND_Z_INDEX;

                if (computedPosition === 'static') {
                    element.style.position = 'relative';
                }
            }

            const rect = element.getBoundingClientRect();
            const padding = config.highLightPadding ?? 8;
            const position: ITutorialHighlightRect = {
                id,
                left: rect.left - padding,
                top: rect.top - padding,
                width: rect.width + padding * 2,
                height: rect.height + padding * 2,
            };

            positions.push(position);

            if (index === 0) {
                calculateInfoBoxPosition(position, step?.infoBoxAlignment);
            }
        });

        if (!alreadyCalculated) {
            currentElements.current = highlightedElements;
        }

        setRectStyles(positions);
    }, [calculateInfoBoxPosition, config, resetHighlightedElements]);
    const previousStep = useCallback(() => {
        if (stepIndex === 0) return;

        currentStep?.onPrevStep?.();
        setStepIndex((prev) => prev - 1);
    }, [currentStep, stepIndex]);
    const nextStep = useCallback(() => {
        currentStep?.onNextStep?.();

        if (stepIndex === totalSteps - 1) {
            setStepIndex(normalizedInitialStepIndex);
            closeCallback();

            return;
        }

        setStepIndex((prev) => prev + 1);
    }, [closeCallback, currentStep, normalizedInitialStepIndex, stepIndex, totalSteps]);

    useEffect(() => {
        stepIndexRef.current = stepIndex;
        setHighlightedElementPositions();
    }, [setHighlightedElementPositions, stepIndex]);

    useEffect(() => {
        const previousBodyOverflow = document.body.style.overflow;
        const previousBodyPosition = document.body.style.position;
        const previousBodyTop = document.body.style.top;
        const previousBodyLeft = document.body.style.left;
        const previousBodyRight = document.body.style.right;
        const previousBodyWidth = document.body.style.width;
        const previousDocumentOverflow = document.documentElement.style.overflow;
        const previousOverscrollBehavior = document.documentElement.style.overscrollBehavior;
        const lockedScrollX = window.scrollX;
        const lockedScrollY = window.scrollY;

        if (config.scrollLock) {
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${lockedScrollY}px`;
            document.body.style.left = `-${lockedScrollX}px`;
            document.body.style.right = '0';
            document.body.style.width = '100%';
            document.documentElement.style.overflow = 'hidden';
            document.documentElement.style.overscrollBehavior = 'none';
        }

        const initialize = window.setTimeout(() => {
            setHighlightedElementPositions();
        }, 100);
        const positionRetryInterval = window.setInterval(() => {
            if (currentElements.current.length === 0) {
                setHighlightedElementPositions();
            }
        }, 250);
        const schedulePositionUpdate = () => {
            if (resizeTimeoutRef.current !== null) {
                window.clearTimeout(resizeTimeoutRef.current);
            }

            resizeTimeoutRef.current = window.setTimeout(() => {
                setHighlightedElementPositions();
            }, 250);
        };

        window.addEventListener('resize', schedulePositionUpdate);
        window.addEventListener('scroll', schedulePositionUpdate, true);

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.body.style.position = previousBodyPosition;
            document.body.style.top = previousBodyTop;
            document.body.style.left = previousBodyLeft;
            document.body.style.right = previousBodyRight;
            document.body.style.width = previousBodyWidth;
            document.documentElement.style.overflow = previousDocumentOverflow;
            document.documentElement.style.overscrollBehavior = previousOverscrollBehavior;
            window.scrollTo(lockedScrollX, lockedScrollY);
            window.clearTimeout(initialize);
            window.clearInterval(positionRetryInterval);

            if (resizeTimeoutRef.current !== null) {
                window.clearTimeout(resizeTimeoutRef.current);
            }

            resetHighlightedElements();
            window.removeEventListener('resize', schedulePositionUpdate);
            window.removeEventListener('scroll', schedulePositionUpdate, true);
        };
    }, [config.scrollLock, resetHighlightedElements, setHighlightedElementPositions]);

    return {
        currentStep,
        infoBoxElement,
        nextStep,
        previousStep,
        rectStyles,
        stepIndex,
        totalSteps,
    };
}
