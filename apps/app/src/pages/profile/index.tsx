import {cn} from '@dutying/utils/style';
import {useQuery} from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';
import {type ChangeEvent, useEffect, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {ProfileImage} from '@/entities/account/ui/profile-image';
import {type TNurse} from '@/entities/nurse';
import {wardQueryOptions} from '@/entities/ward';
import {useEditAccount} from '@/features/account/model';
import useAuth from '@/features/auth';
import useProfileImage from '@/features/file';
import {CameraIcon, RandomIcon} from '@/shared/assets/svg';
import ROUTE from '@/shared/constant/path';
import Card from '@/shared/ui/Card';
import PageState from '@/shared/ui/PageState';
import {Button} from '@/shared/ui/primitives/button';
import {findProfileNurse, getCurrentProfileImage, getProfileDisplayName, isProfileFormDirty} from './model';

type TProfileField = 'name' | 'phoneNum';
type TProfileErrors = Partial<Record<TProfileField, string>>;
type TProfileTouched = Partial<Record<TProfileField, boolean>>;

const NURSE_NAME_MAX_LENGTH = 20;
const NURSE_NAME_ALLOWED_REGEXP = /^[A-Za-zㄱ-ㅎㅏ-ㅣ가-힣ぁ-ゟ゠-ヿ一-龯々\s'’\-·・]+$/u;
const NURSE_NAME_INPUT_SANITIZE_REGEXP = /[^A-Za-zㄱ-ㅎㅏ-ㅣ가-힣ぁ-ゟ゠-ヿ一-龯々\s'’\-·・]/gu;
const FIELD_CLASS =
    'h-11 w-full rounded-[12px] border border-transparent bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';
const sanitizeNurseNameInput = (rawValue: string) => rawValue.replace(NURSE_NAME_INPUT_SANITIZE_REGEXP, '').slice(0, NURSE_NAME_MAX_LENGTH);
const normalizePhone = (value: string) => value.replace(/\D/g, '').slice(0, 11);
const validateName = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) return '이름을 입력해 주세요.';

    if (trimmed.length > NURSE_NAME_MAX_LENGTH || !NURSE_NAME_ALLOWED_REGEXP.test(trimmed)) {
        return "이름은 20자 이하, 한글/영문/일문과 공백, '-', '·'만 입력할 수 있어요.";
    }

    return undefined;
};
const validatePhoneNum = (value: string) => {
    const digits = normalizePhone(value);

    if (!digits) return '전화번호를 입력해 주세요.';

    if (!/^01([0|1|6|7|8|9])([0-9]{3,4})([0-9]{4})$/.test(digits)) {
        return '전화번호는 01012341234처럼 숫자만 입력해 주세요.';
    }

    return undefined;
};

function ProfilePage() {
    const {
        state: {accountMe, accountMeStatus, _loaded},
        actions: {handleGetAccountMe, handleLogout},
    } = useAuth();
    const {quitWard, handleEditProfile, handleEditAccountBasic, deleteAccount} = useEditAccount();
    const [writeNurse, setWriteNurse] = useState<TNurse | null>(null);
    const [draftName, setDraftName] = useState('');
    const [fieldErrors, setFieldErrors] = useState<TProfileErrors>({});
    const [fieldTouched, setFieldTouched] = useState<TProfileTouched>({});
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
    const hasNurseProfile = Boolean(selectedNurse && writeNurse);
    const isDirty = isProfileFormDirty({
        originalNurse: selectedNurse,
        draftNurse: writeNurse,
        profileImg,
    });
    const isSaveDisabled = isProfileImageLoading || (hasNurseProfile ? !isDirty : !draftName.trim() && !profileImg);
    const validateField = (field: TProfileField, value: string) => {
        if (field === 'name') return validateName(value);

        return validatePhoneNum(value);
    };
    const setFieldError = (field: TProfileField, value: string) => {
        const message = validateField(field, value);

        setFieldErrors((prev) => ({...prev, [field]: message}));

        return message;
    };
    const validateForm = () => {
        if (!writeNurse) return false;

        const nextErrors: TProfileErrors = {
            name: validateName(writeNurse.name ?? ''),
            phoneNum: validatePhoneNum(writeNurse.phoneNum ?? ''),
        };

        setFieldErrors(nextErrors);
        setFieldTouched({name: true, phoneNum: true});

        return !nextErrors.name && !nextErrors.phoneNum;
    };
    const handleChange = <T extends keyof TNurse>(key: T, value: TNurse[T]) => {
        if (!writeNurse) return;

        setWriteNurse({...writeNurse, [key]: value});
    };
    const save = async () => {
        let isSaved = false;

        if (writeNurse) {
            if (!validateForm()) return;

            isSaved = await handleEditProfile(writeNurse, currentProfileImage);
        } else {
            const nextName = (draftName.trim() || accountMe?.name) ?? '';
            const nameError = validateName(nextName);

            if (nameError) {
                setFieldErrors({name: nameError});
                setFieldTouched({name: true});

                return;
            }

            if (!nextName) return;

            isSaved = await handleEditAccountBasic(nextName, currentProfileImage);
        }

        if (isSaved) {
            resetProfileImage();
        }
    };

    useEffect(() => {
        if (!selectedNurse) {
            setWriteNurse(null);
            setDraftName(accountMe?.name ?? '');

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
        setFieldErrors({});
        setFieldTouched({});
    }, [accountMe?.name, profileImg, selectedNurse]);

    const imageInputRef = useRef<HTMLInputElement>(null);
    const handleUploadImage = () => {
        imageInputRef.current?.click();
    };
    const handleChangeImage = async (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length < 1) {
            e.target.value = '';

            return;
        }

        try {
            const compressedFile = await imageCompression(e.target.files[0], {
                maxSizeMB: 1,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
            });

            await setPhotoImage(compressedFile);
        } catch {
            toast.error('프로필 이미지를 처리하지 못했어요.');
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

    return (
        <div className="mx-auto w-full max-w-[560px] px-4 py-8 md:px-0">
            <div className="mx-auto flex max-w-[480px] items-start justify-between gap-4">
                <div>
                    <h1 className="font-apple text-[32px] font-semibold tracking-[-0.02em] text-sub-1">계정 관리</h1>
                    <p className="mt-1 font-apple text-sm text-gray-3">
                        {isDirty ? '변경 사항이 있어요. 저장해 주세요.' : '최신 정보가 저장되어 있어요.'}
                    </p>
                </div>
            </div>

            <div className="mx-auto mt-6 max-w-[480px] space-y-4">
                <Card className="rounded-[24px] border-transparent p-6">
                    <p className="font-apple text-sm font-semibold text-sub-2.5">프로필</p>
                    <div className="mt-4 flex items-center gap-4">
                        <div className="h-20 w-20 shrink-0 rounded-full bg-main-4 p-1">
                            <ProfileImage className="h-full w-full" name={displayName} profileImg={currentProfileImage} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-apple text-lg font-semibold text-sub-1">{displayName}</p>
                            <p className="mt-1 truncate font-apple text-xs text-gray-3">{accountMe.email}</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-gray-2 h-9 w-9 rounded-full bg-gray-7 hover:bg-gray-6"
                                onClick={setRandomImage}
                                disabled={isProfileImageLoading}
                                aria-label="랜덤 아바타"
                                title="랜덤 아바타"
                            >
                                <RandomIcon className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-gray-2 h-9 w-9 rounded-full bg-gray-7 hover:bg-gray-6"
                                onClick={handleUploadImage}
                                disabled={isProfileImageLoading}
                                aria-label="사진 업로드"
                                title="사진 업로드"
                            >
                                <CameraIcon className="h-4 w-4" />
                            </Button>
                        </div>
                        <input ref={imageInputRef} type="file" className="hidden" onChange={handleChangeImage} accept="image/*" />
                    </div>
                </Card>

                <Card className="rounded-[24px] border-transparent p-6">
                    <h2 className="font-apple text-[20px] font-semibold text-sub-1">기본 정보</h2>
                    <p className="mt-1 font-apple text-xs text-gray-3">계정에서 사용하는 정보를 관리해요.</p>
                    <div className="mt-4 grid grid-cols-1 gap-3">
                        <div className="max-w-[440px]">
                            <label htmlFor="name" className="mb-1.5 block font-apple text-sm font-medium text-sub-2">
                                이름
                            </label>
                            <input
                                id="name"
                                className={cn(FIELD_CLASS, fieldErrors.name && 'border-red bg-[#FFF7F8] focus-visible:bg-white')}
                                maxLength={NURSE_NAME_MAX_LENGTH}
                                placeholder="이름을 입력하세요"
                                value={writeNurse?.name ?? draftName}
                                onChange={(e) => {
                                    const nextValue = sanitizeNurseNameInput(e.target.value);

                                    if (writeNurse) {
                                        handleChange('name', nextValue);
                                    } else {
                                        setDraftName(nextValue);
                                    }

                                    if (fieldTouched.name) setFieldError('name', nextValue);
                                }}
                                onBlur={(e) => {
                                    setFieldTouched((prev) => ({...prev, name: true}));
                                    setFieldError('name', e.target.value);
                                }}
                                aria-invalid={Boolean(fieldErrors.name)}
                                aria-describedby={fieldErrors.name ? 'profile-name-error' : undefined}
                            />
                            {fieldErrors.name ? (
                                <p id="profile-name-error" className="mt-1 font-apple text-xs text-red">
                                    {fieldErrors.name}
                                </p>
                            ) : null}
                        </div>
                        <div className="max-w-[440px]">
                            <label htmlFor="phoneNum" className="mb-1.5 block font-apple text-sm font-medium text-sub-2">
                                전화번호
                            </label>
                            <input
                                id="phoneNum"
                                inputMode="numeric"
                                className={cn(
                                    FIELD_CLASS,
                                    fieldErrors.phoneNum && 'border-red bg-[#FFF7F8] focus-visible:bg-white',
                                    !writeNurse && 'cursor-not-allowed text-gray-4',
                                )}
                                placeholder="전화번호를 입력하세요"
                                value={writeNurse?.phoneNum ?? ''}
                                onChange={(e) => {
                                    const nextValue = normalizePhone(e.target.value);

                                    if (!writeNurse) return;

                                    handleChange('phoneNum', nextValue);

                                    if (fieldTouched.phoneNum) setFieldError('phoneNum', nextValue);
                                }}
                                onBlur={(e) => {
                                    setFieldTouched((prev) => ({...prev, phoneNum: true}));
                                    setFieldError('phoneNum', e.target.value);
                                }}
                                aria-invalid={Boolean(fieldErrors.phoneNum)}
                                aria-describedby={fieldErrors.phoneNum ? 'profile-phone-error' : undefined}
                                disabled={!writeNurse}
                            />
                            {fieldErrors.phoneNum ? (
                                <p id="profile-phone-error" className="mt-1 font-apple text-xs text-red">
                                    {fieldErrors.phoneNum}
                                </p>
                            ) : !writeNurse ? (
                                <p className="mt-1 font-apple text-xs text-gray-3">병동 연결 후 수정할 수 있어요.</p>
                            ) : null}
                        </div>
                    </div>
                </Card>
                <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 px-1">
                    <button
                        type="button"
                        className="cursor-pointer bg-transparent p-0 font-apple text-sm font-medium text-gray-3 underline-offset-4 hover:underline"
                        onClick={() => handleLogout(ROUTE.ROOT)}
                    >
                        로그아웃
                    </button>
                    {accountMe.wardId ? (
                        <button
                            type="button"
                            className="cursor-pointer bg-transparent p-0 font-apple text-sm font-medium text-gray-3 underline-offset-4 hover:underline"
                            onClick={quitWard}
                        >
                            병동 나가기
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="cursor-pointer bg-transparent p-0 font-apple text-sm font-medium text-red underline-offset-4 hover:underline"
                        onClick={deleteAccount}
                    >
                        회원 탈퇴
                    </button>
                </div>
            </div>

            <div className="sticky bottom-3 mx-auto mt-4 flex max-w-[480px] items-center justify-end py-2">
                <Button type="button" onClick={() => void save()} disabled={isSaveDisabled} className="h-11 rounded-[12px] px-5 text-sm">
                    변경사항 저장
                </Button>
            </div>
        </div>
    );
}

export default ProfilePage;
