import {cn} from '@dutying/utils/style';
import type {KeyboardEvent} from 'react';
import {Input} from '@/shared/ui/primitives/input';

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
    const getInputClassName = (hasError: boolean) =>
        cn(
            'h-[58px] rounded-[14px] border bg-white px-5 text-center font-apple text-[18px] caret-[#6A4AE1] transition-[border-color,box-shadow,background-color] duration-200 ease-out placeholder:text-gray-4 focus:border focus:bg-white focus-visible:border focus-visible:bg-white',
            hasError
                ? 'border-[#D14343] ring-[1px] ring-[#D14343] focus:border-[#D14343] focus:ring-[1px] focus:ring-[#D14343] focus-visible:border-[#D14343] focus-visible:ring-[1px] focus-visible:ring-[#D14343]'
                : 'border-gray-5 hover:border-[#7A5AF8] hover:ring-[1px] hover:ring-[#7A5AF8] focus-visible:border-[#7A5AF8] focus-visible:ring-[1px] focus-visible:ring-[#7A5AF8]',
        );

    return (
        <div className="mx-auto w-full max-w-[620px] pt-[30px]">
            <div className="space-y-4">
                <label className="block space-y-2" htmlFor="onboarding-hospital-name">
                    <span className="relative inline-block font-apple text-[15px] font-semibold text-sub-2">
                        병원명
                        <span aria-hidden="true" className="absolute top-0 -right-2 size-[5px] rounded-full bg-[#E55C6E]" />
                    </span>
                    <Input
                        id="onboarding-hospital-name"
                        aria-label="병원명"
                        value={hospitalName}
                        placeholder="병원명을 입력해 주세요"
                        maxLength={NAME_FIELD_MAX_LENGTH}
                        variant="foundation"
                        fieldSize="lg"
                        className={getInputClassName(hasHospitalNameError)}
                        onChange={(event) => onHospitalNameChange(event.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </label>
                <label className="block space-y-2" htmlFor="onboarding-ward-name">
                    <span className="block font-apple text-[15px] font-semibold text-sub-2">(선택) 병동명</span>
                    <Input
                        id="onboarding-ward-name"
                        aria-label="병동명"
                        value={wardName}
                        placeholder="병동명을 입력해 주세요"
                        maxLength={NAME_FIELD_MAX_LENGTH}
                        variant="foundation"
                        fieldSize="lg"
                        className={getInputClassName(hasWardNameError)}
                        onChange={(event) => onWardNameChange(event.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </label>
            </div>
        </div>
    );
}

export default WardIdentityStep;
