import type {TPreferredLanguage} from '@dutying/domain';
import {cn} from '@dutying/utils/style';
import {useQuery} from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';
import {ChevronDown, Languages, UserRound} from 'lucide-react';
import {type ChangeEvent, useEffect, useId, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {useTranslation} from 'react-i18next';
import {ProfileImage} from '@/entities/account/ui/profile-image';
import {type TNurse} from '@/entities/nurse';
import {wardQueryOptions} from '@/entities/ward';
import {useEditAccount} from '@/features/account/model';
import useAuth from '@/features/auth';
import {isWardAdminAccessToken} from '@/features/auth/model/admin-token';
import useProfileImage from '@/features/file';
import {CameraIcon, RandomIcon} from '@/shared/assets/svg';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {
    DEFAULT_PREFERRED_LANGUAGE,
    getDefaultServiceRegionForLanguage,
    normalizePreferredLanguage,
    setStoredServiceRegion,
    SUPPORTED_LANGUAGES,
} from '@/shared/i18n/locale';
import {formatBirthDateInput, getTodayDateKey, isValidBirthDate, normalizeBirthDateForStorage} from '@/shared/lib/birth-date';
import {
    CONTACT_PHONE_MAX_LENGTH,
    isValidContactPhone,
    normalizeContactPhoneForStorage,
    sanitizeContactPhoneInput,
} from '@/shared/lib/contact-phone';
import {isValidNurseName, NURSE_NAME_MAX_LENGTH, normalizeNurseNameForRequest, sanitizeNurseNameInput} from '@/shared/lib/nurse-name';
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

const FIELD_CLASS =
    'h-11 w-full rounded-[12px] border border-transparent bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';
const SELECT_FIELD_CLASS =
    'h-11 w-full rounded-[12px] border border-transparent bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors focus-visible:bg-main-light';
const LANGUAGE_OPTIONS = SUPPORTED_LANGUAGES;
const validateName = (value: string, messages: {required: string; invalid: string}) => {
    const requestName = normalizeNurseNameForRequest(value);

    if (!requestName) return messages.required;

    if (!isValidNurseName(value)) {
        return messages.invalid;
    }

    return undefined;
};
const validatePhoneNum = (
    value: string,
    serviceRegion: ReturnType<typeof getDefaultServiceRegionForLanguage>,
    messages: {required: string; invalid: string},
) => {
    const normalizedValue = normalizeContactPhoneForStorage(value);

    if (!normalizedValue) return messages.required;

    if (!isValidContactPhone(normalizedValue, serviceRegion)) {
        return messages.invalid;
    }

    return undefined;
};

type TLanguageSelectProps = {
    id: string;
    labelId: string;
    value: TPreferredLanguage;
    options: readonly TPreferredLanguage[];
    getOptionLabel: (language: TPreferredLanguage) => string;
    onChange: (language: TPreferredLanguage) => void;
    className?: string;
    buttonClassName?: string;
};

function LanguageSelect({id, labelId, value, options, getOptionLabel, onChange, className, buttonClassName}: TLanguageSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const selectedValueId = useId();
    const selectedLabel = getOptionLabel(value);

    useEffect(() => {
        if (!isOpen) return;

        const closeOnOutsideClick = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);

        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [isOpen]);

    return (
        <div ref={rootRef} className={cn('relative', className)}>
            <button
                id={id}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-labelledby={`${labelId} ${selectedValueId}`}
                className={cn(
                    SELECT_FIELD_CLASS,
                    'flex items-center justify-between gap-3 text-left focus-visible:outline-2 focus-visible:outline-main-1',
                    isOpen && 'bg-white shadow-[0px_10px_28px_rgba(95,100,135,0.16)]',
                    buttonClassName,
                )}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span id={selectedValueId} className="min-w-0 truncate">
                    {selectedLabel}
                </span>
                <ChevronDown aria-hidden="true" className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen ? (
                <div
                    role="listbox"
                    aria-labelledby={labelId}
                    className="absolute top-full right-0 left-0 z-30 mt-1 animate-in overflow-hidden rounded-[12px] border border-gray-6 bg-white py-1 shadow-[0px_10px_28px_rgba(95,100,135,0.16)] duration-150 fade-in-0 zoom-in-95 slide-in-from-top-1"
                >
                    {options.map((language) => {
                        const isSelected = language === value;

                        return (
                            <button
                                key={language}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                className={cn(
                                    'flex w-full items-center px-4 py-2.5 text-left font-apple text-[15px] transition-colors hover:bg-gray-7 focus-visible:outline-2 focus-visible:outline-main-1',
                                    isSelected ? 'bg-main-light font-semibold text-main-1' : 'text-sub-1',
                                )}
                                onClick={() => {
                                    onChange(language);
                                    setIsOpen(false);
                                }}
                            >
                                {getOptionLabel(language)}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

export function ProfileContent({layout = 'page'}: TProfileContentProps = {}) {
    const {t} = useTypedTranslation();
    const {i18n} = useTranslation();
    const isModalLayout = layout === 'modal';
    const {
        state: {accountMe, accountMeStatus, _loaded, accessToken},
        actions: {handleGetAccountMe, handleLogout},
    } = useAuth();
    const {quitWard, handleEditProfile, handleEditAccountBasic, updateBirthDate, updateAccountPreferences, deleteAccount} =
        useEditAccount();
    const [writeNurse, setWriteNurse] = useState<TNurse | null>(null);
    const [draftName, setDraftName] = useState('');
    const [draftPhoneNum, setDraftPhoneNum] = useState('');
    const [draftBirthDate, setDraftBirthDate] = useState('');
    const [draftPreferredLanguage, setDraftPreferredLanguage] = useState<TPreferredLanguage>('ko');
    const [isSavingPreferences, setIsSavingPreferences] = useState(false);
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
    const isWardAdmin = isWardAdminAccessToken(accessToken);
    const savedBirthDate = accountMe?.birthDate ?? selectedNurse?.birthDate ?? null;
    const birthDateMax = getTodayDateKey();
    const nextBirthDate = normalizeBirthDateForStorage(draftBirthDate);
    const isBirthDateValid = isValidBirthDate(draftBirthDate, birthDateMax);
    const isBirthDateDirty = !isWardAdmin && nextBirthDate !== savedBirthDate;
    const validationMessages = {
        nameRequired: t('page.profile.validation.nameRequired'),
        nameInvalid: t('page.profile.validation.nameInvalid'),
        phoneRequired: t('page.profile.validation.phoneRequired'),
        phoneInvalid: t('page.profile.validation.phoneInvalid'),
    };
    const displayName = getProfileDisplayName(writeNurse, accountMe, t('page.profile.unknownName'));
    const phoneInputValue = writeNurse
        ? hasEditedPhoneNum
            ? (writeNurse.phoneNum ?? '')
            : getProfilePhoneNum(writeNurse, accountMe)
        : draftPhoneNum;
    const savedPreferredLanguage =
        normalizePreferredLanguage(accountMe?.preferredLanguage) ??
        normalizePreferredLanguage(accountMe?.resolvedLanguage) ??
        normalizePreferredLanguage(i18n.resolvedLanguage ?? i18n.language) ??
        DEFAULT_PREFERRED_LANGUAGE;
    const phoneValidationRegion = getDefaultServiceRegionForLanguage(draftPreferredLanguage);
    const currentProfileImage = getCurrentProfileImage(accountMe, profileImg);
    const isAccountBootstrapPending = !_loaded || accountMeStatus === 'idle' || accountMeStatus === 'loading';
    const isAccountBootstrapError = accountMeStatus === 'error';
    const shouldBlockOnWardProfile = !isModalLayout;
    const isWardProfilePending = shouldBlockOnWardProfile && Boolean(accountMe?.wardId) && wardQuery.isPending && !selectedNurse;
    const isWardProfileError = shouldBlockOnWardProfile && Boolean(accountMe?.wardId) && wardQuery.isError && !selectedNurse;
    const hasNurseProfile = Boolean(selectedNurse && writeNurse);
    const isDirty = isProfileFormDirty({
        originalNurse: selectedNurse,
        draftNurse: writeNurse,
        profileImg,
    });
    const isAccountFormDirty =
        Boolean(profileImg) ||
        normalizeNurseNameForRequest(draftName) !== normalizeNurseNameForRequest(accountMe?.name ?? '') ||
        normalizeContactPhoneForStorage(draftPhoneNum) !== normalizeContactPhoneForStorage(accountMe?.phoneNum ?? '');
    const isPreferenceDirty = draftPreferredLanguage !== savedPreferredLanguage;
    const hasProfileChanges = hasNurseProfile ? isDirty : isAccountFormDirty;
    const hasUnsavedChanges = hasProfileChanges || isBirthDateDirty || isPreferenceDirty;
    const isSaveDisabled = isProfileImageLoading || isSavingPreferences || !hasUnsavedChanges || (isBirthDateDirty && !isBirthDateValid);
    const validateField = (field: TProfileField, value: string) => {
        if (field === 'name') {
            return validateName(value, {
                required: validationMessages.nameRequired,
                invalid: validationMessages.nameInvalid,
            });
        }

        return validatePhoneNum(value, phoneValidationRegion, {
            required: validationMessages.phoneRequired,
            invalid: validationMessages.phoneInvalid,
        });
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
            name: validateName(writeNurse.name ?? '', {
                required: validationMessages.nameRequired,
                invalid: validationMessages.nameInvalid,
            }),
            phoneNum: validatePhoneNum(phoneNum, phoneValidationRegion, {
                required: validationMessages.phoneRequired,
                invalid: validationMessages.phoneInvalid,
            }),
        };

        setFieldErrors(nextErrors);
        setFieldTouched({name: true, phoneNum: true});

        return !nextErrors.name && !nextErrors.phoneNum;
    };
    const validateAccountForm = () => {
        const nextName = normalizeNurseNameForRequest(draftName) || normalizeNurseNameForRequest(accountMe?.name ?? '');
        const nextErrors: TProfileErrors = {
            name: validateName(nextName, {
                required: validationMessages.nameRequired,
                invalid: validationMessages.nameInvalid,
            }),
            phoneNum: validatePhoneNum(draftPhoneNum, phoneValidationRegion, {
                required: validationMessages.phoneRequired,
                invalid: validationMessages.phoneInvalid,
            }),
        };

        setFieldErrors(nextErrors);
        setFieldTouched({name: true, phoneNum: true});

        return {
            isValid: !nextErrors.name && !nextErrors.phoneNum,
            name: nextName,
            phoneNum: normalizeContactPhoneForStorage(draftPhoneNum),
        };
    };
    const handleChange = <T extends keyof TNurse>(key: T, value: TNurse[T]) => {
        if (!writeNurse) return;

        setWriteNurse({...writeNurse, [key]: value});
    };
    const savePreferences = async () => {
        if (!isPreferenceDirty || isSavingPreferences) return true;

        try {
            setIsSavingPreferences(true);

            const nextServiceRegion = getDefaultServiceRegionForLanguage(draftPreferredLanguage);
            const isSaved = await updateAccountPreferences({
                preferredLanguage: draftPreferredLanguage,
                serviceRegion: nextServiceRegion,
            });

            if (!isSaved) {
                toast.error(t('page.profile.preferencesFailed'));

                return false;
            }

            setStoredServiceRegion(nextServiceRegion);
            await i18n.changeLanguage(draftPreferredLanguage);
            toast.success(t('page.profile.preferencesSaved'));

            return true;
        } finally {
            setIsSavingPreferences(false);
        }
    };
    const save = async () => {
        if (hasProfileChanges) {
            let isProfileSaved = false;

            if (writeNurse) {
                if (!validateForm()) return;

                const phoneNum = normalizeContactPhoneForStorage(
                    hasEditedPhoneNum ? (writeNurse.phoneNum ?? '') : getProfilePhoneNum(writeNurse, accountMe),
                );

                isProfileSaved = await handleEditProfile(
                    {...writeNurse, name: normalizeNurseNameForRequest(writeNurse.name ?? ''), phoneNum},
                    currentProfileImage,
                );
            } else {
                const {isValid, name, phoneNum} = validateAccountForm();

                if (!isValid) return;

                isProfileSaved = await handleEditAccountBasic(name, currentProfileImage, phoneNum);
            }

            if (!isProfileSaved) return;

            setHasEditedPhoneNum(false);
            resetProfileImage();
        }

        if (isBirthDateDirty) {
            if (!isBirthDateValid) return;

            const isBirthDateSaved = await updateBirthDate(nextBirthDate);

            if (!isBirthDateSaved) return;
        }

        if (isPreferenceDirty) {
            await savePreferences();
        }
    };

    useEffect(() => {
        if (selectedNurse) return;

        setWriteNurse(null);
        setDraftName(accountMe?.name ?? '');
        setDraftPhoneNum(normalizeContactPhoneForStorage(accountMe?.phoneNum ?? ''));
        setDraftBirthDate(accountMe?.birthDate ?? '');
        setHasEditedPhoneNum(false);
        setFieldErrors({});
        setFieldTouched({});
    }, [accountMe?.accountId, accountMe?.birthDate, accountMe?.name, accountMe?.phoneNum, selectedNurse]);

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
        setDraftBirthDate(savedBirthDate ?? '');
    }, [savedBirthDate]);

    useEffect(() => {
        setHasEditedPhoneNum(false);
    }, [accountMe?.accountId, selectedNurse?.nurseId]);

    useEffect(() => {
        setDraftPreferredLanguage(savedPreferredLanguage);
    }, [savedPreferredLanguage]);

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
            toast.error(t('page.profile.imageFailed'));
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
                  title: t('page.profile.confirm.deleteTitle'),
                  description: t('page.profile.confirm.deleteDescription'),
                  confirmLabel: t('page.profile.confirm.deleteConfirm'),
                  tone: 'danger' as const,
              }
            : {
                  title: t('page.profile.confirm.logoutTitle'),
                  description: t('page.profile.confirm.logoutDescription'),
                  confirmLabel: t('page.profile.confirm.logoutConfirm'),
                  tone: 'default' as const,
              };
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
    const title = t('page.profile.title');
    const descriptionText = hasUnsavedChanges ? t('page.profile.unsavedDescription') : null;
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
                    title={t('page.profile.loadingTitle')}
                    description={t('page.profile.loadingDescription')}
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
                    title={t('page.profile.errorTitle')}
                    description={t('page.profile.errorDescription')}
                    action={{label: t('page.profile.retry'), onClick: retryProfilePage}}
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
                {t('page.profile.logout')}
            </button>
            {!isModalLayout && accountMe.wardId ? (
                <button
                    type="button"
                    className="cursor-pointer bg-transparent p-0 font-apple text-sm font-medium text-gray-3 underline-offset-4 hover:underline"
                    onClick={quitWard}
                >
                    {t('page.profile.quitWard')}
                </button>
            ) : null}
            <button
                type="button"
                className="cursor-pointer bg-transparent p-0 font-apple text-sm font-medium text-red underline-offset-4 hover:underline"
                onClick={() => setConfirmAction('deleteAccount')}
            >
                {t('page.profile.deleteAccount')}
            </button>
        </div>
    );
    const saveButton = (
        <Button type="button" onClick={() => void save()} disabled={isSaveDisabled} className={saveButtonClassName}>
            {isModalLayout ? t('page.profile.modalSave') : t('page.profile.save')}
        </Button>
    );
    const getLanguageLabel = (language: TPreferredLanguage) => {
        switch (language) {
            case 'ko':
                return t('page.profile.language.ko');
            case 'ja':
                return t('page.profile.language.ja');
            case 'en':
                return t('page.profile.language.en');
            case 'zh':
                return t('page.profile.language.zh');
            case 'th':
                return t('page.profile.language.th');
            case 'vi':
                return t('page.profile.language.vi');
        }
    };

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
                    {isModalLayout ? null : (
                        <p className="font-apple text-sm font-semibold text-sub-2.5">{t('page.profile.profileSection')}</p>
                    )}
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
                                aria-label={t('page.profile.randomAvatar')}
                                title={t('page.profile.randomAvatar')}
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
                                aria-label={t('page.profile.uploadPhoto')}
                                title={t('page.profile.uploadPhoto')}
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
                            <h2 className="flex items-center gap-2 font-apple text-[20px] font-semibold text-sub-1">
                                <UserRound aria-hidden="true" className="h-5 w-5 shrink-0 text-main-1" />
                                <span>{t('page.profile.basicInfoTitle')}</span>
                            </h2>
                        </>
                    )}
                    <div className={cn('grid grid-cols-1', isModalLayout ? 'gap-4' : 'mt-4 gap-3')}>
                        <div className={fieldContainerClassName}>
                            <label htmlFor="name" className="mb-1.5 block font-apple text-[13px] font-medium text-[#4E5968]">
                                {t('page.profile.name')}
                            </label>
                            <input
                                id="name"
                                className={cn(
                                    FIELD_CLASS,
                                    modalFieldClassName,
                                    fieldErrors.name && 'border-red bg-[#FFF7F8] focus-visible:bg-white',
                                )}
                                maxLength={NURSE_NAME_MAX_LENGTH}
                                placeholder={t('page.profile.namePlaceholder')}
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
                                {t('page.profile.phoneNum')}
                            </label>
                            <input
                                id="phoneNum"
                                type="tel"
                                inputMode="tel"
                                maxLength={CONTACT_PHONE_MAX_LENGTH}
                                className={cn(
                                    FIELD_CLASS,
                                    modalFieldClassName,
                                    fieldErrors.phoneNum && 'border-red bg-[#FFF7F8] focus-visible:bg-white',
                                )}
                                placeholder={t('page.profile.phoneNumPlaceholder')}
                                value={phoneInputValue}
                                onChange={(e) => {
                                    const nextValue = sanitizeContactPhoneInput(e.target.value);

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
                        {!isWardAdmin ? (
                            <div className={fieldContainerClassName}>
                                <label htmlFor="birthDate" className="mb-1.5 block font-apple text-[13px] font-medium text-[#4E5968]">
                                    {t('page.profile.birthDate')}
                                </label>
                                <input
                                    id="birthDate"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="bday"
                                    placeholder="YYYY-MM-DD"
                                    maxLength={10}
                                    className={cn(
                                        FIELD_CLASS,
                                        modalFieldClassName,
                                        !isBirthDateValid && 'border-red bg-[#FFF7F8] focus-visible:bg-white',
                                    )}
                                    value={draftBirthDate}
                                    onChange={(event) => setDraftBirthDate(formatBirthDateInput(event.target.value))}
                                    aria-invalid={!isBirthDateValid}
                                    aria-describedby={!isBirthDateValid ? 'profile-birth-date-error' : undefined}
                                />
                                {!isBirthDateValid ? (
                                    <p id="profile-birth-date-error" className="mt-1 font-apple text-xs text-red">
                                        {t('page.profile.validation.birthDateInvalid')}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </Card>
                <Card className={basicInfoSectionClassName}>
                    {isModalLayout ? null : (
                        <>
                            <h2 className="flex items-center gap-2 font-apple text-[20px] font-semibold text-sub-1">
                                <Languages aria-hidden="true" className="h-5 w-5 shrink-0 text-main-1" />
                                <span>{t('page.profile.preferencesTitle')}</span>
                            </h2>
                        </>
                    )}
                    <div className={cn('grid grid-cols-1', isModalLayout ? 'gap-4' : 'mt-4 gap-3')}>
                        <div className={fieldContainerClassName}>
                            <label id="preferredLanguage-label" htmlFor="preferredLanguage" className="sr-only">
                                {t('page.profile.languageLabel')}
                            </label>
                            <LanguageSelect
                                id="preferredLanguage"
                                labelId="preferredLanguage-label"
                                className="w-full"
                                buttonClassName={modalFieldClassName}
                                value={draftPreferredLanguage}
                                options={LANGUAGE_OPTIONS}
                                getOptionLabel={getLanguageLabel}
                                onChange={(language) =>
                                    setDraftPreferredLanguage(normalizePreferredLanguage(language) ?? savedPreferredLanguage)
                                }
                            />
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
                <div className="mx-auto mt-6 flex max-w-[480px] items-center justify-end">{saveButton}</div>
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
