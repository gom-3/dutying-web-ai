import {useState} from 'react';
import toast from 'react-hot-toast';
import {FileAPI} from '@/libs/api';
import {FILE_TYPE} from '@/libs/api/file';
import {uploadImageToS3} from './uploadFile';

export const DEFAULT_IMAGE_COUNT = 30;

const useProfileImage = (initialImg?: {profileImgUrl?: string; defaultProfileImgId?: number}) => {
    const [profileImg, setProfileImg] = useState<{profileImgUrl?: string; defaultProfileImgId?: number} | undefined>(initialImg);
    const [isLoading, setIsLoading] = useState(false);
    const setRandomImage = () => {
        setProfileImg({defaultProfileImgId: Math.floor(Math.random() * DEFAULT_IMAGE_COUNT) + 1});
    };
    const setPhotoImage = async (photo: File) => {
        setIsLoading(true);

        const extension = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';

        try {
            const {presignedUrl, fileUrl} = await FileAPI.getPresignedUrl(FILE_TYPE.PROFILE_IMAGE, extension);

            await uploadImageToS3(presignedUrl, photo);
            setProfileImg({profileImgUrl: fileUrl});
        } catch (e) {
            console.error(e);
            toast.error('프로필 이미지 업로드에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return {
        profileImg,
        isLoading,
        setRandomImage,
        setPhotoImage,
    };
};

export default useProfileImage;
