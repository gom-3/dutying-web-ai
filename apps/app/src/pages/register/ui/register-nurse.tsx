import {cn} from '@dutying/utils/style';
import {yupResolver} from '@hookform/resolvers/yup';
import {Camera} from 'lucide-react';
import {type ChangeEvent, useEffect, useMemo, useRef, useState} from 'react';
import {useForm} from 'react-hook-form';
import toast from 'react-hot-toast';
import {useTranslation} from 'react-i18next';
import * as yup from 'yup';
import {ProfileImage} from '@/entities/account/ui/profile-image';
import {type TCreateAccountProfileDTO, useCreateAccount} from '@/features/account/model';
import useProfileImage from '@/features/file';
import useRegister from '@/features/register';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {
    DEFAULT_PREFERRED_LANGUAGE,
    getDefaultServiceRegionForLanguage,
    normalizePreferredLanguage,
    normalizeServiceRegion,
} from '@/shared/i18n/locale';
import {ACCOUNT_NAME_MAX_LENGTH, isValidAccountName, normalizeAccountNameForRequest} from '@/shared/lib/account-name';
import {
    CONTACT_PHONE_MAX_LENGTH,
    isValidContactPhone,
    normalizeContactPhoneForStorage,
    sanitizeContactPhoneInput,
} from '@/shared/lib/contact-phone';
import {
    GLOBAL_PHONE_INPUT_MAX_LENGTH,
    normalizeGlobalPhoneInput,
    parseGlobalContactPhone,
    resolveContactPhoneCountry,
    type TPhoneCountry,
} from '@/shared/lib/global-contact-phone';
import PhoneCountrySelect from '@/shared/ui/PhoneCountrySelect';
import {trackProductOutcome} from '@/shared/util/growth-analytics';
import RegisterHeading from './register-heading';

const DUPLICATE_PHONE_NUM_ERROR_TYPE = 'duplicate-phone-num';
const FIELD_CLASS =
    'h-11 w-full rounded-[12px] border border-transparent bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';
const getErrorTextValues = (value: unknown): string[] => {
    if (typeof value === 'string') return [value];

    if (typeof value !== 'object' || value === null) return [];

    const record = value as Record<string, unknown>;

    return [
        record.message,
        record.code,
        record.errorCode,
        record.serverCode,
        record.messageKey,
        record.responseBody,
        record.reason,
        record.field,
        record.originalError,
        record.response,
        record.data,
    ].flatMap(getErrorTextValues);
};
const isDuplicatePhoneNumError = (error: unknown) => {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as {code?: number}).code : undefined;

    if (code !== 400 && code !== 409) return false;

    const errorText = getErrorTextValues(error).join(' ').toLowerCase();
    const hasPhoneHint = /phone|phone_num|phonenum|\uC804\uD654|\uC5F0\uB77D\uCC98|\uD734\uB300/.test(errorText);
    const hasAlreadyUsedHint = /already[\s_-]*used|\uC774\uBBF8 \uC0AC\uC6A9|\uC0AC\uC6A9 \uC911/.test(errorText);

    return code === 409 ? hasPhoneHint || hasAlreadyUsedHint : hasPhoneHint && hasAlreadyUsedHint;
};
const isInvalidPhoneNumError = (error: unknown) =>
    getErrorTextValues(error).some((value) => /INVALID_PHONE_NUMBER|error\.invalidPhoneNumber/.test(value));
const createSchema = (
    serviceRegion: ReturnType<typeof getDefaultServiceRegionForLanguage>,
    globalPhone: boolean,
    phoneCountry?: TPhoneCountry,
) =>
    yup
        .object()
        .shape({
            name: yup
                .string()
                .transform((value) => normalizeAccountNameForRequest(value ?? ''))
                .required()
                .max(ACCOUNT_NAME_MAX_LENGTH)
                .test('account-name', (value) => isValidAccountName(value ?? '', {legacyAccount: !globalPhone})),
            phoneNum: yup
                .string()
                .transform((value) => (globalPhone ? normalizeGlobalPhoneInput(value ?? '') : normalizeContactPhoneForStorage(value ?? '')))
                .required()
                .test('contact-phone', (value) =>
                    globalPhone
                        ? Boolean(parseGlobalContactPhone(value ?? '', phoneCountry))
                        : isValidContactPhone(value ?? '', serviceRegion),
                ),
            profileImg: yup
                .object()
                .shape({
                    profileImgUrl: yup.string().optional(),
                    defaultProfileImgId: yup.number().optional(),
                })
                .required(),
        })
        .required();

interface IRegisterNurseProps {
    mode?: 'default' | 'social';
    onCompleted?: () => void;
}

function RegisterNurse({mode = 'default', onCompleted}: IRegisterNurseProps) {
    const {t} = useTypedTranslation();
    const {i18n} = useTranslation();
    const {
        state: {accountMe},
        actions: {registerAccountProfile},
    } = useRegister();
    const preferredLanguage =
        normalizePreferredLanguage(accountMe?.preferredLanguage) ??
        normalizePreferredLanguage(accountMe?.resolvedLanguage) ??
        normalizePreferredLanguage(i18n.resolvedLanguage ?? i18n.language) ??
        DEFAULT_PREFERRED_LANGUAGE;
    const serviceRegion =
        normalizeServiceRegion(accountMe?.serviceRegion) ??
        normalizeServiceRegion(accountMe?.resolvedRegion) ??
        getDefaultServiceRegionForLanguage(i18n.resolvedLanguage ?? i18n.language ?? preferredLanguage);
    const globalPhone = !accountMe || (accountMe.status as string) === 'WORKSPACE_SETUP_PENDING';
    const [phoneCountry, setPhoneCountry] = useState<TPhoneCountry | undefined>(() =>
        resolveContactPhoneCountry(accountMe?.phoneNum, serviceRegion, accountMe?.phoneCountry),
    );
    const schema = useMemo(() => createSchema(serviceRegion, globalPhone, phoneCountry), [serviceRegion, globalPhone, phoneCountry]);
    const {
        formState: {errors},
        watch,
        setValue,
        setError,
        clearErrors,
        register,
        handleSubmit,
    } = useForm<TCreateAccountProfileDTO>({
        mode: 'onTouched',
        resolver: yupResolver(schema),
    });
    const nameField = register('name');
    const phoneNumField = register('phoneNum');
    const isSocialMode = mode === 'social';
    const watchName = watch('name');
    const {profileImg, setPhotoImage} = useProfileImage(
        ['WARD_SELECT_PENDING', 'WORKSPACE_SETUP_PENDING'].includes(accountMe?.status ?? '') && accountMe?.profileImgUrl
            ? {profileImgUrl: accountMe.profileImgUrl}
            : {defaultProfileImgId: 1},
    );
    const {createAccountFeedback, isSubmitting, handleCreateAccount, handleCreateAccountValidationFailure, resetCreateAccountStatus} =
        useCreateAccount({
            submit: async (accountProfileDTO) => {
                try {
                    await registerAccountProfile({
                        ...accountProfileDTO,
                        ...(globalPhone && phoneCountry ? {phoneCountry} : {}),
                        preferredLanguage,
                        serviceRegion,
                    });

                    if (
                        isSocialMode &&
                        accountMe &&
                        (accountMe.status === 'INITIAL' ||
                            ((accountMe.status as string) === 'WORKSPACE_SETUP_PENDING' && !accountMe.phoneNum))
                    ) {
                        trackProductOutcome('sign_up', 'social');
                    }

                    onCompleted?.();
                } catch (error) {
                    if (isDuplicatePhoneNumError(error)) {
                        setError(
                            'phoneNum',
                            {
                                type: DUPLICATE_PHONE_NUM_ERROR_TYPE,
                                message: t('page.register.nurse.validation.phoneDuplicate'),
                            },
                            {shouldFocus: true},
                        );
                    } else if (isInvalidPhoneNumError(error)) {
                        setError(
                            'phoneNum',
                            {type: 'server-phone-invalid', message: t('shared.contactPhone.invalid')},
                            {shouldFocus: true},
                        );
                    }

                    throw error;
                }
            },
            isHandledError: (error) => isDuplicatePhoneNumError(error) || isInvalidPhoneNumError(error),
            shouldRethrowError: false,
        });
    const imageInputRef = useRef<HTMLInputElement>(null);
    const isComposing = useRef(false);
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

            setPhotoImage(compressedFile);
        } catch {
            toast.error(t('page.register.nurse.imageFailed'));
        } finally {
            e.target.value = '';
        }
    };
    const nameError =
        errors.name?.type === 'required'
            ? t('page.register.nurse.validation.nameRequired')
            : errors.name
              ? t(globalPhone ? 'page.register.nurse.validation.nameInvalid' : 'page.profile.validation.legacyNameInvalid')
              : undefined;
    const phoneNumError =
        errors.phoneNum?.type === DUPLICATE_PHONE_NUM_ERROR_TYPE && errors.phoneNum.message
            ? errors.phoneNum.message
            : errors.phoneNum?.type === 'required'
              ? t('page.register.nurse.validation.phoneRequired')
              : errors.phoneNum
                ? t(globalPhone ? 'shared.contactPhone.invalid' : 'page.register.nurse.validation.phoneInvalid')
                : undefined;

    useEffect(() => {
        if (profileImg) {
            setValue('profileImg', profileImg, {shouldValidate: true});
        }
    }, [profileImg, setValue]);

    useEffect(() => {
        if (isSocialMode || !accountMe?.name) {
            return;
        }

        setValue('name', accountMe.name, {shouldValidate: true});
    }, [accountMe?.name, isSocialMode, setValue]);

    useEffect(() => {
        if (accountMe?.phoneNum) {
            setValue('phoneNum', sanitizeContactPhoneInput(accountMe.phoneNum), {shouldValidate: true});
        }
    }, [accountMe?.phoneNum, setValue]);

    useEffect(() => {
        const subscription = watch(() => {
            if (!isSubmitting) {
                resetCreateAccountStatus();
            }
        });

        return () => subscription.unsubscribe();
    }, [isSubmitting, resetCreateAccountStatus, watch]);

    return (
        <form
            onSubmit={(event) => {
                if (isComposing.current) {
                    event.preventDefault();

                    return;
                }

                void handleSubmit(handleCreateAccount, handleCreateAccountValidationFailure)(event);
            }}
            onCompositionStart={() => {
                isComposing.current = true;
            }}
            onCompositionEnd={() => {
                isComposing.current = false;
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter' && (isComposing.current || event.nativeEvent.isComposing || event.keyCode === 229)) {
                    event.preventDefault();
                }
            }}
            className="flex w-full flex-col"
        >
            <div>
                <RegisterHeading>{t('page.register.nurse.title')}</RegisterHeading>
            </div>

            <section className="mt-6 rounded-[24px] bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="h-18 w-18 shrink-0 rounded-full bg-main-light p-1">
                        <ProfileImage name={watchName} profileImg={profileImg} className="h-full w-full" />
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            className="h-9 w-9 cursor-pointer rounded-full bg-gray-7 text-gray-3 transition-colors hover:bg-gray-6"
                            onClick={handleUploadImage}
                            aria-label={t('page.register.nurse.uploadPhoto')}
                            title={t('page.register.nurse.uploadPhoto')}
                        >
                            <Camera className="h-4 w-4" />
                        </button>
                        <input ref={imageInputRef} type="file" className="hidden" onChange={handleChangeImage} accept="image/*" />
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    <div>
                        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-sub-2">
                            {t('page.register.nurse.name')}
                        </label>
                        <input
                            id="name"
                            className={cn(FIELD_CLASS, nameError && 'border-red bg-[#FFF7F8] focus-visible:bg-white')}
                            aria-invalid={Boolean(nameError)}
                            aria-describedby={nameError ? 'register-name-error' : undefined}
                            autoComplete="name"
                            placeholder={t('page.register.nurse.namePlaceholder')}
                            {...nameField}
                        />
                        {nameError ? (
                            <p id="register-name-error" className="mt-1 text-xs text-red">
                                {nameError}
                            </p>
                        ) : null}
                    </div>

                    {globalPhone ? (
                        <PhoneCountrySelect
                            id="register-phone-country"
                            value={phoneCountry}
                            onChange={(country) => {
                                setPhoneCountry(country);
                                clearErrors('phoneNum');
                            }}
                        />
                    ) : null}

                    <div>
                        <label htmlFor="phone-num" className="mb-1.5 block text-sm font-medium text-sub-2">
                            {t('page.register.nurse.phoneNum')}
                        </label>
                        <input
                            id="phone-num"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            className={cn(FIELD_CLASS, phoneNumError && 'border-red bg-[#FFF7F8] focus-visible:bg-white')}
                            aria-invalid={Boolean(phoneNumError)}
                            aria-describedby={
                                [phoneNumError && 'register-phone-num-error', globalPhone && 'register-phone-hint']
                                    .filter(Boolean)
                                    .join(' ') || undefined
                            }
                            maxLength={globalPhone ? GLOBAL_PHONE_INPUT_MAX_LENGTH : CONTACT_PHONE_MAX_LENGTH}
                            placeholder={t('page.register.nurse.phoneNumPlaceholder')}
                            {...phoneNumField}
                            onChange={(event) => {
                                if (errors.phoneNum?.type === DUPLICATE_PHONE_NUM_ERROR_TYPE) {
                                    clearErrors('phoneNum');
                                }

                                if (!globalPhone && !isComposing.current && !(event.nativeEvent as InputEvent).isComposing) {
                                    event.target.value = sanitizeContactPhoneInput(event.target.value);
                                }

                                void phoneNumField.onChange(event);
                            }}
                            onCompositionEnd={(event) => {
                                const value = globalPhone
                                    ? normalizeGlobalPhoneInput(event.currentTarget.value)
                                    : sanitizeContactPhoneInput(event.currentTarget.value);

                                event.currentTarget.value = value;
                                setValue('phoneNum', value, {shouldDirty: true, shouldValidate: Boolean(errors.phoneNum)});
                            }}
                            onBlur={(event) => {
                                void phoneNumField.onBlur(event);

                                const phone = globalPhone ? parseGlobalContactPhone(event.target.value, phoneCountry) : undefined;

                                if (phone) setPhoneCountry(phone.country);
                            }}
                        />
                        {globalPhone ? (
                            <p id="register-phone-hint" className="mt-1.5 text-xs leading-relaxed text-gray-3">
                                {t('shared.contactPhone.hint')}
                            </p>
                        ) : null}
                        {phoneNumError ? (
                            <p id="register-phone-num-error" className="mt-1 text-xs text-red">
                                {phoneNumError}
                            </p>
                        ) : null}
                    </div>
                </div>
            </section>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p
                    className={cn(
                        'min-h-5 text-sm',
                        createAccountFeedback.tone === 'error' ? 'text-red' : 'text-gray-3',
                        !createAccountFeedback.message && 'hidden sm:block',
                    )}
                >
                    {createAccountFeedback.message}
                </p>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-11 min-w-24 cursor-pointer rounded-[12px] bg-main-1 px-5 text-sm font-semibold text-white transition-colors hover:bg-main-1-hover disabled:cursor-not-allowed disabled:bg-main-3"
                >
                    {isSubmitting ? t('page.register.nurse.saving') : t('page.register.nurse.next')}
                </button>
            </div>
        </form>
    );
}

export default RegisterNurse;
