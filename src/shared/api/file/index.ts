import axiosInstance from '../client';
import {type IFileAPI, type IPresignedUrlResponse, type TPresignedUrlRequest} from './type';

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
