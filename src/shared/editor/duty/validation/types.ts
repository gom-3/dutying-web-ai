import type {WardConstraint} from '../../../types/ward';

export type DutyValidationMode = {
    /**
     * 신청 OFF 등 "요청" 정보를 함께 표기하고 싶을 때 사용.
     * - true면 해당 날짜는 'O'(대문자)로 간주되어 excludeNightBeforeReqOff 규칙이 동작한다.
     * - 제공하지 않으면(기본) 규칙은 사실상 비활성처럼 동작한다.
     */
    requestedOffByRow?: boolean[][];
};

export type DutyValidationInput = {
    wardConstraint: WardConstraint;
    mode?: DutyValidationMode;
};
