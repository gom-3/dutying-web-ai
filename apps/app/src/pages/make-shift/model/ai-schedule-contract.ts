import type {TAutofillAdjustDto, TAutofillResponse, TValidationRes} from '@dutying/api/ward';
import type {TShift} from '@/entities';
import type {TDutyDoc} from '@/features/shift-editor';

export type TAiScheduleRequest = {
    wardId: number;
    shiftTeamId: number;
    year: number;
    month: number;
    doc: TDutyDoc;
    originalShift: TShift;
    draftRevision: number;
    rulesHash: string;
    prompt?: string;
    /** 값이 있으면 조절이다. doc 이 곧 시드이므로 재생성처럼 칸을 비우지 않고 그대로 보낸다. */
    adjust?: TAutofillAdjustDto;
    /** 조절에서만 넘긴다. 고정·신청 셀에 더해 마지막 자동완성 이후 사용자가 고친 칸까지 포함. */
    lockedCellKeys?: string[];
    signal?: AbortSignal;
};

export type TAiScheduleProvider = {
    generate: (request: TAiScheduleRequest) => Promise<TAutofillResponse>;
};

export type TAiScheduleResult =
    | {
          ok: true;
          response: TAutofillResponse;
          validation: TValidationRes;
          /** 조절이 "이미 그 방향으로 최적"이라 아무것도 바꾸지 않은 경우. 실패가 아니다. */
          noChange?: boolean;
      }
    | {
          ok: false;
          message: string;
          canceled?: boolean;
      };
