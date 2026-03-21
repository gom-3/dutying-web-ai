import {SuccessCircleIcon} from '@/shared/assets/svg';

interface IConnectionManageCompleteStepProps {
    onRestart: () => void;
    onClose: () => void;
}

function ConnectionManageCompleteStep({onRestart, onClose}: IConnectionManageCompleteStepProps) {
    return (
        <div
            className="flex min-h-96 w-[40%] min-w-190 flex-col items-center justify-center rounded-[1.25rem] bg-white"
            onClick={(event) => event.stopPropagation()}
        >
            <SuccessCircleIcon className="h-15 w-15" />
            <h1 className="mt-5 font-apple text-[1.75rem] font-semibold text-text-1">간호사 계정이 연동되었습니다.</h1>
            <p className="mt-[.5rem] font-apple text-[1rem] text-sub-3">
                연동된 간호사의 계정은{' '}
                <span className="cursor-pointer text-main-1 underline" onClick={onClose}>
                    간호사 관리 탭
                </span>
                에서 확인하실 수 있어요!
            </p>

            <div className="mt-12 flex w-100">
                <button
                    className="h-11.5 flex-1 rounded-l-[3.125rem] border-[.0625rem] border-main-3 bg-main-1 font-apple text-[1.5rem] font-medium text-white"
                    onClick={onRestart}
                >
                    돌아가기
                </button>
                <button
                    className="h-11.5 flex-1 rounded-r-[3.125rem] border-[.0625rem] border-main-3 bg-sub-5 font-apple text-[1.5rem] font-medium text-sub-2.5"
                    onClick={onClose}
                >
                    닫기
                </button>
            </div>
        </div>
    );
}

export default ConnectionManageCompleteStep;
