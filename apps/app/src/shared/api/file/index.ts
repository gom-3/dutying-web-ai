import i18n from 'i18next';
import axiosInstance from '../client';
import {isOnboardingImageFile} from './onboarding-format';
import {
    type IFileAPI,
    type IPresignedUrlResponse,
    type TOnboardingWardParseApiResponse,
    type TOnboardingWardParseOptions,
    type TPresignedUrlRequest,
} from './type';

class FileAPI implements IFileAPI {
    public async getPresignedUrl(fileType: TPresignedUrlRequest, fileExtension: string) {
        return (
            await axiosInstance.post<IPresignedUrlResponse>(`/files/presigned-url`, {
                fileType,
                fileExtension,
            })
        ).data;
    }

    public async recordBrowserExcelImport(file: File, year: number, month: number) {
        await axiosInstance.post(
            '/files/wards/onboarding/browser-import',
            {filename: file.name, size: file.size, year, month},
            {suppressErrorToast: true},
        );
    }

    public async parseOnboardingWardExcel(file: File, options?: TOnboardingWardParseOptions) {
        const formData = new FormData();

        formData.append('file', file);

        const path = '/files/wards/onboarding/parse';
        const config = {
            headers: {'Content-Type': 'multipart/form-data'},
            ...(options?.targetYear && options?.targetMonth ? {params: options} : {}),
        };

        if (!isOnboardingImageFile(file.name))
            return (await axiosInstance.post<TOnboardingWardParseApiResponse>(path, formData, config)).data;

        try {
            return (
                await axiosInstance.post<TOnboardingWardParseApiResponse>(path + '/v2', formData, {...config, suppressErrorToast: true})
            ).data;
        } catch (error) {
            // An older server may still serve just the original route during rollout.
            if (!(error instanceof Error && 'code' in error && (error.code === 404 || error.code === 405))) throw error;
        }

        const {data} = await axiosInstance.post<TOnboardingWardParseApiResponse>(path, formData, config);

        return {...data, warnings: [...(data.warnings ?? []), i18n.t('page.onboardingWardCreate.scheduleEntry.legacyPhotoReview')]};
    }
}

export default new FileAPI();
