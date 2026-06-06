import axiosInstance from '../client';
import {
    type IFileAPI,
    type IPresignedUrlResponse,
    type TOnboardingWardParseApiResponse,
    type TOnboardingWardParseOptions,
    type TOnboardingWardParseResultApiResponse,
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

    public async parseOnboardingWardExcel(file: File, options?: TOnboardingWardParseOptions) {
        const formData = new FormData();

        formData.append('file', file);
        if (options?.wardId) {
            formData.append('wardId', String(options.wardId));
        }

        return (
            await axiosInstance.post<TOnboardingWardParseApiResponse>(`/files/wards/onboarding/parse`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            })
        ).data;
    }

    public async getOnboardingWardParseResult(wardId: number) {
        return (await axiosInstance.get<TOnboardingWardParseResultApiResponse>(`/wards/${wardId}/onboarding/parse-result`)).data;
    }
}

export default new FileAPI();
