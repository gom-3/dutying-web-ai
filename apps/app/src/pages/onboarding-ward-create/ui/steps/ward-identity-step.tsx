import {cn} from '@dutying/utils/style';
import type {KeyboardEvent} from 'react';

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
    'h-11 w-full rounded-[12px] border border-transparent bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';
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
    const getInputClassName = (hasError: boolean) => cn(FIELD_CLASS, hasError && 'border-red bg-[#FFF7F8] focus-visible:bg-white');

    return (
        <div className="mx-auto w-full max-w-[480px]">
            <section className="rounded-[24px] bg-white p-6">
                <div className="space-y-4">
                    <label className="block space-y-2" htmlFor="onboarding-hospital-name">
                        <span className={`relative inline-block ${FIELD_LABEL_CLASS}`}>
                            병원명
                            <span aria-hidden="true" className="absolute top-0 -right-2 size-[5px] rounded-full bg-[#E55C6E]" />
                        </span>
                        <input
                            id="onboarding-hospital-name"
                            aria-label="병원명"
                            aria-invalid={hasHospitalNameError}
                            value={hospitalName}
                            placeholder="병원명을 입력해 주세요"
                            maxLength={NAME_FIELD_MAX_LENGTH}
                            className={getInputClassName(hasHospitalNameError)}
                            onChange={(event) => onHospitalNameChange(event.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </label>
                    <label className="block space-y-2" htmlFor="onboarding-ward-name">
                        <span className={`block ${FIELD_LABEL_CLASS}`}>(선택) 병동명</span>
                        <input
                            id="onboarding-ward-name"
                            aria-label="병동명"
                            aria-invalid={hasWardNameError}
                            value={wardName}
                            placeholder="병동명을 입력해 주세요"
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
