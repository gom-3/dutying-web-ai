import {describe, expect, it} from 'vitest';
import {DEFAULT_PROFILE_IMAGE_URL, getProfileImageSources} from '../model';

describe('getProfileImageSources', () => {
    it.each([
        undefined,
        {defaultProfileImgId: 30},
        {profileImgUrl: 'https://cdn.example.com/profile_img/default/profile30.png'},
        {profileImgUrl: 'https://api.dutying.ai/images/default/profile1.png?v=2'},
    ])('기존 기본 프로필을 새 이미지로 표시한다: %j', (profileImg) => {
        expect(getProfileImageSources({profileImg})).toEqual([DEFAULT_PROFILE_IMAGE_URL]);
    });

    it('사용자가 업로드한 이미지를 우선 표시한다', () => {
        const profileImgUrl = 'https://cdn.example.com/uploads/profile1.png';

        expect(getProfileImageSources({profileImg: {profileImgUrl, defaultProfileImgId: 1}})).toEqual([
            profileImgUrl,
            DEFAULT_PROFILE_IMAGE_URL,
        ]);
    });
});
