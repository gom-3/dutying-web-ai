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
import ConfirmActionDialog from '@/shared/ui/ConfirmActionDialog';
import PageState from '@/shared/ui/PageState';
import {Button} from '@/shared/ui/primitives/button';
import {findProfileNurse, getCurrentProfileImage, getProfileDisplayName, getProfilePhoneNum, isProfileFormDirty} from './model';

type TProfileField = 'name' | 'phoneNum';
type TProfileErrors = Partial<Record<TProfileField, string>>;
type TProfileTouched = Partial<Record<TProfileField, boolean>>;
type TConfirmAction = 'logout' | 'deleteAccount';
type TProfileContentProps = {
    layout?: 'page' | 'modal';
};

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

export function ProfileContent({layout = 'page'}: TProfileContentProps = {}) {
    const {
        state: {accountMe, accountMeStatus, _loaded},
        actions: {handleGetAccountMe, handleLogout},
    } = useAuth();
    const {quitWard, handleEditProfile, handleEditAccountBasic, deleteAccount} = useEditAccount();
    const [writeNurse, setWriteNurse] = useState<TNurse | null>(null);
    const [draftName, setDraftName] = useState('');
    const [draftPhoneNum, setDraftPhoneNum] = useState('');
    const [hasEditedPhoneNum, setHasEditedPhoneNum] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<TProfileErrors>({});
    const [fieldTouched, setFieldTouched] = useState<TProfileTouched>({});
    const [confirmAction, setConfirmAction] = useState<TConfirmAction | null>(null);
    const {profileImg, isLoading: isProfileImageLoading, setRandomImage, setPhotoImage, resetProfileImage} = useProfileImage();
    const wardQuery = useQuery({
        ...wardQueryOptions.id(accountMe?.wardId ?? 0),
        enabled: Boolean(accountMe?.wardId),
    });
    const selectedNurse = findProfileNurse(wardQuery.data, accountMe?.accountId);
    const displayName = getProfileDisplayName(writeNurse, accountMe);
    const phoneInputValue = writeNurse
        ? hasEditedPhoneNum
            ? (writeNurse.phoneNum ?? '')
            : getProfilePhoneNum(writeNurse, accountMe)
        : draftPhoneNum;
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
    const isAccountFormDirty =
        Boolean(profileImg) ||
        draftName.trim() !== (accountMe?.name ?? '').trim() ||
        draftPhoneNum !== normalizePhone(accountMe?.phoneNum ?? '');
    const hasUnsavedChanges = hasNurseProfile ? isDirty : isAccountFormDirty;
    const isSaveDisabled = isProfileImageLoading || !hasUnsavedChanges;
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

        const phoneNum = hasEditedPhoneNum ? (writeNurse.phoneNum ?? '') : getProfilePhoneNum(writeNurse, accountMe);
        const nextErrors: TProfileErrors = {
            name: validateName(writeNurse.name ?? ''),
            phoneNum: validatePhoneNum(phoneNum),
        };

        setFieldErrors(nextErrors);
        setFieldTouched({name: true, phoneNum: true});

        return !nextErrors.name && !nextErrors.phoneNum;
    };
    const validateAccountForm = () => {
        const nextName = (draftName.trim() || accountMe?.name) ?? '';
        const nextErrors: TProfileErrors = {
            name: validateName(nextName),
            phoneNum: validatePhoneNum(draftPhoneNum),
        };

        setFieldErrors(nextErrors);
        setFieldTouched({name: true, phoneNum: true});

        return {isValid: !nextErrors.name && !nextErrors.phoneNum, name: nextName, phoneNum: draftPhoneNum};
    };
    const handleChange = <T extends keyof TNurse>(key: T, value: TNurse[T]) => {
        if (!writeNurse) return;

        setWriteNurse({...writeNurse, [key]: value});
    };
    const save = async () => {
        let isSaved = false;

        if (writeNurse) {
            if (!validateForm()) return;

            const phoneNum = hasEditedPhoneNum ? (writeNurse.phoneNum ?? '') : getProfilePhoneNum(writeNurse, accountMe);

            isSaved = await handleEditProfile({...writeNurse, phoneNum}, currentProfileImage);
        } else {
            const {isValid, name, phoneNum} = validateAccountForm();

            if (!isValid) return;

            isSaved = await handleEditAccountBasic(name, currentProfileImage, phoneNum);
        }

        if (isSaved) {
            setHasEditedPhoneNum(false);
            resetProfileImage();
        }
    };

    useEffect(() => {
        if (selectedNurse) return;

        setWriteNurse(null);
        setDraftName(accountMe?.name ?? '');
        setDraftPhoneNum(normalizePhone(accountMe?.phoneNum ?? ''));
        setHasEditedPhoneNum(false);
        setFieldErrors({});
        setFieldTouched({});
    }, [accountMe?.accountId, accountMe?.name, accountMe?.phoneNum, selectedNurse]);

    useEffect(() => {
        if (!selectedNurse) return;

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
    }, [profileImg, selectedNurse]);

    useEffect(() => {
        setHasEditedPhoneNum(false);
    }, [accountMe?.accountId, selectedNurse?.nurseId]);

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
    const closeConfirmDialog = () => {
        setConfirmAction(null);
    };
    const confirmActionDialog = () => {
        const action = confirmAction;

        closeConfirmDialog();

        if (action === 'logout') {
            void handleLogout(ROUTE.ROOT);
        }

        if (action === 'deleteAccount') {
            void deleteAccount();
        }
    };
    const confirmDialogContent =
        confirmAction === 'deleteAccount'
            ? {
                  title: '회원 탈퇴할까요?',
                  description: '탈퇴하면 계정 정보가 삭제되며 되돌릴 수 없어요.',
                  confirmLabel: '탈퇴하기',
                  tone: 'danger' as const,
              }
            : {
                  title: '로그아웃할까요?',
                  description: '현재 계정에서 로그아웃하고 첫 화면으로 이동해요.',
                  confirmLabel: '로그아웃',
                  tone: 'default' as const,
              };
    const isModalLayout = layout === 'modal';
    const stateContainerClassName = cn(
        'mx-auto flex w-full items-center justify-center px-8',
        isModalLayout ? 'min-h-[360px] max-w-[560px] py-8' : 'h-full max-w-306',
    );
    const rootClassName = cn('mx-auto w-full', isModalLayout ? 'max-w-none px-6 pt-8 pb-5 sm:px-8' : 'max-w-[560px] px-4 py-8 md:px-0');
    const headerClassName = cn('mx-auto flex items-start justify-between gap-4', isModalLayout ? 'max-w-none pr-10' : 'max-w-[480px]');
    const titleClassName = cn(
        'font-apple font-semibold text-sub-1',
        isModalLayout ? 'text-[26px] leading-8 tracking-[-0.01em]' : 'text-[32px] tracking-[-0.02em]',
    );
    const title = '마이페이지';
    const descriptionText = hasUnsavedChanges
        ? '변경사항이 저장되지 않았어요.'
        : isModalLayout
          ? null
          : '최신 정보가 저장되어 있어요.';
    const contentClassName = cn('mx-auto', isModalLayout ? 'mt-6 max-w-none space-y-6' : 'mt-6 max-w-[480px] space-y-4');
    const profileSectionClassName = isModalLayout ? 'rounded-none border-0 bg-white p-0' : 'rounded-[24px] border-transparent p-6';
    const basicInfoSectionClassName = isModalLayout
        ? 'rounded-none border-0 border-t border-[#F2F4F6] bg-white px-0 pt-6 pb-0'
        : 'rounded-[24px] border-transparent p-6';
    const profileImageFrameClassName = cn('shrink-0 rounded-full bg-[#F2F4F6]', isModalLayout ? 'h-16 w-16 p-0.5' : 'h-20 w-20 p-1');
    const profileImageButtonClassName = cn(
        'rounded-full text-[#6B7684] hover:bg-[#E5E8EB] hover:text-[#333D4B]',
        isModalLayout ? 'h-9 w-9 bg-[#F2F4F6]' : 'h-9 w-9 bg-gray-7',
    );
    const fieldContainerClassName = isModalLayout ? 'w-full' : 'max-w-[440px]';
    const accountActionsClassName = cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-1', isModalLayout ? 'justify-start' : 'justify-end');
    const saveButtonClassName = cn(
        'h-11 rounded-[10px] px-5 text-sm shadow-none',
        isModalLayout ? 'w-full bg-[#3182F6] font-semibold hover:bg-[#1B64DA] sm:w-auto' : '',
    );
    const modalFieldClassName = isModalLayout ? 'h-12 rounded-[10px] bg-[#F9FAFB] px-4 text-[15px]' : '';

    if (isAccountBootstrapPending || isWardProfilePending) {
        return (
            <div className={stateContainerClassName}>
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
            <div className={stateContainerClassName}>
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

    const accountActionButtons = (
        <div className={accountActionsClassName}>
            <button
                type="button"
                className="cursor-pointer bg-transparent p-0 font-apple text-sm font-medium text-gray-3 underline-offset-4 hover:underline"
                onClick={() => setConfirmAction('logout')}
            >
                로그아웃
            </button>
            {!isModalLayout && accountMe.wardId ? (
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
                onClick={() => setConfirmAction('deleteAccount')}
            >
                회원 탈퇴
            </button>
        </div>
    );
    const saveButton = (
        <Button type="button" onClick={() => void save()} disabled={isSaveDisabled} className={saveButtonClassName}>
            {isModalLayout ? '저장하기' : '변경사항 저장'}
        </Button>
    );

    return (
        <div className={rootClassName}>
            <div className={headerClassName}>
                <div>
                    <h1 className={titleClassName}>{title}</h1>
                    {descriptionText ? <p className="mt-1.5 font-apple text-sm text-gray-3">{descriptionText}</p> : null}
                </div>
            </div>

            <div className={contentClassName}>
                <Card className={profileSectionClassName}>
                    {isModalLayout ? null : <p className="font-apple text-sm font-semibold text-sub-2.5">프로필</p>}
                    <div className={cn('flex items-center gap-4', isModalLayout ? '' : 'mt-4')}>
                        <div className={profileImageFrameClassName}>
                            <ProfileImage className="h-full w-full" name={displayName} profileImg={currentProfileImage} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-apple text-[17px] leading-6 font-semibold text-[#191F28]">{displayName}</p>
                            <p className="mt-0.5 truncate font-apple text-[13px] leading-5 text-[#8B95A1]">{accountMe.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={profileImageButtonClassName}
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
                                className={profileImageButtonClassName}
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

                <Card className={basicInfoSectionClassName}>
                    {isModalLayout ? null : (
                        <>
                            <h2 className="font-apple text-[20px] font-semibold text-sub-1">기본 정보</h2>
                            <p className="mt-1 font-apple text-[13px] leading-5 text-[#8B95A1]">계정에서 사용하는 정보를 관리해요.</p>
                        </>
                    )}
                    <div className={cn('grid grid-cols-1', isModalLayout ? 'gap-4' : 'mt-4 gap-3')}>
                        <div className={fieldContainerClassName}>
                            <label htmlFor="name" className="mb-1.5 block font-apple text-[13px] font-medium text-[#4E5968]">
                                이름
                            </label>
                            <input
                                id="name"
                                className={cn(
                                    FIELD_CLASS,
                                    modalFieldClassName,
                                    fieldErrors.name && 'border-red bg-[#FFF7F8] focus-visible:bg-white',
                                )}
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
                        <div className={fieldContainerClassName}>
                            <label htmlFor="phoneNum" className="mb-1.5 block font-apple text-[13px] font-medium text-[#4E5968]">
                                전화번호
                            </label>
                            <input
                                id="phoneNum"
                                inputMode="numeric"
                                className={cn(
                                    FIELD_CLASS,
                                    modalFieldClassName,
                                    fieldErrors.phoneNum && 'border-red bg-[#FFF7F8] focus-visible:bg-white',
                                )}
                                placeholder="전화번호를 입력하세요"
                                value={phoneInputValue}
                                onChange={(e) => {
                                    const nextValue = normalizePhone(e.target.value);

                                    if (writeNurse) {
                                        setHasEditedPhoneNum(true);
                                        handleChange('phoneNum', nextValue);
                                    } else {
                                        setDraftPhoneNum(nextValue);
                                    }

                                    if (fieldTouched.phoneNum) setFieldError('phoneNum', nextValue);
                                }}
                                onBlur={(e) => {
                                    setFieldTouched((prev) => ({...prev, phoneNum: true}));
                                    setFieldError('phoneNum', e.target.value);
                                }}
                                aria-invalid={Boolean(fieldErrors.phoneNum)}
                                aria-describedby={fieldErrors.phoneNum ? 'profile-phone-error' : undefined}
                            />
                            {fieldErrors.phoneNum ? (
                                <p id="profile-phone-error" className="mt-1 font-apple text-xs text-red">
                                    {fieldErrors.phoneNum}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </Card>
                {isModalLayout ? null : accountActionButtons}
            </div>

            {isModalLayout ? (
                <div className="mt-6 flex flex-col gap-4 border-t border-[#F2F4F6] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    {accountActionButtons}
                    {saveButton}
                </div>
            ) : (
                <div className="sticky bottom-3 mx-auto mt-4 flex max-w-[480px] items-center justify-end py-2">{saveButton}</div>
            )}
            <ConfirmActionDialog
                open={confirmAction !== null}
                title={confirmDialogContent.title}
                description={confirmDialogContent.description}
                confirmLabel={confirmDialogContent.confirmLabel}
                tone={confirmDialogContent.tone}
                onClose={closeConfirmDialog}
                onConfirm={confirmActionDialog}
            />
        </div>
    );
}

function ProfilePage() {
    return <ProfileContent />;
}

export default ProfilePage;
