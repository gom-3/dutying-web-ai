import {cn} from '@dutying/utils/style';
import {yupResolver} from '@hookform/resolvers/yup';
import imageCompression from 'browser-image-compression';
import {Camera} from 'lucide-react';
import {type ChangeEvent, useEffect, useRef} from 'react';
import {useForm} from 'react-hook-form';
import toast from 'react-hot-toast';
import * as yup from 'yup';
import {ProfileImage} from '@/entities/account/ui/profile-image';
import {type TCreateAccountProfileDTO, useCreateAccount} from '@/features/account/model';
import useProfileImage from '@/features/file';
import useRegister from '@/features/register';
import {RandomIcon} from '@/shared/assets/svg';

const NURSE_NAME_MAX_LENGTH = 20;
const PHONE_NUM_LENGTH = 11;
const NURSE_NAME_ALLOWED_REGEXP = /^[A-Za-zㄱ-ㅎㅏ-ㅣ가-힣ぁ-ゟ゠-ヿ一-龯々\s'’\-·・]+$/u;
const NURSE_NAME_INPUT_SANITIZE_REGEXP = /[^A-Za-zㄱ-ㅎㅏ-ㅣ가-힣ぁ-ゟ゠-ヿ一-龯々\s'’\-·・]/gu;
const PHONE_NUM_INPUT_SANITIZE_REGEXP = /[^0-9]/g;
const DUPLICATE_PHONE_NUM_ERROR_TYPE = 'duplicate-phone-num';
const DUPLICATE_PHONE_NUM_ERROR_MESSAGE = '이미 사용 중인 연락처예요. 다른 번호를 입력해 주세요.';
const FIELD_CLASS =
    'h-11 w-full rounded-[12px] border border-transparent bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';
const sanitizeNurseNameInput = (rawValue: string) => rawValue.replace(NURSE_NAME_INPUT_SANITIZE_REGEXP, '').slice(0, NURSE_NAME_MAX_LENGTH);
const sanitizePhoneNumInput = (rawValue: string) => rawValue.replace(PHONE_NUM_INPUT_SANITIZE_REGEXP, '').slice(0, PHONE_NUM_LENGTH);
const getErrorTextValues = (value: unknown): string[] => {
    if (typeof value === 'string') return [value];

    if (typeof value !== 'object' || value === null) return [];

    const record = value as Record<string, unknown>;

    return [
        record.message,
        record.code,
        record.errorCode,
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
    const hasPhoneHint = /phone|phone_num|phonenum|전화|연락처|휴대/.test(errorText);
    const hasAlreadyUsedHint = /already used|이미 사용|사용 중/.test(errorText);

    return code === 409 ? hasPhoneHint || hasAlreadyUsedHint : hasPhoneHint && hasAlreadyUsedHint;
};
const schema = yup
    .object()
    .shape({
        name: yup
            .string()
            .transform((value) => value?.trim() ?? '')
            .required()
            .max(NURSE_NAME_MAX_LENGTH)
            .matches(NURSE_NAME_ALLOWED_REGEXP),
        phoneNum: yup
            .string()
            .transform((value) => sanitizePhoneNumInput(value ?? ''))
            .required()
            .length(PHONE_NUM_LENGTH),
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
    const {
        state: {accountMe},
        actions: {registerAccountProfile},
    } = useRegister();
    const isSocialMode = mode === 'social';
    const watchName = watch('name');
    const {profileImg, setRandomImage, setPhotoImage} = useProfileImage(
        accountMe?.status === 'WARD_SELECT_PENDING' && accountMe.profileImgUrl
            ? {profileImgUrl: accountMe.profileImgUrl}
            : {defaultProfileImgId: 1},
    );
    const {createAccountFeedback, isSubmitting, handleCreateAccount, handleCreateAccountValidationFailure, resetCreateAccountStatus} =
        useCreateAccount({
            submit: async (accountProfileDTO) => {
                try {
                    await registerAccountProfile(accountProfileDTO);
                    onCompleted?.();
                } catch (error) {
                    if (isDuplicatePhoneNumError(error)) {
                        setError(
                            'phoneNum',
                            {
                                type: DUPLICATE_PHONE_NUM_ERROR_TYPE,
                                message: DUPLICATE_PHONE_NUM_ERROR_MESSAGE,
                            },
                            {shouldFocus: true},
                        );
                    }

                    throw error;
                }
            },
            isHandledError: isDuplicatePhoneNumError,
            shouldRethrowError: false,
        });
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

            setPhotoImage(compressedFile);
        } catch {
            toast.error('프로필 이미지를 처리하지 못했어요.');
        } finally {
            e.target.value = '';
        }
    };
    const nameError =
        errors.name?.type === 'required'
            ? '이름을 입력해 주세요.'
            : errors.name
              ? "이름은 20자 이하, 한글/영문/일문과 공백, '-', '·'만 입력할 수 있어요."
              : undefined;
    const phoneNumError =
        errors.phoneNum?.type === DUPLICATE_PHONE_NUM_ERROR_TYPE && errors.phoneNum.message
            ? errors.phoneNum.message
            : errors.phoneNum?.type === 'required'
              ? '연락처를 입력해 주세요.'
              : errors.phoneNum
                ? '연락처는 숫자 11자리로 입력해 주세요.'
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
        const subscription = watch(() => {
            if (!isSubmitting) {
                resetCreateAccountStatus();
            }
        });

        return () => subscription.unsubscribe();
    }, [isSubmitting, resetCreateAccountStatus, watch]);

    return (
        <form onSubmit={handleSubmit(handleCreateAccount, handleCreateAccountValidationFailure)} className="flex w-full flex-col">
            <div>
                <h1 className="text-[32px] font-semibold text-sub-1">계정 정보를 입력해 주세요</h1>
            </div>

            <section className="mt-6 rounded-[24px] bg-white p-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="h-18 w-18 shrink-0 rounded-full bg-main-light p-1">
                        <ProfileImage name={watchName} profileImg={profileImg} className="h-full w-full" />
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            className="h-9 w-9 cursor-pointer rounded-full bg-gray-7 text-gray-3 transition-colors hover:bg-gray-6"
                            onClick={setRandomImage}
                            aria-label="랜덤 아바타"
                            title="랜덤 아바타"
                        >
                            <RandomIcon className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            className="h-9 w-9 cursor-pointer rounded-full bg-gray-7 text-gray-3 transition-colors hover:bg-gray-6"
                            onClick={handleUploadImage}
                            aria-label="사진 업로드"
                            title="사진 업로드"
                        >
                            <Camera className="h-4 w-4" />
                        </button>
                        <input ref={imageInputRef} type="file" className="hidden" onChange={handleChangeImage} accept="image/*" />
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    <div>
                        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-sub-2">
                            이름
                        </label>
                        <input
                            id="name"
                            className={cn(FIELD_CLASS, nameError && 'border-red bg-[#FFF7F8] focus-visible:bg-white')}
                            aria-invalid={Boolean(nameError)}
                            aria-describedby={nameError ? 'register-name-error' : undefined}
                            maxLength={NURSE_NAME_MAX_LENGTH}
                            placeholder="이름을 입력해주세요"
                            {...nameField}
                            onChange={(event) => {
                                event.target.value = sanitizeNurseNameInput(event.target.value);
                                void nameField.onChange(event);
                            }}
                        />
                        {nameError ? (
                            <p id="register-name-error" className="mt-1 text-xs text-red">
                                {nameError}
                            </p>
                        ) : null}
                    </div>

                    <div>
                        <label htmlFor="phone-num" className="mb-1.5 block text-sm font-medium text-sub-2">
                            연락처
                        </label>
                        <input
                            id="phone-num"
                            type="tel"
                            inputMode="numeric"
                            className={cn(FIELD_CLASS, phoneNumError && 'border-red bg-[#FFF7F8] focus-visible:bg-white')}
                            aria-invalid={Boolean(phoneNumError)}
                            aria-describedby={phoneNumError ? 'register-phone-num-error' : undefined}
                            maxLength={PHONE_NUM_LENGTH}
                            placeholder="연락처를 입력해주세요"
                            {...phoneNumField}
                            onChange={(event) => {
                                if (errors.phoneNum?.type === DUPLICATE_PHONE_NUM_ERROR_TYPE) {
                                    clearErrors('phoneNum');
                                }

                                event.target.value = sanitizePhoneNumInput(event.target.value);
                                void phoneNumField.onChange(event);
                            }}
                        />
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
                    {isSubmitting ? '저장 중...' : '다음'}
                </button>
            </div>
        </form>
    );
}

export default RegisterNurse;
