import {type ComponentType, lazy} from 'react';
import {type TI18nKey} from '@/shared/hook/use-typed-translation';
import {type TMakeShiftStep} from '../model/make-shift-store';

const Workers = lazy(() => import('./steps/workers').then((module) => ({default: module.Workers})));
const Constraints = lazy(() => import('./steps/constraints').then((module) => ({default: module.Constraints})));
const RequestsShifts = lazy(() => import('./steps/requests-shifts').then((module) => ({default: module.RequestsShifts})));
const AiAutofill = lazy(() => import('./steps/ai-auto-fill').then((module) => ({default: module.AiAutofill})));
const ConfirmedShifts = lazy(() => import('./steps/confirmed-shifts').then((module) => ({default: module.ConfirmedShifts})));

type TMakeShiftStepIntro = {
    titleKey: TI18nKey;
    descriptionKey: TI18nKey;
};

export type TMakeShiftStepConfig = {
    labelKey: TI18nKey;
    captionKey: TI18nKey;
    layout: 'narrow' | 'wide';
    Component: ComponentType;
    intro?: TMakeShiftStepIntro;
};

export const MAKE_SHIFT_STEP_CONFIG: Record<TMakeShiftStep, TMakeShiftStepConfig> = {
    1: {
        labelKey: 'page.makeShift.steps.workers.label',
        captionKey: 'page.makeShift.steps.workers.caption',
        layout: 'narrow',
        Component: Workers,
        intro: {
            titleKey: 'page.makeShift.steps.workers.introTitle',
            descriptionKey: 'page.makeShift.steps.workers.introDescription',
        },
    },
    2: {
        labelKey: 'page.makeShift.steps.constraints.label',
        captionKey: 'page.makeShift.steps.constraints.caption',
        layout: 'narrow',
        Component: Constraints,
        intro: {
            titleKey: 'page.makeShift.steps.constraints.introTitle',
            descriptionKey: 'page.makeShift.steps.constraints.introDescription',
        },
    },
    3: {
        labelKey: 'page.makeShift.steps.requests.label',
        captionKey: 'page.makeShift.steps.requests.caption',
        layout: 'wide',
        Component: RequestsShifts,
    },
    4: {
        labelKey: 'page.makeShift.steps.aiAutofill.label',
        captionKey: 'page.makeShift.steps.aiAutofill.caption',
        layout: 'wide',
        Component: AiAutofill,
    },
    5: {
        labelKey: 'page.makeShift.steps.confirmedShifts.label',
        captionKey: 'page.makeShift.steps.confirmedShifts.caption',
        layout: 'wide',
        Component: ConfirmedShifts,
    },
};
