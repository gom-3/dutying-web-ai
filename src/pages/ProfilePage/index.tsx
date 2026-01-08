import imageCompression from 'browser-image-compression';
import {type ChangeEvent, useEffect, useRef, useState} from 'react';
import useEditAccount from '@/features/account/useEditAccount';
import useAuth from '@/features/auth/useAuth';
import useProfileImage from '@/features/file/useProfileImage';
import {ProfileImage} from '@/features/ProfileImage';
import useEditShiftTeam from '@/features/ward/useEditShiftTeam';
import {CameraIcon, CheckedIcon, RandomIcon, UncheckedIcon} from '@/shared/assets/svg';
import ROUTE from '@/shared/constant/path';
import {type Nurse} from '@/shared/types/nurse';
import Button from '@/shared/ui/Button';
import Select from '@/shared/ui/Select';
import TextField from '@/shared/ui/TextField';

function ProfilePage() {
    const {
        state: {shiftTeams, selectedNurse},
        actions: {selectNurse},
    } = useEditShiftTeam();
    const {
        state: {accountMe},
        actions: {handleLogout},
    } = useAuth();
    const {handleEditProfile, deleteAccount, quitWard} = useEditAccount();
    const [writeNurse, setWriteNurse] = useState<Nurse | null>(null);
    const {profileImg, setRandomImage, setPhotoImage} = useProfileImage();
    const handleChange = <T extends keyof Nurse>(key: T, value: Nurse[T]) => {
        if (!writeNurse) return;

        setWriteNurse({...writeNurse, [key]: value});
    };
    const save = () => {
        if (!writeNurse || !profileImg) return;

        handleEditProfile(writeNurse, profileImg);
    };

    useEffect(() => {
        if (shiftTeams && accountMe)
            selectNurse(shiftTeams.flatMap((x) => x.nurses).find((x) => x.accountId === accountMe.accountId)?.nurseId ?? null);
    }, [accountMe, selectNurse, shiftTeams]);

    useEffect(() => {
        if (selectedNurse && accountMe && selectedNurse?.accountId === accountMe?.accountId) {
            setWriteNurse(selectedNurse);
        }
    }, [selectedNurse, accountMe]);

    const imageInputRef = useRef<HTMLInputElement>(null);
    const handleUploadImgae = () => {
        imageInputRef.current?.click();
    };
    const handleChangeImage = async (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length < 1) return;

        const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
        };

        try {
            const compressedFile = await imageCompression(e.target.files[0], options);

            setPhotoImage(compressedFile);
        } catch (error) {
            console.log(error);
        }
    };

    return (
        <div className="mx-auto flex h-full w-full max-w-306 flex-col items-center justify-center px-8">
            <div className="flex w-full items-center justify-between">
                <h1 className="font-apple text-[2rem] font-semibold text-text-1">프로필 설정</h1>
                <button
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
                        <ProfileImage className="h-full w-full" profileImg={profileImg ?? {profileImgUrl: accountMe?.profileImgUrl}} />
                    </div>
                    <div className="flex h-10.5 w-67.5 cursor-pointer">
                        <div
                            className="flex flex-1 items-center justify-center gap-[.25rem] rounded-l-[.3125rem] border-[.0625rem] border-r-0 border-sub-3"
                            onClick={setRandomImage}
                        >
                            <RandomIcon className="h-5 w-5" />
                            <p className="font-apple text-[1.25rem] font-medium text-sub-2.5">랜덤 변경</p>
                        </div>
                        <div
                            className="flex flex-1 items-center justify-center gap-[.25rem] rounded-r-[.3125rem] border-[.0625rem] border-sub-3"
                            onClick={handleUploadImgae}
                        >
                            <CameraIcon className="h-5" />
                            <p className="font-apple text-[1.25rem] font-medium text-sub-2.5">사진 등록</p>
                            <input ref={imageInputRef} type="file" className="hidden" onChange={handleChangeImage} accept="image/*" />
                        </div>
                    </div>
                </div>
                <div className="ml-21 flex flex-col justify-between">
                    <div>
                        <label htmlFor="name" className="mb-[.9375rem] block font-apple text-[1.25rem] text-sub-3">
                            이름
                        </label>
                        <TextField
                            id="name"
                            className="h-15 py-4.25 font-apple text-[1.5rem] font-medium text-sub-1"
                            value={writeNurse?.name}
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
                                value={writeNurse?.gender}
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
                                value={writeNurse?.phoneNum}
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
                        value={writeNurse?.employmentDate}
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
                        <div className="flex cursor-pointer items-center justify-center" onClick={() => handleChange('isWorker', true)}>
                            {writeNurse?.isWorker ? <CheckedIcon className="h-7.5 w-7.5" /> : <UncheckedIcon className="h-7.5 w-7.5" />}
                            <div className="ml-[.625rem] flex items-center font-apple text-[1.25rem] font-normal text-sub-3">네</div>
                        </div>
                        <div className="flex cursor-pointer items-center justify-center" onClick={() => handleChange('isWorker', false)}>
                            {!writeNurse?.isWorker ? <CheckedIcon className="h-7.5 w-7.5" /> : <UncheckedIcon className="h-7.5 w-7.5" />}
                            <div className="ml-[.625rem] flex items-center font-apple text-[1.25rem] font-normal text-sub-3">아니오</div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="mt-10 flex w-full items-start justify-between">
                <div className="flex flex-col gap-4">
                    <div
                        className="cursor-pointer font-apple text-[1.25rem] font-medium text-sub-2.5 underline underline-offset-2"
                        onClick={deleteAccount}
                    >
                        회원 탈퇴
                    </div>
                    <div
                        className="cursor-pointer font-apple text-[1.25rem] font-medium text-sub-2.5 underline underline-offset-2"
                        onClick={quitWard}
                    >
                        병동 나가기
                    </div>
                </div>
                <Button
                    onClick={() => save()}
                    className="h-15 w-30 text-center text-[2rem] font-semibold"
                    disabled={
                        selectedNurse?.name === writeNurse?.name &&
                        selectedNurse?.employmentDate === writeNurse?.employmentDate &&
                        selectedNurse?.phoneNum === writeNurse?.phoneNum &&
                        selectedNurse?.isWorker === writeNurse?.isWorker &&
                        selectedNurse?.isDutyManager === writeNurse?.isDutyManager &&
                        selectedNurse?.memo === writeNurse?.memo &&
                        selectedNurse?.nurseShiftTypes.length === writeNurse?.nurseShiftTypes.length &&
                        !profileImg
                    }
                >
                    저장
                </Button>
            </div>
        </div>
    );
}

export default ProfilePage;
