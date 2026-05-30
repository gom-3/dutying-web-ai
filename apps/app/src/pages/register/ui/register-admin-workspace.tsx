import {cn} from '@dutying/utils/style';
import {Hospital, UserRound} from 'lucide-react';
import {type FormEvent, useEffect, useState} from 'react';
import toast from 'react-hot-toast';
import useAuth from '@/features/auth';
import {clearSocialSignupProfile, readSocialSignupProfile} from '@/features/auth/model/social-signup';
import useRegister from '@/features/register';

type TFormErrors = Partial<Record<'hospitalName' | 'adminName' | 'phoneNum', string>>;

const NAME_MAX_LENGTH = 50;
const ADMIN_NAME_MAX_LENGTH = 20;
const FIELD_CLASS =
    'h-11 w-full rounded-[12px] border border-transparent bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';
const normalizePhone = (value: string) => value.replace(/\D/g, '').slice(0, 11);
const getInputClassName = (hasError: boolean) => cn(FIELD_CLASS, hasError && 'border-red bg-[#FFF7F8] focus-visible:bg-white');
const validatePhoneNum = (value: string) => /^01([0|1|6|7|8|9])([0-9]{3,4})([0-9]{4})$/.test(value);
const getFirstText = (...values: Array<string | null | undefined>) => values.find((value) => Boolean(value?.trim()))?.trim();

function RegisterAdminWorkspace() {
    const {
        state: {accountMe},
    } = useAuth();
    const {
        actions: {setupAdminWorkspace},
    } = useRegister();
    const socialSignupProfile = readSocialSignupProfile();
    const socialName = getFirstText(accountMe?.name, socialSignupProfile?.name);
    const socialProfileImgUrl = getFirstText(accountMe?.profileImgUrl, socialSignupProfile?.profileImgUrl);
    const [hospitalName, setHospitalName] = useState('');
    const [wardName, setWardName] = useState('');
    const [adminName, setAdminName] = useState(socialName ?? '');
    const [phoneNum, setPhoneNum] = useState(accountMe?.phoneNum ?? '');
    const [errors, setErrors] = useState<TFormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!adminName && socialName) {
            setAdminName(socialName);
        }
    }, [adminName, socialName]);

    useEffect(() => {
        if (!phoneNum && accountMe?.phoneNum) {
            setPhoneNum(accountMe.phoneNum);
        }
    }, [accountMe?.phoneNum, phoneNum]);

    const hasEmptyRequiredFields = !hospitalName.trim() || !adminName.trim() || !phoneNum.trim();
    const isSubmitDisabled = isSubmitting || hasEmptyRequiredFields;
    const validate = () => {
        const nextErrors: TFormErrors = {};

        if (!hospitalName.trim()) {
            nextErrors.hospitalName = '병원명을 입력해 주세요.';
        }

        if (!adminName.trim()) {
            nextErrors.adminName = '관리자 이름을 입력해 주세요.';
        }

        if (!phoneNum.trim()) {
            nextErrors.phoneNum = '관리자 연락처를 입력해 주세요.';
        } else if (!validatePhoneNum(phoneNum)) {
            nextErrors.phoneNum = '01012341234처럼 숫자만 입력해 주세요.';
        }

        setErrors(nextErrors);

        return Object.keys(nextErrors).length === 0;
    };
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!validate()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const trimmedWardName = wardName.trim();
            const normalizedWardName = trimmedWardName || null;

            await setupAdminWorkspace({
                hospitalName: hospitalName.trim(),
                wardName: normalizedWardName,
                adminName: adminName.trim(),
                phoneNum,
                includeAdminAsWorker: false,
                profileImgUrl: socialProfileImgUrl ?? undefined,
            });
            clearSocialSignupProfile();
        } catch {
            toast.error('관리자 워크스페이스를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex w-full flex-col">
            <div>
                <h1 className="mt-4 text-[32px] font-semibold text-sub-1">기본정보를 입력해 주세요</h1>
            </div>

            <section className="mt-6 rounded-[24px] bg-white p-6">
                <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-main-light text-main-1">
                        <Hospital className="h-5 w-5" />
                    </span>
                    <div>
                        <h2 className="text-[20px] font-semibold text-sub-1">병원/병동</h2>
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-4">
                    <div>
                        <div className="mb-1.5">
                            <label htmlFor="admin-hospital-name" className="inline-flex items-center text-sm font-medium text-sub-2">
                                병원명
                                <span
                                    className="relative top-[-0.3rem] ml-1.5 h-[0.225rem] w-[0.225rem] rounded-full bg-red"
                                    aria-hidden="true"
                                />
                                <span className="sr-only">필수</span>
                            </label>
                        </div>
                        <input
                            id="admin-hospital-name"
                            value={hospitalName}
                            maxLength={NAME_MAX_LENGTH}
                            className={getInputClassName(Boolean(errors.hospitalName))}
                            placeholder="병원명을 입력해 주세요"
                            onChange={(event) => setHospitalName(event.target.value)}
                            aria-invalid={Boolean(errors.hospitalName)}
                            aria-describedby={errors.hospitalName ? 'admin-hospital-name-error' : undefined}
                        />
                        {errors.hospitalName ? (
                            <p id="admin-hospital-name-error" className="mt-1 text-xs text-red">
                                {errors.hospitalName}
                            </p>
                        ) : null}
                    </div>

                    <div>
                        <label htmlFor="admin-ward-name" className="mb-1.5 block text-sm font-medium text-sub-2">
                            병동명 또는 부서명
                        </label>
                        <input
                            id="admin-ward-name"
                            value={wardName}
                            maxLength={NAME_MAX_LENGTH}
                            className={FIELD_CLASS}
                            placeholder="병동명이나 부서명을 입력해 주세요"
                            onChange={(event) => setWardName(event.target.value)}
                        />
                    </div>
                </div>
            </section>

            <section className="mt-4 rounded-[24px] bg-white p-6">
                <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-main-light text-main-1">
                        <UserRound className="h-5 w-5" />
                    </span>
                    <div>
                        <h2 className="text-[20px] font-semibold text-sub-1">관리자 정보</h2>
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-4">
                    <div>
                        <div className="mb-1.5">
                            <label htmlFor="admin-name" className="inline-flex items-center text-sm font-medium text-sub-2">
                                관리자 이름
                                <span
                                    className="relative top-[-0.3rem] ml-1.5 h-[0.225rem] w-[0.225rem] rounded-full bg-red"
                                    aria-hidden="true"
                                />
                                <span className="sr-only">필수</span>
                            </label>
                        </div>
                        <input
                            id="admin-name"
                            value={adminName}
                            maxLength={ADMIN_NAME_MAX_LENGTH}
                            className={getInputClassName(Boolean(errors.adminName))}
                            placeholder="관리자 이름을 입력해 주세요"
                            onChange={(event) => setAdminName(event.target.value)}
                            aria-invalid={Boolean(errors.adminName)}
                            aria-describedby={errors.adminName ? 'admin-name-error' : undefined}
                        />
                        {errors.adminName ? (
                            <p id="admin-name-error" className="mt-1 text-xs text-red">
                                {errors.adminName}
                            </p>
                        ) : null}
                    </div>

                    <div>
                        <div className="mb-1.5">
                            <label htmlFor="admin-phone" className="inline-flex items-center text-sm font-medium text-sub-2">
                                연락처
                                <span
                                    className="relative top-[-0.3rem] ml-1.5 h-[0.225rem] w-[0.225rem] rounded-full bg-red"
                                    aria-hidden="true"
                                />
                                <span className="sr-only">필수</span>
                            </label>
                        </div>
                        <input
                            id="admin-phone"
                            value={phoneNum}
                            inputMode="numeric"
                            className={getInputClassName(Boolean(errors.phoneNum))}
                            placeholder="연락처를 입력해 주세요"
                            onChange={(event) => setPhoneNum(normalizePhone(event.target.value))}
                            aria-invalid={Boolean(errors.phoneNum)}
                            aria-describedby={errors.phoneNum ? 'admin-phone-error' : undefined}
                        />
                        {errors.phoneNum ? (
                            <p id="admin-phone-error" className="mt-1 text-xs text-red">
                                {errors.phoneNum}
                            </p>
                        ) : null}
                    </div>
                </div>
            </section>

            <div className="mt-5 flex flex-col gap-3">
                <button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className={cn(
                        'flex h-11 w-full items-center justify-center rounded-[12px] px-5 text-sm font-semibold transition-colors',
                        isSubmitDisabled
                            ? 'cursor-not-allowed bg-gray-6 text-gray-4'
                            : 'cursor-pointer bg-main-1 text-white hover:bg-[#5832E7]',
                    )}
                >
                    <span>{isSubmitting ? '만드는 중' : '시작하기'}</span>
                </button>
            </div>
        </form>
    );
}

export default RegisterAdminWorkspace;
