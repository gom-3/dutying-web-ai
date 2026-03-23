import {type ComponentType} from 'react';
import {type TI18nKey} from '@/shared/hook/use-typed-translation';
import {type TMakeShiftStep} from '../model/make-shift-store';
import {AiAutofill} from './steps/ai-auto-fill';
import {Constraints} from './steps/constraints';
import {FixedShifts} from './steps/fixed-shifts';
import {RequestsShifts} from './steps/requests-shifts';
import {Workers} from './steps/workers';

type TMakeShiftStepIntro = {
    titleKey: TI18nKey;
    descriptionKey: TI18nKey;
};

export type TMakeShiftStepConfig = {
    labelKey: TI18nKey;
    layout: 'narrow' | 'wide';
    Component: ComponentType;
    intro?: TMakeShiftStepIntro;
};

export const MAKE_SHIFT_STEP_CONFIG: Record<TMakeShiftStep, TMakeShiftStepConfig> = {
    1: {
        labelKey: 'page.makeShift.steps.workers.label',
        layout: 'narrow',
        Component: Workers,
        intro: {
            titleKey: 'page.makeShift.steps.workers.introTitle',
            descriptionKey: 'page.makeShift.steps.workers.introDescription',
        },
    },
    2: {
        labelKey: 'page.makeShift.steps.constraints.label',
        layout: 'narrow',
        Component: Constraints,
        intro: {
            titleKey: 'page.makeShift.steps.constraints.introTitle',
            descriptionKey: 'page.makeShift.steps.constraints.introDescription',
        },
    },
    3: {
        labelKey: 'page.makeShift.steps.requests.label',
        layout: 'wide',
        Component: RequestsShifts,
    },
    4: {
        labelKey: 'page.makeShift.steps.fixedShifts.label',
        layout: 'wide',
        Component: FixedShifts,
    },
    5: {
        labelKey: 'page.makeShift.steps.aiAutofill.label',
        layout: 'wide',
        Component: AiAutofill,
    },
};
