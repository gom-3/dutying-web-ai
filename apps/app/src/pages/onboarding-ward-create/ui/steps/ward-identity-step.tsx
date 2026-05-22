import {Input} from '@/shared/ui/primitives/input';

interface IWardIdentityStepProps {
    identityName: string;
    onIdentityNameChange: (identityName: string) => void;
    onIdentityNameEnter: () => void;
}

const NAME_FIELD_MAX_LENGTH = 20;

function WardIdentityStep({identityName, onIdentityNameChange, onIdentityNameEnter}: IWardIdentityStepProps) {
    return (
        <div className="mx-auto w-full max-w-[620px] pt-[30px]">
            <div className="group transition-all duration-200 ease-out">
                <label
                    htmlFor="onboarding-identity-name"
                    className="mb-3 block text-center font-apple text-[16px] font-medium text-sub-1 transition-colors duration-200 group-focus-within:text-[#5E45C1]"
                >
                    병원명 또는 병동명 <span className="text-[#D14343]">*</span>
                </label>
                <Input
                    id="onboarding-identity-name"
                    value={identityName}
                    placeholder="병원명 또는 병동명을 입력해 주세요"
                    maxLength={NAME_FIELD_MAX_LENGTH}
                    variant="foundation"
                    fieldSize="lg"
                    className="h-[58px] rounded-[14px] border-gray-5 bg-white px-5 text-center font-apple text-[18px] caret-[#6A4AE1] transition-all duration-200 ease-out placeholder:text-gray-4 focus:border-[#7A5AF8] focus:bg-[#FDFBFF]"
                    onChange={(event) => onIdentityNameChange(event.target.value)}
                    onKeyDown={(event) => {
                        // Keep Enter-to-next from firing while IME composition is active.
                        if (event.nativeEvent.isComposing || event.keyCode === 229) {
                            return;
                        }

                        if (event.key !== 'Enter') {
                            return;
                        }

                        event.preventDefault();
                        onIdentityNameEnter();
                    }}
                />
            </div>
        </div>
    );
}

export default WardIdentityStep;
