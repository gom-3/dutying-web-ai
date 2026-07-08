import type {IApiClient} from '../client';
import type {INurseAPI, TCreateNurseDTO, TNurseResponse, TUpdateNurseDTO, TUpdateNurseShiftTypeRequest} from './contracts';

const DUMMY_PHONE_NUM = '01000000000';

const compactRequest = <T extends Record<string, unknown>>(request: T) =>
    Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined)) as Partial<T>;
const toPhoneDigits = (phoneNum: string | null | undefined) => (phoneNum ?? '').replace(/\D/g, '');
const isDummyPhoneNum = (phoneNum: string | null | undefined) => toPhoneDigits(phoneNum) === DUMMY_PHONE_NUM;

const toOptionalPhoneNum = (phoneNum: string | null | undefined, options: {clearDummy?: boolean} = {}) => {
    if (phoneNum === undefined) return undefined;
    if (phoneNum === null) return null;

    const trimmedPhoneNum = phoneNum.trim();

    if (isDummyPhoneNum(trimmedPhoneNum)) return options.clearDummy ? null : undefined;

    return trimmedPhoneNum.length > 0 ? trimmedPhoneNum : undefined;
};

const toOptionalText = (value: string | null | undefined) => {
    if (value == null) return undefined;

    return value.trim();
};

const toUpdateNurseRequest = (updatedNurse: TCreateNurseDTO | TUpdateNurseDTO, options: {clearDummyPhoneNum?: boolean} = {}) =>
    compactRequest({
        name: toOptionalText(updatedNurse.name),
        phoneNum: toOptionalPhoneNum(updatedNurse.phoneNum, {clearDummy: options.clearDummyPhoneNum}),
        isWorker: updatedNurse.isWorker,
        isWardManager: updatedNurse.isWardManager,
        memo: updatedNurse.memo ?? undefined,
        proficiency: updatedNurse.proficiency,
        isPreceptor: updatedNurse.isPreceptor,
        isPreceptee: updatedNurse.isPreceptee,
        remainingAnnualLeaveDays: updatedNurse.remainingAnnualLeaveDays,
        workStartDate: toOptionalText(updatedNurse.workStartDate),
        workEndDate: toOptionalText(updatedNurse.workEndDate),
    });
const normalizeNurseResponse = (nurse: TNurseResponse): TNurseResponse =>
    isDummyPhoneNum(nurse.phoneNum) ? {...nurse, phoneNum: null} : nurse;

export const createNurseApi = (client: IApiClient): INurseAPI => ({
    createAccountNurse: async (accountId: number, createNurse: TCreateNurseDTO) =>
        normalizeNurseResponse((await client.post<TNurseResponse>(`/nurses?accountId=${accountId}`, toUpdateNurseRequest(createNurse))).data),
    getNurse: async (nurseId: number) => normalizeNurseResponse((await client.get<TNurseResponse>(`/nurses/${nurseId}`)).data),
    updateNurse: async (nurseId: number, updatedNurse: TUpdateNurseDTO) =>
        normalizeNurseResponse(
            (await client.patch<TNurseResponse>(`/nurses/${nurseId}`, toUpdateNurseRequest(updatedNurse, {clearDummyPhoneNum: true}))).data,
        ),
    updateNurseStatus: async (nurseId: number, status: string) => (await client.patch<TNurseResponse>(`/nurses/${nurseId}`, {status})).data,
    connectNurse: async (nurseId: number) => (await client.post<void>(`/nurses/${nurseId}/connect`)).data,
    unConnectNurse: async (nurseId: number) => (await client.delete<void>(`/nurses/${nurseId}/connect`)).data,
    updateNurseOrder: async (
        nurseId: number,
        shiftTeamId: number,
        nextShiftTeamId: number,
        divisionNum: number,
        prevPriority: number,
        nextPriority: number,
        patchYearMonth: string,
    ) =>
        (
            await client.patch<void>(`/nurses/${nurseId}/priority`, {
                shiftTeamId,
                nextShiftTeamId,
                divisionNum,
                prevPriority,
                nextPriority,
                patchYearMonth,
            })
        ).data,
    updateShiftTeamDivision: async (shiftTeamId: number, prevPriority: number, changeValue: number, patchYearMonth: string) =>
        (
            await client.patch<void>(`/nurses/division`, {
                shiftTeamId,
                prevPriority,
                changeValue,
                patchYearMonth,
            })
        ).data,
    updateNurseShiftType: async (nurseId: number, nurseShiftTypeId: number, change: TUpdateNurseShiftTypeRequest) => {
        const {isPrefer, ...payload} = change;
        const normalizedPayload =
            typeof isPrefer === 'boolean' && typeof payload.isPreferred !== 'boolean'
                ? {...payload, isPreferred: isPrefer}
                : payload;

        return (await client.patch<void>(`/nurses/${nurseId}/shift-types/${nurseShiftTypeId}`, normalizedPayload)).data;
    },
    updateNurseCarry: async (shiftNurseId: number, value: number) =>
        (
            await client.patch<void>(`/shift-nurses/${shiftNurseId}/carried`, {
                value,
            })
        ).data,
});
