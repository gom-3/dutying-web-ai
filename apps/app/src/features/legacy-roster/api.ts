import type {AxiosInstance} from 'axios';
import defaultClient from '@/shared/api/client';

export type TImportResult = {
    importedShifts: number;
    skippedShifts: number;
    createdShiftTypes: number;
    reusedShiftTypes: number;
    alreadyImported: boolean;
};
export type TSourcePreview = {sourceHash: string; result: TImportResult};
export type TSourceAvailability = {available: boolean; years: number[]; message: string | null};
export type TRosterFile = {
    format: 'dutying-legacy-roster';
    version: 1;
    startDate: string;
    endDate: string;
    shiftTypes: unknown[];
    shifts: unknown[];
};

const base = (id: number) => {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('로그인 후 이용해 주세요.');

    return `/accounts/${id}/shift-imports/legacy`;
};
const result = (data: TImportResult) => {
    if (
        !data ||
        typeof data.alreadyImported !== 'boolean' ||
        [data.importedShifts, data.skippedShifts, data.createdShiftTypes, data.reusedShiftTypes].some(
            (n) => !Number.isSafeInteger(n) || n < 0,
        )
    ) {
        throw new Error('가져오기 결과를 확인하지 못했어요. 다시 시도해 주세요.');
    }

    return data;
};

export async function parseRosterFile(file: File): Promise<TRosterFile> {
    if (!file.size || file.size > 2 * 1024 * 1024) throw new Error('근무표 파일은 2MB 이하만 선택할 수 있어요.');

    let data: TRosterFile;

    try {
        data = JSON.parse(await file.text()) as TRosterFile;
    } catch {
        throw new Error('읽을 수 없는 파일이에요. 기존 듀팅 근무표 JSON 파일을 선택해 주세요.');
    }

    if (
        data?.format !== 'dutying-legacy-roster' ||
        data.version !== 1 ||
        !Array.isArray(data.shiftTypes) ||
        !Array.isArray(data.shifts) ||
        data.shiftTypes.length < 1 ||
        data.shiftTypes.length > 256 ||
        data.shifts.length > 3660 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.endDate)
    ) {
        throw new Error('지원하지 않는 근무표 파일이에요. 기존 듀팅 근무표 JSON 파일을 선택해 주세요.');
    }

    // Do not forward identity, tokens, alarms or other unrelated fields from a user file.
    const typeKeys = ['id', 'name', 'shortName', 'color', 'classification', 'startTime', 'endTime', 'rotationSystem', 'isOff', 'isCounted'];
    const pick = (row: unknown, keys: string[]) => {
        if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new Error('근무표 파일 내용을 확인해 주세요.');

        return Object.fromEntries(keys.map((key) => [key, (row as Record<string, unknown>)[key]]));
    };

    return {
        format: data.format,
        version: data.version,
        startDate: data.startDate,
        endDate: data.endDate,
        shiftTypes: data.shiftTypes.map((row) => pick(row, typeKeys)),
        shifts: data.shifts.map((row) => pick(row, ['date', 'shiftTypeId'])),
    };
}
export const createLegacyRosterApi = (client: AxiosInstance) => ({
    async source(id: number): Promise<TSourceAvailability> {
        const {data} = await client.get<TSourceAvailability>(`${base(id)}/source`, {suppressErrorToast: true});

        if (
            !data ||
            typeof data.available !== 'boolean' ||
            !Array.isArray(data.years) ||
            data.years.some((year) => !Number.isInteger(year) || year < 1900 || year > 2200)
        ) {
            throw new Error('기존 근무표 정보를 확인하지 못했어요. 다시 시도해 주세요.');
        }

        return data;
    },
    async previewSource(id: number, year: number): Promise<TSourcePreview> {
        const {data} = await client.post<TSourcePreview>(`${base(id)}/source/${year}/preview`, undefined, {suppressErrorToast: true});

        if (!data || typeof data.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(data.sourceHash))
            throw new Error('미리보기를 다시 확인해 주세요.');

        return {...data, result: result(data.result)};
    },
    async commitSource(id: number, year: number, sourceHash: string) {
        return result(
            (await client.post<TImportResult>(`${base(id)}/source/${year}/commit`, {sourceHash}, {suppressErrorToast: true})).data,
        );
    },
    async previewFile(id: number, file: TRosterFile) {
        return result((await client.post<TImportResult>(`${base(id)}/preview`, file, {suppressErrorToast: true})).data);
    },
    async commitFile(id: number, file: TRosterFile) {
        return result((await client.post<TImportResult>(`${base(id)}/commit`, file, {suppressErrorToast: true})).data);
    },
});

export const legacyRosterApi = createLegacyRosterApi(defaultClient);
export type TLegacyRosterApi = ReturnType<typeof createLegacyRosterApi>;
