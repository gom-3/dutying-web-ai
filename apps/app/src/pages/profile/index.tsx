import {useQuery} from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';
import {type ChangeEvent, useEffect, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {ProfileImage} from '@/entities/account/ui/profile-image';
import {type TNurse} from '@/entities/nurse';
import {wardQueryOptions} from '@/entities/ward';
import {useEditAccount} from '@/features/account/model';
import useAuth from '@/features/auth/useAuth';
import useProfileImage from '@/features/file';
import {CameraIcon, CheckedIcon, RandomIcon, UncheckedIcon} from '@/shared/assets/svg';
import ROUTE from '@/shared/constant/path';
import Button from '@/shared/ui/form-controls/Button';
import Select from '@/shared/ui/form-controls/Select';
import TextField from '@/shared/ui/form-controls/TextField';
import PageState from '@/shared/ui/PageState';
import {findProfileNurse, getCurrentProfileImage, getProfileDisplayName, isProfileFormDirty} from './model';

function ProfilePage() {
    const {
        state: {accountMe, accountMeStatus, _loaded},
        actions: {handleGetAccountMe, handleLogout},
    } = useAuth();
    const {handleEditProfile, deleteAccount, quitWard} = useEditAccount();
    const [writeNurse, setWriteNurse] = useState<TNurse | null>(null);
    const {profileImg, isLoading: isProfileImageLoading, setRandomImage, setPhotoImage, resetProfileImage} = useProfileImage();
    const wardQuery = useQuery({
        ...wardQueryOptions.id(accountMe?.wardId ?? 0),
        enabled: Boolean(accountMe?.wardId),
    });
    const selectedNurse = findProfileNurse(wardQuery.data, accountMe?.accountId);
    const displayName = getProfileDisplayName(writeNurse, accountMe);
    const currentProfileImage = getCurrentProfileImage(accountMe, profileImg);
    const isAccountBootstrapPending = !_loaded || accountMeStatus === 'idle' || accountMeStatus === 'loading';
    const isAccountBootstrapError = accountMeStatus === 'error';
    const isWardProfilePending = Boolean(accountMe?.wardId) && wardQuery.isPending && !selectedNurse;
    const isWardProfileError = Boolean(accountMe?.wardId) && wardQuery.isError && !selectedNurse;
    const isSaveDisabled =
        !isProfileFormDirty({
            originalNurse: selectedNurse,
            draftNurse: writeNurse,
            profileImg,
        }) || isProfileImageLoading;
    const handleChange = <T extends keyof TNurse>(key: T, value: TNurse[T]) => {
        if (!writeNurse) return;

        setWriteNurse({...writeNurse, [key]: value});
    };
    const save = async () => {
        if (!writeNurse) return;

        const isSaved = await handleEditProfile(writeNurse, currentProfileImage);

        if (isSaved) {
            resetProfileImage();
        }
    };

    useEffect(() => {
        if (!selectedNurse) {
            setWriteNurse(null);

            return;
        }

        setWriteNurse((prevWriteNurse) => {
            if (!prevWriteNurse) return selectedNurse;

            if (prevWriteNurse.nurseId !== selectedNurse.nurseId) return selectedNurse;

            return isProfileFormDirty({
                originalNurse: selectedNurse,
                draftNurse: prevWriteNurse,
                profileImg,
            })
                ? prevWriteNurse
                : selectedNurse;
        });
    }, [profileImg, selectedNurse]);

    const imageInputRef = useRef<HTMLInputElement>(null);
    const handleUploadImage = () => {
        imageInputRef.current?.click();
    };
    const handleChangeImage = async (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length < 1) {
            e.target.value = '';

            return;
        }

        const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
        };

        try {
            const compressedFile = await imageCompression(e.target.files[0], options);

            await setPhotoImage(compressedFile);
        } catch (_error) {
            toast.error('프로필 이미지 처리에 실패했습니다.');
        } finally {
            e.target.value = '';
        }
    };
    const retryProfilePage = () => {
        void handleGetAccountMe().catch(() => undefined);

        if (accountMe?.wardId) {
            void wardQuery.refetch();
        }
    };

    if (isAccountBootstrapPending || isWardProfilePending) {
        return (
            <div className="mx-auto flex h-full w-full max-w-306 items-center justify-center px-8">
                <PageState
                    tone="loading"
                    title="프로필 정보를 준비하고 있어요"
                    description="내 계정과 병동 정보를 순서대로 확인하고 있어요."
                    className="py-0"
                />
            </div>
        );
    }

    if (isAccountBootstrapError || isWardProfileError || !accountMe) {
        return (
            <div className="mx-auto flex h-full w-full max-w-306 items-center justify-center px-8">
                <PageState
                    tone="error"
                    title="프로필 정보를 불러오지 못했어요"
                    description="잠시 후 다시 시도해 주세요. 문제가 계속되면 다시 로그인해 주세요."
                    action={{label: '다시 시도', onClick: retryProfilePage}}
                    className="py-0"
                />
            </div>
        );
    }

    if (!accountMe.wardId || !selectedNurse || !writeNurse) {
        return (
            <div className="mx-auto flex h-full w-full max-w-306 items-center justify-center px-8">
                <PageState
                    tone="empty"
                    title={!accountMe.wardId ? '소속 병동 정보가 아직 없어요' : '내 프로필 정보를 아직 연결하지 못했어요'}
                    description={
                        !accountMe.wardId
                            ? '병동 연결이 완료되면 프로필 설정을 계속할 수 있어요.'
                            : '병동에 연결된 내 nurse 정보를 찾지 못했어요. 계정 연결 상태를 확인해 주세요.'
                    }
                    action={{label: '다시 불러오기', onClick: retryProfilePage}}
                    className="py-0"
                >
                    <div className="rounded-[20px] border border-gray-6 bg-white px-6 py-5">
                        <div className="mx-auto h-20 w-20 rounded-full border-[.375rem] border-sub-4">
                            <ProfileImage className="h-full w-full" name={accountMe.name} profileImg={currentProfileImage} />
                        </div>
                        <p className="mt-4 font-apple text-[1.25rem] font-semibold text-sub-1">{accountMe.name || '이름 미등록'}</p>
                        <p className="mt-1 font-apple text-[0.9375rem] text-gray-3">{accountMe.email}</p>
                    </div>
                </PageState>
            </div>
        );
    }

    return (
        <div className="mx-auto flex h-full w-full max-w-306 flex-col items-center justify-center px-8">
            <div className="flex w-full items-start justify-between gap-6">
                <div>
                    <h1 className="font-apple text-[2rem] font-semibold text-text-1">프로필 설정</h1>
                    <p className="mt-2 font-apple text-[1rem] leading-6 text-gray-3">프로필 이미지와 기본 정보를 확인하고 저장해 주세요.</p>
                </div>
                <button
                    type="button"
                    className="flex h-10 items-center justify-center rounded-[1.875rem] border-[.0625rem] border-sub-3 bg-white px-4 font-apple text-[1.4375rem] font-medium text-sub-3"
                    onClick={() => handleLogout(ROUTE.ROOT)}
                >
                    로그아웃
                </button>
            </div>
            <div className="mt-10.5 flex w-full min-w-[500px] shrink-0 rounded-[1.25rem] bg-white px-11.25 pt-7.5 pb-10.5 shadow-banner">
                <div className="flex flex-col items-center gap-7.5">
                    <div className="self-start font-apple text-[1.25rem] text-sub-3">프로필 이미지</div>
                    <div className="h-35 w-35 rounded-full border-[.625rem] border-sub-4">
                        <ProfileImage className="h-full w-full" name={displayName} profileImg={currentProfileImage} />
                    </div>
                    <div className="text-center">
                        <p className="font-apple text-[1.5rem] font-semibold text-sub-1">{displayName}</p>
                        <p className="mt-1 font-apple text-[1rem] text-gray-3">{accountMe.email}</p>
                    </div>
                    <div className="flex h-10.5 w-67.5">
                        <button
                            type="button"
                            className="flex flex-1 items-center justify-center gap-[.25rem] rounded-l-[.3125rem] border-[.0625rem] border-r-0 border-sub-3 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={setRandomImage}
                            disabled={isProfileImageLoading}
                        >
                            <RandomIcon className="h-5 w-5" />
                            <p className="font-apple text-[1.25rem] font-medium text-sub-2.5">랜덤 변경</p>
                        </button>
                        <button
                            type="button"
                            className="flex flex-1 items-center justify-center gap-[.25rem] rounded-r-[.3125rem] border-[.0625rem] border-sub-3 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={handleUploadImage}
                            disabled={isProfileImageLoading}
                        >
                            <CameraIcon className="h-5" />
                            <p className="font-apple text-[1.25rem] font-medium text-sub-2.5">사진 등록</p>
                            <input ref={imageInputRef} type="file" className="hidden" onChange={handleChangeImage} accept="image/*" />
                        </button>
                    </div>
                    <p className="max-w-67.5 text-center font-apple text-[0.875rem] leading-6 text-gray-3">
                        {isProfileImageLoading
                            ? '새 이미지를 업로드하고 있어요. 완료되면 미리보기에 바로 반영돼요.'
                            : '이미지가 없거나 불러오지 못하면 기본 프로필 이미지 또는 이니셜을 보여드려요.'}
                    </p>
                </div>
                <div className="ml-21 flex flex-col justify-between">
                    <div>
                        <label htmlFor="name" className="mb-[.9375rem] block font-apple text-[1.25rem] text-sub-3">
                            이름
                        </label>
                        <TextField
                            id="name"
                            className="h-15 py-4.25 font-apple text-[1.5rem] font-medium text-sub-1"
                            value={writeNurse.name ?? ''}
                            onChange={(e) => handleChange('name', e.target.value)}
                            // error={match(errors.name?.type)
                            //   .with(
                            //     'matches',
                            //     () => '이름은 1~50자 한/영문에 숫자나 특수문자를 사용할 수 없습니다.'
                            //   )
                            //   .otherwise(() => undefined)}
                        />
                    </div>
                    <div className="flex gap-11.25">
                        <div className="flex-1">
                            <label htmlFor="gender" className="mb-[.9375rem] block font-apple text-[1.25rem] text-sub-3">
                                성별
                            </label>
                            <Select
                                id="gender"
                                className="h-15 w-full font-apple text-[1.5rem] font-medium text-sub-1"
                                selectClassName="outline-sub-4 focus:outline-main-1"
                                value={writeNurse.gender ?? '여'}
                                onChange={(e) => handleChange('gender', e.target.value)}
                                options={[
                                    {label: '여', value: '여'},
                                    {label: '남', value: '남'},
                                ]}
                            />
                        </div>
                        <div className="flex-2">
                            <label htmlFor="phoneNum" className="mb-[.9375rem] block font-apple text-[1.25rem] text-sub-3">
                                전화 번호
                            </label>
                            <TextField
                                id="phoneNum"
                                className="h-15 py-4.25 font-apple text-[1.5rem] font-medium text-sub-1"
                                value={writeNurse.phoneNum ?? ''}
                                onChange={(e) => handleChange('phoneNum', e.target.value)}
                                // error={match(errors.phoneNum?.type)
                                //   .with('matches', () => '전화번호 형식을 지켜주세요.')
                                //   .otherwise(() => undefined)}
                                placeholder="01012341234"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-5 w-full min-w-[500px] shrink-0 rounded-[1.25rem] bg-white px-11.25 pt-7.5 pb-15 shadow-banner">
                <div className="w-67.5">
                    <label htmlFor="employmentDate" className="mb-[.9375rem] block font-apple text-[1.25rem] text-sub-3">
                        입사 년도
                    </label>
                    <TextField
                        id="employmentDate"
                        placeholder="YYYY-MM-DD"
                        className="h-15 py-4.25 font-apple text-[1.5rem] font-medium text-sub-1 placeholder:text-center"
                        value={writeNurse.employmentDate ?? ''}
                        onChange={(e) => handleChange('employmentDate', e.target.value)}
                        // error={match(errors.employmentDate?.type)
                        //   .with('matches', () => 'YYYY.MM.DD 형식으로 입력해주세요.')
                        //   .otherwise(() => undefined)}
                    />
                </div>
                <div className="mt-7.5 mb-5 h-[.0625rem] w-full bg-sub-4" />
                <div className="flex flex-1 items-center">
                    <div className="w-67.5">
                        <p className="font-apple text-[1.25rem] text-sub-3">교대 근무자</p>
                        <p className="font-apple text-[.875rem] text-main-2">* 근무표에 본인이 표시되나요?</p>
                    </div>
                    <div className="ml-21 flex gap-7.5">
                        <button
                            type="button"
                            className="flex cursor-pointer items-center justify-center"
                            onClick={() => handleChange('isWorker', true)}
                            aria-pressed={writeNurse.isWorker}
                        >
                            {writeNurse.isWorker ? <CheckedIcon className="h-7.5 w-7.5" /> : <UncheckedIcon className="h-7.5 w-7.5" />}
                            <div className="ml-[.625rem] flex items-center font-apple text-[1.25rem] font-normal text-sub-3">네</div>
                        </button>
                        <button
                            type="button"
                            className="flex cursor-pointer items-center justify-center"
                            onClick={() => handleChange('isWorker', false)}
                            aria-pressed={!writeNurse.isWorker}
                        >
                            {!writeNurse.isWorker ? <CheckedIcon className="h-7.5 w-7.5" /> : <UncheckedIcon className="h-7.5 w-7.5" />}
                            <div className="ml-[.625rem] flex items-center font-apple text-[1.25rem] font-normal text-sub-3">아니오</div>
                        </button>
                    </div>
                </div>
            </div>
            <div className="mt-10 flex w-full items-start justify-between">
                <div className="flex flex-col gap-4">
                    <button
                        type="button"
                        className="cursor-pointer font-apple text-[1.25rem] font-medium text-sub-2.5 underline underline-offset-2"
                        onClick={deleteAccount}
                    >
                        회원 탈퇴
                    </button>
                    <button
                        type="button"
                        className="cursor-pointer font-apple text-[1.25rem] font-medium text-sub-2.5 underline underline-offset-2"
                        onClick={quitWard}
                    >
                        병동 나가기
                    </button>
                </div>
                <div className="flex flex-col items-end gap-3">
                    {isProfileImageLoading ? (
                        <p className="font-apple text-[0.9375rem] text-gray-3">이미지 업로드가 끝나면 저장할 수 있어요.</p>
                    ) : null}
                    <Button
                        onClick={() => void save()}
                        className="h-15 w-30 text-center text-[2rem] font-semibold"
                        disabled={isSaveDisabled}
                    >
                        저장
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default ProfilePage;
