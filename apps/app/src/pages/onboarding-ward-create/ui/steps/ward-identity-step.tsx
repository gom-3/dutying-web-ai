import type {KeyboardEvent} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

interface IWardIdentityStepProps {
    hospitalName: string;
    wardName: string;
    hasHospitalNameError?: boolean;
    hasWardNameError?: boolean;
    onHospitalNameChange: (hospitalName: string) => void;
    onWardNameChange: (wardName: string) => void;
    onIdentityNameEnter: () => void;
}

const NAME_FIELD_MAX_LENGTH = 20;
const FIELD_CLASS =
    'h-12 w-full rounded-[14px] bg-gray-7 px-4 text-[15px] font-medium text-sub-1 caret-main-1 outline-none transition-colors placeholder:text-gray-4 hover:bg-gray-6/50 focus-visible:bg-main-light focus-visible:outline-none';
const FIELD_LABEL_CLASS = 'font-apple text-[15px] font-semibold text-sub-2';

function WardIdentityStep({
    hospitalName,
    wardName,
    hasHospitalNameError = false,
    hasWardNameError = false,
    onHospitalNameChange,
    onWardNameChange,
    onIdentityNameEnter,
}: IWardIdentityStepProps) {
    const {t} = useTypedTranslation();
    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        // Keep Enter-to-next from firing while IME composition is active.
        if (event.nativeEvent.isComposing || event.keyCode === 229) {
            return;
        }

        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        onIdentityNameEnter();
    };
    const getInputClassName = (hasError: boolean) =>
        `${FIELD_CLASS} ${hasError ? 'bg-[#FFF0F3] text-[#8F1D42] placeholder:text-[#B85A76] focus-visible:bg-[#FFF0F3]' : ''}`;

    return (
        <div className="mx-auto w-full max-w-[480px]">
            <section className="rounded-[24px] bg-white p-6">
                <div className="space-y-5">
                    <label className="group block space-y-2" htmlFor="onboarding-hospital-name">
                        <span className={`relative inline-block transition-colors group-focus-within:text-main-1 ${FIELD_LABEL_CLASS}`}>
                            {t('page.onboardingWardCreate.identity.hospitalName')}
                            <span aria-hidden="true" className="absolute top-0 -right-2 size-[5px] rounded-full bg-[#E55C6E]" />
                        </span>
                        <input
                            id="onboarding-hospital-name"
                            aria-label={t('page.onboardingWardCreate.identity.hospitalName')}
                            aria-invalid={hasHospitalNameError}
                            value={hospitalName}
                            placeholder={t('page.onboardingWardCreate.identity.hospitalNamePlaceholder')}
                            maxLength={NAME_FIELD_MAX_LENGTH}
                            className={getInputClassName(hasHospitalNameError)}
                            onChange={(event) => onHospitalNameChange(event.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </label>
                    <label className="group block space-y-2" htmlFor="onboarding-ward-name">
                        <span className={`block transition-colors group-focus-within:text-main-1 ${FIELD_LABEL_CLASS}`}>
                            {t('page.onboardingWardCreate.identity.wardNameOptional')}
                        </span>
                        <input
                            id="onboarding-ward-name"
                            aria-label={t('page.onboardingWardCreate.identity.wardName')}
                            aria-invalid={hasWardNameError}
                            value={wardName}
                            placeholder={t('page.onboardingWardCreate.identity.wardNamePlaceholder')}
                            maxLength={NAME_FIELD_MAX_LENGTH}
                            className={getInputClassName(hasWardNameError)}
                            onChange={(event) => onWardNameChange(event.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </label>
                </div>
            </section>
        </div>
    );
}

export default WardIdentityStep;
