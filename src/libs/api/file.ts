import {type TValues} from '@/types/util';
import axiosInstance from './client';

export const FILE_TYPE = {
    PROFILE_IMAGE: 'PROFILE_IMAGE',
};

export type TPresignedUrlRequest = TValues<typeof FILE_TYPE>;

interface IPresignedUrlResponse {
    presignedUrl: string;
    fileUrl: string;
    fileName: string;
    expiresIn: number;
}

interface IFileAPI {
    // POST
    getPresignedUrl: (fileType: TPresignedUrlRequest, fileExtension: string) => Promise<IPresignedUrlResponse>;
}

class FileAPI implements IFileAPI {
    public async getPresignedUrl(fileType: TPresignedUrlRequest, fileExtension: string) {
        return (
            await axiosInstance.post<IPresignedUrlResponse>(`/files/presigned-url`, {
                fileType,
                fileExtension,
            })
        ).data;
    }
}
export default new FileAPI();
