import {useProfileImageStore} from '@/hooks/file/store';
import {cn} from '@/libs/util/style';

interface Props extends Omit<React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>, 'type'> {
    profileImg: {profileImgUrl?: string; defaultProfileImgId?: number};
}

export const ProfileImage = ({profileImg, ...props}: Props) => {
    const {imageBaseUrl} = useProfileImageStore();

    return (
        <img
            className={cn('rounded-full object-cover object-center', props.className)}
            alt="profile image"
            // TODO: 추후 fallback 추가 필요
            src={profileImg.profileImgUrl ?? `${imageBaseUrl}/profile_img/default/profile${profileImg.defaultProfileImgId}.png`}
            {...props}
        />
    );
};
