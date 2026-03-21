import type {TOnboardingStep} from '../model';

const STEP_LABELS: Record<TOnboardingStep, {title: string; description: string}> = {
    1: {
        title: '이전 근무표 파일이 있다면 업로드해 주세요',
        description: '근무표를 분석해서 간호사 정보와 근무 시간을 자동으로 채워 드릴게요',
    },
    2: {
        title: '병동의 근무 유형을 설정해 주세요',
        description: '나중에도 수정할 수 있어요',
    },
    3: {
        title: '간호사를 등록해 주세요',
        description: '매월 팀당 하나의 근무표를 만들 수 있어요. 언제든 수정, 추가 가능해요',
    },
    4: {
        title: '간호사를 등록해주세요',
        description: '매월 팀당 하나의 근무표를 만들 수 있어요. 언제든 수정, 추가 가능해요',
    },
};

function SectionHeader({step}: {step: TOnboardingStep}) {
    const label = STEP_LABELS[step];

    return (
        <div className="mb-10 flex items-start justify-between">
            <div className="space-y-6">
                <h1 className="max-w-[541px] font-apple text-[32px] leading-[1.18] font-semibold whitespace-pre-line text-text-1">
                    {label.title}
                </h1>
                <p className="font-apple text-[20px] font-medium text-gray-3">{label.description}</p>
            </div>
        </div>
    );
}

export default SectionHeader;
