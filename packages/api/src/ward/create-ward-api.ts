import type {IApiClient} from '../client';
import type {
    IWardAPI,
    TAutofillResponse,
    TAddShiftTeamNurseDTO,
    TCreateWardChatMessageDTO,
    TCreateShiftTypeDTO,
    TAddWardAdminByLoginIdDTO,
    TCreateWardAdminEmailDTO,
    TCreateWardAdminInvitationDTO,
    TCreateWardDTO,
    TCreateOnboardingWardDraftDTO,
    TCreateWardShiftTypeDTO,
    TOnboardingScheduleInputPreviewDTO,
    TOnboardingScheduleInputPreviewResponse,
    TDutyRequestResponse,
    TEditWardDTO,
    TPublishSnapshotRes,
    TReadWardChatDTO,
    TRequestShiftResponse,
    TShiftConstraintRuleCandidatesResponse,
    TShiftResponse,
    TShiftTeamResponse,
    TSnapshotDetailRes,
    TSnapshotListRes,
    TOnboardingWardDraftResponse,
    TSnapshotSaveRes,
    TUpdateOnboardingWardDraftDTO,
    TUpdateShiftTeamDTO,
    TValidationRes,
    TWaitingNurseResponse,
    TWardAdminEmailRegistrationResponse,
    TWardAdminInvitationResponse,
    TWardAdminMembershipResponse,
    TWardAdminsResponse,
    TWardChatMessageResponse,
    TWardChatMessagesResponse,
    TWardChatUnreadCountResponse,
    TWardConstraintDTO,
    TWardConstraintResponse,
    TWorkspaceScheduleResponse,
    TWardResponse,
    TWardShiftTypeResponse,
    TWardShiftsDTO,
} from './contracts';
import type {TNurseResponse} from '../nurse';

const DUMMY_PHONE_NUM = '01000000000';

const toYearMonthQuery = (year: number, month: number) =>
    new URLSearchParams({
        year: String(year),
        month: String(month),
    }).toString();

const toPostShiftQuery = (year: number, month: number) =>
    new URLSearchParams({
        year: String(year),
        month: month.toString().padStart(2, '0'),
    }).toString();

const toChatMessagesQuery = (cursorMessageId?: number, size?: number) => {
    const params = new URLSearchParams();

    if (typeof cursorMessageId === 'number') params.set('cursorMessageId', String(cursorMessageId));

    if (typeof size === 'number') params.set('size', String(size));

    return params.toString();
};

const toIsoDate = (year: number, month: number, day: number) =>
    `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

export type TCreateWardApiOptions = {
    basePath?: string;
};

type TCreateWardShiftTypeRequest = Omit<TCreateWardShiftTypeDTO, 'startTime' | 'endTime'> & {
    startTime: string | null;
    endTime: string | null;
};

type TCreateWardRequest = Omit<TCreateWardDTO, 'wardShiftTypes'> & {
    wardShiftTypes: TCreateWardShiftTypeRequest[];
};

const normalizeBasePath = (basePath: string | undefined) => {
    const path = basePath?.trim() || '/wards';

    return path.endsWith('/') ? path.slice(0, -1) : path;
};
const compactRequest = <T extends Record<string, unknown>>(request: T) =>
    Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined)) as Partial<T>;
const toCreateWardShiftTeamRequest = (shiftTeam: TCreateWardDTO['shiftTeams'][number]) =>
    compactRequest({
        name: shiftTeam.name,
        nurseNames: shiftTeam.nurseNames,
        nurses: shiftTeam.nurses,
        constraintRules: shiftTeam.constraintRules,
    }) as TCreateWardRequest['shiftTeams'][number];

const toCreateWardRequest = (createWardDTO: TCreateWardDTO): TCreateWardRequest => ({
    name: createWardDTO.name,
    hospitalName: createWardDTO.hospitalName,
    wardShiftTypes: createWardDTO.wardShiftTypes.map((shiftType) => ({
        ...shiftType,
        startTime: shiftType.isOff ? null : shiftType.startTime,
        endTime: shiftType.isOff ? null : shiftType.endTime,
    })),
    shiftTeams: createWardDTO.shiftTeams.map(toCreateWardShiftTeamRequest),
});

const toPhoneDigits = (phoneNum: string | null | undefined) => (phoneNum ?? '').replace(/\D/g, '');
const isDummyPhoneNum = (phoneNum: string | null | undefined) => toPhoneDigits(phoneNum) === DUMMY_PHONE_NUM;

const toOptionalPhoneNum = (phoneNum: string | null | undefined) => {
    if (phoneNum == null) return undefined;

    const trimmedPhoneNum = phoneNum.trim();

    if (isDummyPhoneNum(trimmedPhoneNum)) return undefined;

    return trimmedPhoneNum.length > 0 ? trimmedPhoneNum : undefined;
};

const toOptionalText = (value: string | null | undefined) => {
    if (value == null) return undefined;

    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const toAddShiftTeamNurseRequest = (nurse: TAddShiftTeamNurseDTO) =>
    compactRequest({
        name: nurse.name.trim(),
        phoneNum: toOptionalPhoneNum(nurse.phoneNum),
        isWorker: nurse.isWorker,
        isWardManager: nurse.isWardManager,
        memo: nurse.memo ?? undefined,
        proficiency: nurse.proficiency,
        isPreceptor: nurse.isPreceptor,
        isPreceptee: nurse.isPreceptee,
        workStartDate: toOptionalText(nurse.workStartDate),
        workEndDate: toOptionalText(nurse.workEndDate),
    });
const normalizeNurseResponse = <T extends {phoneNum?: string | null}>(nurse: T): T =>
    isDummyPhoneNum(nurse.phoneNum) ? {...nurse, phoneNum: null} : nurse;
const normalizeShiftTeamResponse = (shiftTeam: TShiftTeamResponse): TShiftTeamResponse => ({
    ...shiftTeam,
    nurses: (shiftTeam.nurses ?? []).map(normalizeNurseResponse),
});
const normalizeWardResponse = (ward: TWardResponse): TWardResponse => ({
    ...ward,
    shiftTeams: (ward.shiftTeams ?? []).map(normalizeShiftTeamResponse),
});
const normalizeOnboardingWardDraftResponse = (
    response: TOnboardingWardDraftResponse | null | undefined,
): TOnboardingWardDraftResponse | null => {
    if (!response || typeof response !== 'object') return null;

    return {
        ...response,
        ward: normalizeWardResponse(response.ward),
    };
};

export const createWardApi = (client: IApiClient, options: TCreateWardApiOptions = {}): IWardAPI => {
    const basePath = normalizeBasePath(options.basePath);
    const wardPath = (path = '') => `${basePath}${path}`;

    return {
        getWard: async (wardId: number) => normalizeWardResponse((await client.get<TWardResponse>(wardPath(`/${wardId}`))).data),
        createWard: async (createWardDTO: TCreateWardDTO) =>
            normalizeWardResponse((await client.post<TWardResponse>(wardPath(), toCreateWardRequest(createWardDTO))).data),
        createOnboardingWardDraft: async (draftDTO: TCreateOnboardingWardDraftDTO) =>
            normalizeWardResponse((await client.post<TWardResponse>(wardPath('/onboarding/drafts'), draftDTO)).data),
        getCurrentOnboardingWardDraft: async () =>
            normalizeOnboardingWardDraftResponse(
                (await client.get<TOnboardingWardDraftResponse | null | undefined>(wardPath('/onboarding/drafts/current'))).data,
            ),
        updateOnboardingWardDraft: async (wardId: number, draftDTO: TUpdateOnboardingWardDraftDTO) =>
            normalizeOnboardingWardDraftResponse(
                (await client.patch<TOnboardingWardDraftResponse>(wardPath(`/${wardId}/onboarding/draft`), draftDTO)).data,
            ) as TOnboardingWardDraftResponse,
        previewOnboardingScheduleInput: async (previewDTO: TOnboardingScheduleInputPreviewDTO) =>
            (await client.post<TOnboardingScheduleInputPreviewResponse>(wardPath('/onboarding/schedule-input/preview'), previewDTO)).data,
        completeOnboardingWardDraft: async (wardId: number, createWardDTO: TCreateWardDTO) =>
            normalizeWardResponse(
                (await client.post<TWardResponse>(wardPath(`/${wardId}/onboarding/complete`), toCreateWardRequest(createWardDTO))).data,
            ),
        editWard: async (wardId: number, ward: TEditWardDTO) => (await client.patch<TWardResponse>(wardPath(`/${wardId}`), ward)).data,
        getWardConstraint: async (wardId: number, shiftTeamId: number) =>
            (await client.get<TWardConstraintResponse>(wardPath(`/${wardId}/shift-teams/${shiftTeamId}/constraint`))).data,
        getShiftConstraintRuleCandidates: async (wardId: number, shiftTeamId: number) =>
            (
                await client.get<TShiftConstraintRuleCandidatesResponse>(
                    wardPath(`/${wardId}/shift-teams/${shiftTeamId}/shift-constraint-rules/candidates`),
                )
            ).data,
        updateWardConstraint: async (wardId: number, shiftTeamId: number, constraint: TWardConstraintDTO) =>
            (await client.patch<TWardConstraintResponse>(wardPath(`/${wardId}/shift-teams/${shiftTeamId}/constraint`), constraint)).data,
        getWardByCode: async (code: string) =>
            normalizeWardResponse((await client.get<TWardResponse>(wardPath(`/search?${new URLSearchParams({code}).toString()}`))).data),
        getWaitingNurses: async (wardId: number) =>
            (await client.get<{nurses: TWaitingNurseResponse[]}>(wardPath(`/${wardId}/waiting-nurses/v2`))).data.nurses,
        addMeToWaitingNurses: async (wardId: number) => (await client.post<void>(wardPath(`/${wardId}/waiting-nurses`))).data,
        connectWaitingNurses: async (wardId: number, waitingNurseId: number, targetNurseId: number) =>
            (await client.post<void>(wardPath(`/${wardId}/waiting-nurses/${waitingNurseId}/connect?targetNurseId=${targetNurseId}`))).data,
        approveWaitingNurses: async (wardId: number, waitingNurseId: number, shiftTeamId: number) =>
            (await client.post<void>(wardPath(`/${wardId}/waiting-nurses/${waitingNurseId}/approve?shiftTeamId=${shiftTeamId}`))).data,
        deleteWaitingNurseRequest: async (wardId: number, waitingNurseId: number) =>
            (await client.delete<void>(wardPath(`/${wardId}/waiting-nurses/${waitingNurseId}/v1`))).data,
        deleteWaitingNurses: async (wardId: number, nurseId: number) =>
            (await client.delete<void>(wardPath(`/${wardId}/waiting-nurses?nurseId=${nurseId}`))).data,
        quitWard: async (wardId: number) => (await client.delete<void>(wardPath(`/${wardId}/quit`))).data,
        getReqShift: async (wardId: number, shiftTeamId: number, year: number, month: number) =>
            (
                await client.get<TRequestShiftResponse>(
                    wardPath(`/${wardId}/shift-teams/${shiftTeamId}/req-duty?${toYearMonthQuery(year, month)}`),
                )
            ).data,
        getShift: async (wardId: number, shiftTeamId: number, year: number, month: number) =>
            (await client.get<TShiftResponse>(wardPath(`/${wardId}/shift-teams/${shiftTeamId}/duty?${toYearMonthQuery(year, month)}`)))
                .data,
        getRequestList: async (wardId: number, shiftTeamId: number, year: number, month: number) =>
            (
                await client.get<TDutyRequestResponse[]>(
                    wardPath(`/${wardId}/shift-teams/${shiftTeamId}/req-duty/req-list?${toYearMonthQuery(year, month)}`),
                )
            ).data,
        updateShift: async (
            wardId: number,
            year: number,
            month: number,
            day: number,
            shiftNurseId: number,
            wardShiftTypeId: number | null,
        ) =>
            (
                await client.patch<null>(wardPath(`/${wardId}/shifts`), {
                    shiftNurseId,
                    date: toIsoDate(year, month, day),
                    wardShiftTypeId,
                })
            ).data,
        updateShifts: async (wardId: number, wardShifts: TWardShiftsDTO) =>
            (
                await client.patch<void>(wardPath(`/${wardId}/shifts/list`), {
                    wardShifts,
                })
            ).data,
        getWardChatMessages: async (wardId: number, options) => {
            const query = toChatMessagesQuery(options?.cursorMessageId, options?.size);

            return (await client.get<TWardChatMessagesResponse>(wardPath(`/${wardId}/chat/messages${query ? `?${query}` : ''}`))).data;
        },
        createWardChatMessage: async (wardId: number, message: TCreateWardChatMessageDTO) =>
            (await client.post<TWardChatMessageResponse>(wardPath(`/${wardId}/chat/messages`), message)).data,
        readWardChat: async (wardId: number, read: TReadWardChatDTO) =>
            (await client.put<void>(wardPath(`/${wardId}/chat/read`), read)).data,
        getWardChatUnreadCount: async (wardId: number) =>
            (await client.get<TWardChatUnreadCountResponse>(wardPath(`/${wardId}/chat/unread-count`))).data,
        getMyWardChatUnreadCounts: async () => (await client.get<TWardChatUnreadCountResponse[]>(wardPath('/chat/unread-counts'))).data,
        getWardAdmins: async (wardId: number) => (await client.get<TWardAdminsResponse>(`/admin/wards/${wardId}/admins`)).data,
        createWardAdminEmail: async (wardId: number, adminEmail: TCreateWardAdminEmailDTO) =>
            (await client.post<TWardAdminEmailRegistrationResponse>(`/admin/wards/${wardId}/admin-emails`, adminEmail)).data,
        createWardAdminInvitation: async (wardId: number, invitation: TCreateWardAdminInvitationDTO) =>
            (await client.post<TWardAdminInvitationResponse>(wardPath(`/${wardId}/admin-invitations`), invitation)).data,
        addWardAdminByLoginId: async (wardId: number, admin: TAddWardAdminByLoginIdDTO) =>
            (await client.post<TWardAdminMembershipResponse>(wardPath(`/${wardId}/admins/by-login-id`), admin)).data,
        resendWardAdminInvitation: async (wardId: number, invitationId: number) =>
            (await client.post<void>(wardPath(`/${wardId}/admin-invitations/${invitationId}/resend`))).data,
        cancelWardAdminInvitation: async (wardId: number, invitationId: number) =>
            (await client.delete<void>(wardPath(`/${wardId}/admin-invitations/${invitationId}`))).data,
        removeWardAdmin: async (wardId: number, membershipId: number) =>
            (await client.delete<void>(`/admin/wards/${wardId}/admins/${membershipId}`)).data,
        removeWardAdminEmail: async (wardId: number, emailRegistrationId: number) =>
            (await client.delete<void>(`/admin/wards/${wardId}/admin-emails/${emailRegistrationId}`)).data,
        updateReqShift: async (
            wardId: number,
            year: number,
            month: number,
            day: number,
            shiftNurseId: number,
            wardShiftTypeId: number | null,
        ) =>
            (
                await client.patch<void>(wardPath(`/${wardId}/req-shifts`), {
                    shiftNurseId,
                    date: toIsoDate(year, month, day),
                    wardShiftTypeId,
                })
            ).data,
        acceptRequestShift: async (wardId: number, reqShiftId: number, isAccepted: boolean | null) =>
            (
                await client.patch<void>(wardPath(`/${wardId}/req-shifts/${reqShiftId}/accept`), {
                    isAccepted,
                })
            ).data,
        postShift: async (wardId: number, shiftTeamId: number, year: number, month: number) =>
            (await client.post<void>(wardPath(`/${wardId}/shift-teams/${shiftTeamId}/post?${toPostShiftQuery(year, month)}`))).data,
        getShiftTeamNurses: async (wardId: number, shiftTeamId: number) =>
            (
                await client.get<{nurses: TShiftTeamResponse['nurses']}>(wardPath(`/${wardId}/shift-teams/${shiftTeamId}/nurses`))
            ).data.nurses.map(normalizeNurseResponse),
        addNurseIntoShiftTeam: async (wardId: number, shiftTeamId: number, addShiftTeamNurseDTO) =>
            normalizeNurseResponse(
                (
                    await client.post<TNurseResponse>(
                        wardPath(`/${wardId}/shift-teams/${shiftTeamId}/nurses`),
                        toAddShiftTeamNurseRequest(addShiftTeamNurseDTO),
                    )
                ).data,
            ),
        removeNurseFromShiftTeam: async (wardId: number, shiftTeamId: number, nurseId: number) =>
            normalizeNurseResponse(
                (await client.delete<TNurseResponse>(wardPath(`/${wardId}/shift-teams/${shiftTeamId}/nurses/${nurseId}`))).data,
            ),
        getShiftTeams: async (wardId: number) =>
            (await client.get<{shiftTeams: TShiftTeamResponse[]}>(wardPath(`/${wardId}/shift-teams`))).data.shiftTeams.map(
                normalizeShiftTeamResponse,
            ),
        createShiftTeam: async (wardId: number) =>
            normalizeShiftTeamResponse((await client.post<TShiftTeamResponse>(wardPath(`/${wardId}/shift-teams`))).data),
        buildShiftTeam: async (wardId: number, shiftTeamId: number, year: number, month: number) =>
            normalizeShiftTeamResponse(
                (await client.post<TShiftTeamResponse>(wardPath(`/${wardId}/shift-teams/${shiftTeamId}?${toYearMonthQuery(year, month)}`)))
                    .data,
            ),
        deleteShiftTeam: async (wardId: number, shiftTeamId: number) =>
            normalizeShiftTeamResponse((await client.delete<TShiftTeamResponse>(wardPath(`/${wardId}/shift-teams/${shiftTeamId}`))).data),
        updateShiftTeam: async (wardId: number, shiftTeamId: number, updateShiftTeamDTO: TUpdateShiftTeamDTO) =>
            normalizeShiftTeamResponse(
                (await client.patch<TShiftTeamResponse>(wardPath(`/${wardId}/shift-teams/${shiftTeamId}`), updateShiftTeamDTO)).data,
            ),
        getShiftTypes: async (wardId: number) => (await client.get<TWardShiftTypeResponse[]>(wardPath(`/${wardId}/shift-types`))).data,
        createShiftType: async (wardId: number, createShiftTypeDTO: TCreateShiftTypeDTO) =>
            (await client.post<TWardShiftTypeResponse>(wardPath(`/${wardId}/shift-types`), createShiftTypeDTO)).data,
        deleteShiftType: async (wardId: number, shiftTypeId: number) =>
            (await client.delete<void>(wardPath(`/${wardId}/shift-types/${shiftTypeId}`))).data,
        updateShiftType: async (wardId: number, shiftTypeId: number, createShiftTypeDTO: TCreateShiftTypeDTO) =>
            (await client.put<TWardShiftTypeResponse>(wardPath(`/${wardId}/shift-types/${shiftTypeId}`), createShiftTypeDTO)).data,
        getWatingNurses: async (wardId: number) =>
            (await client.get<{nurses: TWaitingNurseResponse[]}>(wardPath(`/${wardId}/waiting-nurses/v2`))).data.nurses,
        addMeToWatingNurses: async (wardId: number) => (await client.post<void>(wardPath(`/${wardId}/waiting-nurses`))).data,
        connectWatingNurses: async (wardId: number, waitingNurseId: number, targetNurseId: number) =>
            (await client.post<void>(wardPath(`/${wardId}/waiting-nurses/${waitingNurseId}/connect?targetNurseId=${targetNurseId}`))).data,
        approveWatingNurses: async (wardId: number, waitingNurseId: number, shiftTeamId: number) =>
            (await client.post<void>(wardPath(`/${wardId}/waiting-nurses/${waitingNurseId}/approve?shiftTeamId=${shiftTeamId}`))).data,
        deleteWatingNurses: async (wardId: number, nurseId: number) =>
            (await client.delete<void>(wardPath(`/${wardId}/waiting-nurses?nurseId=${nurseId}`))).data,

        getWorkspaceSchedule: async (wardId: number, shiftTeamId: number, year: number, month: number) =>
            (
                await client.get<TWorkspaceScheduleResponse>(
                    wardPath(`/${wardId}/shift-teams/${shiftTeamId}/schedule/workspace?${toYearMonthQuery(year, month)}`),
                )
            ).data,
        validateSnapshot: async (wardId, shiftTeamId, validateSnapshotDTO) =>
            (
                await client.post<TValidationRes>(
                    wardPath(`/${wardId}/shift-teams/${shiftTeamId}/schedule/validate-snapshot`),
                    validateSnapshotDTO,
                )
            ).data,
        autofillSchedule: async (wardId, shiftTeamId, autofillDTO) =>
            (await client.post<TAutofillResponse>(wardPath(`/${wardId}/shift-teams/${shiftTeamId}/schedule/autofill`), autofillDTO)).data,
        getSnapshots: async (wardId, shiftTeamId, year, month) =>
            (
                await client.get<TSnapshotListRes>(
                    wardPath(`/${wardId}/shift-teams/${shiftTeamId}/schedule/snapshots?${toYearMonthQuery(year, month)}`),
                )
            ).data,
        saveSnapshot: async (wardId, shiftTeamId, saveSnapshotDTO) =>
            (await client.post<TSnapshotSaveRes>(wardPath(`/${wardId}/shift-teams/${shiftTeamId}/schedule/snapshots`), saveSnapshotDTO))
                .data,
        getSnapshot: async (wardId, shiftTeamId, snapshotId) =>
            (await client.get<TSnapshotDetailRes>(wardPath(`/${wardId}/shift-teams/${shiftTeamId}/schedule/snapshots/${snapshotId}`))).data,
        deleteSnapshot: async (wardId, shiftTeamId, snapshotId) =>
            (await client.delete<void>(wardPath(`/${wardId}/shift-teams/${shiftTeamId}/schedule/snapshots/${snapshotId}`))).data,
        publishSnapshot: async (wardId, shiftTeamId, snapshotId, publishDTO = {}) =>
            (
                await client.post<TPublishSnapshotRes>(
                    wardPath(`/${wardId}/shift-teams/${shiftTeamId}/schedule/snapshots/${snapshotId}/publish`),
                    publishDTO,
                )
            ).data,
    };
};
