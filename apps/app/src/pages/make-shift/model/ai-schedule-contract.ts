import type {TAutofillResponse, TValidationRes} from '@dutying/api/ward';
import type {TDutyDoc} from '@/features/shift-editor';
import type {TShift} from '@/entities';

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
};

export type TAiScheduleProvider = {
    generate: (request: TAiScheduleRequest) => Promise<TAutofillResponse>;
};

export type TAiScheduleResult =
    | {
          ok: true;
          response: TAutofillResponse;
          validation: TValidationRes;
      }
    | {
          ok: false;
          message: string;
      };
