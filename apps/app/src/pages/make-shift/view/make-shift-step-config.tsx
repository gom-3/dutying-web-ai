import {type ComponentType} from 'react';
import {type TMakeShiftStep} from '../model/make-shift-store';
import {AiAutofill} from './steps/ai-auto-fill';
import {Constraints} from './steps/constraints';
import {FixedShifts} from './steps/fixed-shifts';
import {RequestsShifts} from './steps/requests-shifts';
import {Workers} from './steps/workers';

type TMakeShiftStepIntro = {
    title: string;
    desc: string[];
};

type TMakeShiftStepConfig = {
    label: string;
    layout: 'narrow' | 'wide';
    Component: ComponentType;
    intro?: TMakeShiftStepIntro;
};

export const MAKE_SHIFT_STEP_CONFIG: Record<TMakeShiftStep, TMakeShiftStepConfig> = {
    1: {
        label: '근무자 확인',
        layout: 'narrow',
        Component: Workers,
        intro: {
            title: '근무자를 확정해 주세요',
            desc: ["'근무투입'이 선택된 근무자만 불러왔어요", '목록 순서대로 근무표에 배치해 드릴게요'],
        },
    },
    2: {
        label: '제약 조건',
        layout: 'narrow',
        Component: Constraints,
        intro: {
            title: '제약 조건을 확정해 주세요',
            desc: ['모든 제약 조건을 적용하기 어려울 수 있어요', '우선순위를 정해 주시면, 더 정확하게 반영해 드릴게요'],
        },
    },
    3: {
        label: '신청 근무 확정',
        layout: 'wide',
        Component: RequestsShifts,
    },
    4: {
        label: '고정 근무',
        layout: 'wide',
        Component: FixedShifts,
    },
    5: {
        label: 'AI 자동 채우기',
        layout: 'wide',
        Component: AiAutofill,
    },
};

export const STEP_LABELS: Record<TMakeShiftStep, string> = Object.fromEntries(
    Object.entries(MAKE_SHIFT_STEP_CONFIG).map(([step, config]) => [Number(step), config.label]),
) as Record<TMakeShiftStep, string>;
