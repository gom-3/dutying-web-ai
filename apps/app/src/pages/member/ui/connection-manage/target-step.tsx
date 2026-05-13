import {twMerge} from 'tailwind-merge';
import {type TWaitingNurse} from '@/entities/nurse';
import {type TShiftTeam} from '@/entities/ward';
import {CheckedIcon, MoreIcon, PersonIcon, UncheckedIcon2, UnlinkedIcon} from '@/shared/assets/svg';
import type {TConnectMode} from '../../model/connection-manage';
import {getConnectionManageTargetLabel, getGroupedDivisionNurses} from '../../model/connection-manage';

interface IConnectionManageTargetStepProps {
    currentWaitingNurse: TWaitingNurse | null;
    shiftTeams: TShiftTeam[] | undefined;
    connectMode: TConnectMode;
    toLinkNurseId: number | null;
    toAddShiftTeamId: number | null;
    isNextDisabled: boolean;
    onBack: () => void;
    onNext: () => void;
    onSelectLinkNurse: (nurseId: number) => void;
    onSelectShiftTeam: (shiftTeamId: number) => void;
}

function ConnectionManageTargetStep({
    currentWaitingNurse,
    shiftTeams,
    connectMode,
    toLinkNurseId,
    toAddShiftTeamId,
    isNextDisabled,
    onBack,
    onNext,
    onSelectLinkNurse,
    onSelectShiftTeam,
}: IConnectionManageTargetStepProps) {
    const targetLabel = getConnectionManageTargetLabel({
        connectMode,
        shiftTeams,
        toLinkNurseId,
        toAddShiftTeamId,
    });

    return (
        <div
            className="h-[83%] min-h-225.75 w-[40%] min-w-190 rounded-[1.25rem] bg-white px-10.5 py-8.75"
            onClick={(event) => event.stopPropagation()}
        >
            <div className="flex items-center justify-between">
                <h1 className="font-apple text-[1.75rem] font-semibold text-text-1">
                    {connectMode === 'link' ? '연동할 간호사를 선택해 주세요.' : '팀을 선택해 주세요.'}
                </h1>
                <div className="ml-auto flex gap-5">
                    <button
                        className="flex h-7.5 items-center rounded-[1.875rem] border-[.0625rem] border-sub-3 px-[.75rem] font-apple text-[1rem] text-sub-3"
                        onClick={onBack}
                    >
                        이전
                    </button>
                    <button
                        disabled={isNextDisabled}
                        className="flex h-7.5 items-center rounded-[1.875rem] border-[.0625rem] border-main-1 px-[.75rem] font-apple text-[1rem] text-main-1 disabled:border-sub-3 disabled:text-sub-3"
                        onClick={onNext}
                    >
                        다음
                    </button>
                </div>
            </div>
            <p className="pt-[.375rem] font-apple text-[1rem] font-medium text-sub-3">
                {connectMode === 'link'
                    ? '미연동 상태인 간호사 목록 중에 일치하는 계정을 선택해주세요.'
                    : '팀을 선택해주시면 해당 팀에 계정이 추가됩니다.'}
            </p>
            <div className="mt-6 rounded-[1rem] border border-main-3/40 bg-main-4/35 px-5 py-4">
                <p className="font-apple text-[.9375rem] font-semibold text-main-1">선택 결과 미리보기</p>
                <p className="mt-2 font-apple text-[1rem] leading-6 text-sub-1">
                    {targetLabel
                        ? connectMode === 'link'
                            ? `${currentWaitingNurse?.name ?? '선택한 간호사'} 신청이 ${targetLabel} 계정에 연결됩니다.`
                            : `${currentWaitingNurse?.name ?? '선택한 간호사'}님이 ${targetLabel} 팀에 추가됩니다.`
                        : connectMode === 'link'
                          ? '대상 계정을 선택하면 어떤 계정으로 연결되는지 바로 확인할 수 있어요.'
                          : '팀을 선택하면 어느 팀으로 추가되는지 바로 확인할 수 있어요.'}
                </p>
            </div>
            <div
                className={`mb-8 scrollbar-hide flex h-[calc(100%-9.5rem)] items-start gap-10 overflow-y-scroll ${
                    connectMode === 'add' ? 'pt-25.5' : ''
                }`}
            >
                {shiftTeams?.map((shiftTeam) => (
                    <div
                        className={twMerge(
                            'relative mt-5.5 flex w-75 flex-col rounded-2xl border-[.0625rem] border-sub-4.5 shadow-banner',
                            toAddShiftTeamId === shiftTeam.shiftTeamId && 'border-[.125rem] border-main-1',
                        )}
                        key={shiftTeam.shiftTeamId}
                    >
                        {connectMode === 'add' ? (
                            toAddShiftTeamId === shiftTeam.shiftTeamId ? (
                                <CheckedIcon className="absolute -top-6 left-[50%] h-9 w-9 translate-x-[-50%] -translate-y-full cursor-pointer" />
                            ) : (
                                <UncheckedIcon2
                                    className="absolute -top-6 left-[50%] h-9 w-9 translate-x-[-50%] -translate-y-full cursor-pointer"
                                    onClick={() => onSelectShiftTeam(shiftTeam.shiftTeamId)}
                                />
                            )
                        ) : null}
                        <div className="relative flex w-full items-center justify-between rounded-t-[.9375rem] bg-sub-2 px-5 py-[.875rem]">
                            <div className="flex flex-col gap-[.3125rem]">
                                <h2 className="font-apple text-[1.5rem] font-semibold text-white">{shiftTeam.name}</h2>
                                <div className="flex items-center text-white">
                                    <PersonIcon className="h-4 w-4" />
                                    <p className="font-poppins text-[.75rem] text-white">{shiftTeam.nurses.length}</p>
                                </div>
                            </div>
                            <MoreIcon className="h-7.5 w-7.5 cursor-pointer" />
                        </div>
                        {shiftTeam.nurses.length === 0 && (
                            <div className="flex h-14 w-full cursor-pointer items-center justify-center select-none">
                                <h3 className="font-apple text-[1.25rem] font-semibold text-sub-2.5">아직 간호사가 없습니다!</h3>
                            </div>
                        )}
                        {getGroupedDivisionNurses(shiftTeam.nurses).map(([, divisionNurses], divisionIndex) => (
                            <div key={divisionIndex} className="border-b-[.0938rem] border-sub-2.5 last:border-none">
                                {divisionNurses.map((nurse) => (
                                    <div
                                        key={nurse.nurseId}
                                        className={`group relative flex h-14 w-full ${
                                            nurse.isConnected ? 'cursor-default' : 'cursor-pointer'
                                        } items-center justify-center select-none ${
                                            toLinkNurseId === nurse.nurseId
                                                ? 'bg-main-4 text-main-1 underline underline-offset-2'
                                                : 'bg-white text-sub-1'
                                        } ${
                                            shiftTeam.nurses.findIndex((shiftTeamNurse) => shiftTeamNurse.nurseId === nurse.nurseId) ===
                                            shiftTeam.nurses.length - 1
                                                ? 'rounded-b-[.9375rem]'
                                                : 'border-b-[.0313rem] border-b-sub-4.5'
                                        }`}
                                        onClick={() => {
                                            if (!nurse.isConnected) {
                                                onSelectLinkNurse(nurse.nurseId);
                                            }
                                        }}
                                    >
                                        <div className="peer relative font-apple text-[1.25rem] font-semibold text-sub-1">
                                            {nurse.name}
                                            {!nurse.isConnected && (
                                                <div className="absolute top-0 right-[-.3125rem] h-[.3125rem] w-[.3125rem] rounded-full bg-red"></div>
                                            )}
                                        </div>
                                        {!nurse.isConnected && (
                                            <div className="invisible absolute top-0 z-30 flex translate-y-[-60%] items-center gap-[.5rem] rounded-[.3125rem] bg-white px-2 py-1 font-apple text-[.875rem] whitespace-nowrap text-sub-2 shadow-shadow-2 peer-hover:visible">
                                                <div
                                                    className="absolute -bottom-1.5 left-[50%] h-0 w-0 translate-x-[-50%]"
                                                    style={{
                                                        borderTop: '.625rem solid white',
                                                        borderLeft: '.4375rem solid transparent',
                                                        borderRight: '.4375rem solid transparent',
                                                        borderBottom: '.625rem solid none',
                                                    }}
                                                />
                                                연동 되지 않은 가상의 프로필입니다.
                                                <UnlinkedIcon className="h-5 w-5" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ConnectionManageTargetStep;
