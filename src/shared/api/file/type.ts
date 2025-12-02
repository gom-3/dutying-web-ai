import {type TValues} from '@/shared/types/util';

export const FILE_TYPE = {
    PROFILE_IMAGE: 'PROFILE_IMAGE',
};

export type TPresignedUrlRequest = TValues<typeof FILE_TYPE>;

export interface IPresignedUrlResponse {
    presignedUrl: string;
    fileUrl: string;
    fileName: string;
    expiresIn: number;
}

export interface IFileAPI {
    // POST
    getPresignedUrl: (fileType: TPresignedUrlRequest, fileExtension: string) => Promise<IPresignedUrlResponse>;
}
