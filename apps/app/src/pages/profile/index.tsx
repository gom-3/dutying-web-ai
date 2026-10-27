import type {TPreferredLanguage} from '@dutying/domain';
import {cn} from '@dutying/utils/style';
import * as Dialog from '@radix-ui/react-dialog';
import {useQuery} from '@tanstack/react-query';
import {type ChangeEvent, useEffect, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {useTranslation} from 'react-i18next';
import {ProfileImage} from '@/entities/account/ui/profile-image';
import {type TNurse} from '@/entities/nurse';
import {wardQueryOptions} from '@/entities/ward';
import {useEditAccount} from '@/features/account/model';
import useAuth from '@/features/auth';
import {isWardAdminAccessToken} from '@/features/auth/model/admin-token';
import useAuthStore from '@/features/auth/model/store';
import {useCommercialContext} from '@/features/commercial/api';
import useProfileImage from '@/features/file';
import {InfoTip} from '@/pages/workspace/info-tip';
import {countWorkspaceRequests} from '@/pages/workspace/workspace-activity';
import {WorkspacePersonalShell} from '@/pages/workspace/workspace-personal-shell';
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
import PageState from '@/shared/ui/PageState';
import {findProfileNurse, getCurrentProfileImage, getProfileDisplayName, getProfilePhoneNum, isProfileFormDirty} from './model';
import './profile.css';

type TProfileField = 'name' | 'phoneNum';
type TProfileErrors = Partial<Record<TProfileField, string>>;
type TProfileTouched = Partial<Record<TProfileField, boolean>>;
type TConfirmAction = 'logout' | 'deleteAccount';
type TProfileContentProps = {
    layout?: 'page' | 'modal';
};

const FIELD_CLASS = 'profile-field-control';
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
    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);
    const [hasEditedPhoneNum, setHasEditedPhoneNum] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<TProfileErrors>({});
    const [fieldTouched, setFieldTouched] = useState<TProfileTouched>({});
    const [confirmAction, setConfirmAction] = useState<TConfirmAction | null>(null);
    const {profileImg, isLoading: isProfileImageLoading, setPhotoImage, resetProfileImage} = useProfileImage();
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
    const isSaveDisabled =
        isProfileImageLoading || isSaving || isSavingPreferences || !hasUnsavedChanges || (isBirthDateDirty && !isBirthDateValid);
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
        if (savingRef.current || isSaveDisabled) return;

        savingRef.current = true;
        setIsSaving(true);

        try {
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
        } finally {
            savingRef.current = false;
            setIsSaving(false);
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

        const file = e.target.files[0];

        try {
            const {default: imageCompression} = await import('browser-image-compression');
            const compressedFile = await imageCompression(file, {
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
    const copy = (ko: string, en: string) => (i18n.language.startsWith('ko') ? ko : en);
    const stateContainerClassName = cn('profile-state', isModalLayout && 'profile-state--modal');
    const rootClassName = cn('account-profile', isModalLayout && 'account-profile--modal');
    const portalContainer = typeof document === 'undefined' ? undefined : (document.getElementById('modal-root') ?? document.body);

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
        <div className="profile-account-actions">
            <button type="button" className="profile-action profile-action--tonal" onClick={() => setConfirmAction('logout')}>
                {t('page.profile.logout')}
            </button>
            {!isModalLayout && accountMe.wardId && accountMe.accessSource !== 'HOSPITAL' ? (
                <button type="button" className="profile-action profile-action--tonal" onClick={quitWard}>
                    {t('page.profile.quitWard')}
                </button>
            ) : null}
            <button type="button" className="profile-action profile-action--danger" onClick={() => setConfirmAction('deleteAccount')}>
                {t('page.profile.deleteAccount')}
            </button>
        </div>
    );
    const saveButton = (
        <button type="submit" disabled={isSaveDisabled} className="profile-action profile-action--primary">
            {isSaving ? t('page.profile.savingPreferences') : isModalLayout ? t('page.profile.modalSave') : t('page.profile.save')}
        </button>
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
            {isModalLayout ? <h1 className="profile-modal-title">{t('page.profile.title')}</h1> : null}
            <form
                className="profile-form"
                aria-label={t('page.profile.profileSection')}
                aria-busy={isSaving}
                onSubmit={(event) => {
                    event.preventDefault();
                    void save();
                }}
            >
                <section className="profile-identity" aria-label={t('page.profile.profileSection')}>
                    <div className="profile-avatar">
                        <ProfileImage className="h-full w-full" name={displayName} profileImg={currentProfileImage} />
                    </div>
                    <div className="profile-identity-copy">
                        <p className="profile-display-name">{displayName}</p>
                        <p className="profile-email">{accountMe.email}</p>
                    </div>
                    <button
                        type="button"
                        className="profile-action profile-action--tonal profile-photo-action"
                        onClick={handleUploadImage}
                        disabled={isProfileImageLoading}
                    >
                        {t('page.profile.uploadPhoto')}
                    </button>
                    <input ref={imageInputRef} type="file" className="hidden" onChange={handleChangeImage} accept="image/*" />
                </section>

                <section className="profile-section" aria-labelledby="profile-basic-heading">
                    <div className="profile-section-heading">
                        <h2 id="profile-basic-heading">{t('page.profile.basicInfoTitle')}</h2>
                        <InfoTip label={t('page.profile.basicInfoDescription')}>{t('page.profile.basicInfoDescription')}</InfoTip>
                    </div>
                    <div className="profile-fields">
                        <div className="profile-field">
                            <label htmlFor="name">{t('page.profile.name')}</label>
                            <input
                                id="name"
                                autoComplete="name"
                                className={FIELD_CLASS}
                                maxLength={NURSE_NAME_MAX_LENGTH}
                                placeholder={t('page.profile.namePlaceholder')}
                                value={writeNurse?.name ?? draftName}
                                onChange={(event) => {
                                    const nextValue = sanitizeNurseNameInput(event.target.value);

                                    if (writeNurse) {
                                        handleChange('name', nextValue);
                                    } else {
                                        setDraftName(nextValue);
                                    }

                                    if (fieldTouched.name) setFieldError('name', nextValue);
                                }}
                                onBlur={(event) => {
                                    setFieldTouched((prev) => ({...prev, name: true}));
                                    setFieldError('name', event.target.value);
                                }}
                                aria-invalid={Boolean(fieldErrors.name)}
                                aria-describedby={fieldErrors.name ? 'profile-name-error' : undefined}
                            />
                            {fieldErrors.name ? (
                                <p id="profile-name-error" className="profile-field-error">
                                    {fieldErrors.name}
                                </p>
                            ) : null}
                        </div>
                        <div className="profile-field">
                            <label htmlFor="phoneNum">{t('page.profile.phoneNum')}</label>
                            <input
                                id="phoneNum"
                                type="tel"
                                autoComplete="tel"
                                inputMode="tel"
                                maxLength={CONTACT_PHONE_MAX_LENGTH}
                                className={FIELD_CLASS}
                                placeholder={t('page.profile.phoneNumPlaceholder')}
                                value={phoneInputValue}
                                onChange={(event) => {
                                    const nextValue = sanitizeContactPhoneInput(event.target.value);

                                    if (writeNurse) {
                                        setHasEditedPhoneNum(true);
                                        handleChange('phoneNum', nextValue);
                                    } else {
                                        setDraftPhoneNum(nextValue);
                                    }

                                    if (fieldTouched.phoneNum) setFieldError('phoneNum', nextValue);
                                }}
                                onBlur={(event) => {
                                    setFieldTouched((prev) => ({...prev, phoneNum: true}));
                                    setFieldError('phoneNum', event.target.value);
                                }}
                                aria-invalid={Boolean(fieldErrors.phoneNum)}
                                aria-describedby={fieldErrors.phoneNum ? 'profile-phone-error' : undefined}
                            />
                            {fieldErrors.phoneNum ? (
                                <p id="profile-phone-error" className="profile-field-error">
                                    {fieldErrors.phoneNum}
                                </p>
                            ) : null}
                        </div>
                        {!isWardAdmin ? (
                            <div className="profile-field">
                                <label htmlFor="birthDate">{t('page.profile.birthDate')}</label>
                                <input
                                    id="birthDate"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="bday"
                                    placeholder="YYYY-MM-DD"
                                    maxLength={10}
                                    className={FIELD_CLASS}
                                    value={draftBirthDate}
                                    onChange={(event) => setDraftBirthDate(formatBirthDateInput(event.target.value))}
                                    aria-invalid={!isBirthDateValid}
                                    aria-describedby={!isBirthDateValid ? 'profile-birth-date-error' : undefined}
                                />
                                {!isBirthDateValid ? (
                                    <p id="profile-birth-date-error" className="profile-field-error">
                                        {t('page.profile.validation.birthDateInvalid')}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </section>

                <section className="profile-section" aria-labelledby="profile-language-heading">
                    <div className="profile-section-heading">
                        <h2 id="profile-language-heading">{t('page.profile.preferencesTitle')}</h2>
                        <InfoTip label={t('page.profile.preferencesDescription')}>{t('page.profile.preferencesDescription')}</InfoTip>
                    </div>
                    <div className="profile-fields">
                        <div className="profile-field">
                            <label htmlFor="preferredLanguage">{t('page.profile.languageLabel')}</label>
                            <select
                                id="preferredLanguage"
                                className={FIELD_CLASS}
                                value={draftPreferredLanguage}
                                onChange={(event) =>
                                    setDraftPreferredLanguage(normalizePreferredLanguage(event.target.value) ?? savedPreferredLanguage)
                                }
                            >
                                {LANGUAGE_OPTIONS.map((language) => (
                                    <option key={language} value={language}>
                                        {getLanguageLabel(language)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>

                <div className="profile-save-row">
                    <p className="profile-save-status" role="status">
                        {hasUnsavedChanges ? t('page.profile.unsavedDescription') : t('page.profile.savedDescription')}
                    </p>
                    {saveButton}
                </div>
            </form>

            <section className="profile-section profile-account-section" aria-labelledby="profile-account-heading">
                <div className="profile-section-heading">
                    <h2 id="profile-account-heading">{copy('계정 관리', 'Account management')}</h2>
                </div>
                {accountActionButtons}
            </section>

            <Dialog.Root open={confirmAction !== null} onOpenChange={(nextOpen) => !nextOpen && closeConfirmDialog()}>
                <Dialog.Portal container={portalContainer}>
                    <Dialog.Overlay className="profile-dialog-overlay" />
                    <Dialog.Content className="profile-dialog">
                        <Dialog.Title>{confirmDialogContent.title}</Dialog.Title>
                        <Dialog.Description>{confirmDialogContent.description}</Dialog.Description>
                        <div className="profile-dialog-actions">
                            <Dialog.Close asChild>
                                <button type="button" className="profile-action profile-action--tonal">
                                    {t('shared.confirmActionDialog.cancel')}
                                </button>
                            </Dialog.Close>
                            <button
                                type="button"
                                className={cn(
                                    'profile-action',
                                    confirmDialogContent.tone === 'danger' ? 'profile-action--destructive' : 'profile-action--primary',
                                )}
                                onClick={confirmActionDialog}
                            >
                                {confirmDialogContent.confirmLabel}
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}

function ProfilePage() {
    const context = useCommercialContext();
    const accountId = useAuthStore((state) => state.accountId);
    const {
        state: {accountMe, accessToken},
    } = useAuth();

    return (
        <WorkspacePersonalShell
            page="profile"
            scopes={context.data?.enabled && !context.isError ? context.data.scopes : []}
            accountId={accountId}
            accountName={accountMe?.name ?? ''}
            pendingCount={context.data?.enabled && !context.isError ? countWorkspaceRequests(context.data, accountId) : 0}
            managementEnabled={isWardAdminAccessToken(accessToken)}
        >
            <ProfileContent />
        </WorkspacePersonalShell>
    );
}

export default ProfilePage;
