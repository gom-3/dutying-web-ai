import {type TCreateNurseDTO} from '@dutying/api/nurse';
import {cn} from '@dutying/utils/style';
import {yupResolver} from '@hookform/resolvers/yup';
import {useQuery} from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';
import {Camera} from 'lucide-react';
import {type ChangeEvent, useEffect, useRef} from 'react';
import {useForm} from 'react-hook-form';
import toast from 'react-hot-toast';
import * as yup from 'yup';
import {ProfileImage} from '@/entities/account/ui/profile-image';
import {nurseQueryOptions} from '@/entities/nurse';
import {useCreateAccount} from '@/features/account/model';
import useProfileImage from '@/features/file';
import useRegister from '@/features/register';
import {RandomIcon} from '@/shared/assets/svg';

const NURSE_NAME_MAX_LENGTH = 20;
const NURSE_NAME_ALLOWED_REGEXP = /^[A-Za-zㄱ-ㅎㅏ-ㅣ가-힣ぁ-ゟ゠-ヿ一-龯々\s'’\-·・]+$/u;
const NURSE_NAME_INPUT_SANITIZE_REGEXP = /[^A-Za-zㄱ-ㅎㅏ-ㅣ가-힣ぁ-ゟ゠-ヿ一-龯々\s'’\-·・]/gu;
const DEFAULT_REGISTER_NURSE_GENDER = '여';
const FIELD_CLASS =
    'h-11 w-full rounded-[12px] border border-transparent bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';
const sanitizeNurseNameInput = (rawValue: string) => rawValue.replace(NURSE_NAME_INPUT_SANITIZE_REGEXP, '').slice(0, NURSE_NAME_MAX_LENGTH);
const normalizePhone = (value: string) => value.replace(/\D/g, '').slice(0, 11);
const getTodayDate = () => new Date().toISOString().slice(0, 10);
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
            .required()
            .matches(/^01([0|1|6|7|8|9])([0-9]{3,4})([0-9]{4})$/),
        isWorker: yup.boolean().required(),
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
    onCompleted?: () => void;
}

function RegisterNurse({onCompleted}: IRegisterNurseProps) {
    const {
        formState: {errors},
        watch,
        setValue,
        register,
        handleSubmit,
    } = useForm<TCreateNurseDTO & {profileImg: {profileImgUrl?: string; defaultProfileImgId?: number}}>({
        defaultValues: {
            gender: DEFAULT_REGISTER_NURSE_GENDER,
            employmentDate: getTodayDate(),
            isWorker: true,
        },
        mode: 'onTouched',
        resolver: yupResolver(schema),
    });
    const nameField = register('name');
    const phoneField = register('phoneNum');
    const {
        state: {accountMe},
        actions: {registerAccountAndNurse},
    } = useRegister();
    const watchName = watch('name');
    const watchIsWorker = watch('isWorker');
    const shouldLoadRegisteredNurse = accountMe?.status === 'WARD_SELECT_PENDING' && Boolean(accountMe.nurseId);
    const registeredNurseQuery = useQuery({
        ...nurseQueryOptions.id(accountMe?.nurseId ?? 0),
        enabled: shouldLoadRegisteredNurse,
    });
    const {profileImg, setRandomImage, setPhotoImage} = useProfileImage(
        accountMe?.status === 'WARD_SELECT_PENDING' && accountMe.profileImgUrl
            ? {profileImgUrl: accountMe.profileImgUrl}
            : {defaultProfileImgId: 1},
    );
    const {createAccountFeedback, isSubmitting, handleCreateAccount, handleCreateAccountValidationFailure, resetCreateAccountStatus} =
        useCreateAccount({
            submit: async (createNurseDTO) => {
                await registerAccountAndNurse(createNurseDTO);
                onCompleted?.();
            },
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
    const phoneError =
        errors.phoneNum?.type === 'required'
            ? '전화번호를 입력해 주세요.'
            : errors.phoneNum
              ? '전화번호는 01012341234처럼 숫자만 입력해 주세요.'
              : undefined;

    useEffect(() => {
        if (profileImg) {
            setValue('profileImg', profileImg, {shouldValidate: true});
        }
    }, [profileImg, setValue]);

    useEffect(() => {
        if (!registeredNurseQuery.data) {
            return;
        }

        setValue('name', registeredNurseQuery.data.name, {shouldValidate: true});
        setValue('phoneNum', normalizePhone(registeredNurseQuery.data.phoneNum), {shouldValidate: true});
        setValue('gender', registeredNurseQuery.data.gender || DEFAULT_REGISTER_NURSE_GENDER, {shouldValidate: true});
        setValue('employmentDate', registeredNurseQuery.data.employmentDate || getTodayDate(), {shouldValidate: true});
        setValue('isWorker', registeredNurseQuery.data.isWorker, {shouldValidate: true});
    }, [registeredNurseQuery.data, setValue]);

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
                            placeholder="이름을 입력하세요"
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
                        <label htmlFor="phoneNum" className="mb-1.5 block text-sm font-medium text-sub-2">
                            전화번호
                        </label>
                        <input
                            id="phoneNum"
                            inputMode="numeric"
                            className={cn(FIELD_CLASS, phoneError && 'border-red bg-[#FFF7F8] focus-visible:bg-white')}
                            aria-invalid={Boolean(phoneError)}
                            aria-describedby={phoneError ? 'register-phone-error' : undefined}
                            placeholder="전화번호를 입력하세요"
                            {...phoneField}
                            onChange={(event) => {
                                event.target.value = normalizePhone(event.target.value);
                                void phoneField.onChange(event);
                            }}
                        />
                        {phoneError ? (
                            <p id="register-phone-error" className="mt-1 text-xs text-red">
                                {phoneError}
                            </p>
                        ) : null}
                    </div>
                </div>
            </section>

            <section className="mt-4 rounded-[24px] bg-white p-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-sub-1">근무자로 참여하기</p>
                        <p className="mt-1 text-xs leading-5 text-gray-3">켜면 내 근무도 배정해요. 끄면 근무표만 관리해요.</p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={watchIsWorker}
                        aria-label="근무자로 참여하기"
                        className={cn(
                            'flex h-7 w-12 shrink-0 cursor-pointer items-center justify-start rounded-full p-1 transition-colors',
                            watchIsWorker ? 'bg-main-1' : 'bg-gray-6 hover:bg-gray-5',
                        )}
                        onClick={() => setValue('isWorker', !watchIsWorker, {shouldDirty: true, shouldValidate: true})}
                    >
                        <span
                            className={cn(
                                'block h-5 w-5 rounded-full bg-white transition-transform duration-200 ease-out',
                                watchIsWorker ? 'translate-x-5' : 'translate-x-0',
                            )}
                        />
                    </button>
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
                    className="h-11 min-w-24 cursor-pointer rounded-[12px] bg-main-1 px-5 text-sm font-semibold text-white transition-colors hover:bg-[#5832E7] disabled:cursor-not-allowed disabled:bg-main-3"
                >
                    {isSubmitting ? '저장 중...' : '다음'}
                </button>
            </div>
        </form>
    );
}

export default RegisterNurse;
