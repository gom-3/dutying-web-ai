import {useState} from 'react';
import {FileAPI} from '@/libs/api';
import {FILE_TYPE} from '@/libs/api/file';
import {uploadImageToS3} from './uploadFile';

export const DEFAULT_IMAGE_COUNT = 30;

const initialImage = {defaultProfileImgId: Math.floor(Math.random() * DEFAULT_IMAGE_COUNT)};
const useProfileImage = () => {
    const [profileImg, setProfileImg] = useState<{profileImgUrl?: string; defaultProfileImgId?: number}>(initialImage);
    const [isLoading, setIsLoading] = useState(false);
    const setRandomImage = () => {
        setProfileImg({defaultProfileImgId: Math.floor(Math.random() * DEFAULT_IMAGE_COUNT) + 1});
    };
    const setPhotoImage = async (photo: File) => {
        setIsLoading(true);

        try {
            const {presignedUrl, fileUrl} = await FileAPI.getPresignedUrl(FILE_TYPE.PROFILE_IMAGE, 'jpg');

            await uploadImageToS3(presignedUrl, photo);
            setProfileImg({profileImgUrl: fileUrl});
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
