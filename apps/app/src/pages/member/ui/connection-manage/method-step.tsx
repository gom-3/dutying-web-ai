import {cn} from '@dutying/utils/style';
import {Link2, PlusCircle} from 'lucide-react';
import {ProfileImage} from '@/entities/account/ui/profile-image';
import {type TWaitingNurse} from '@/entities/nurse';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TConnectMode} from '../../model/connection-manage';
import {getWaitingNurseSummary} from '../../model/connection-manage';

interface IConnectionManageMethodStepProps {
    currentWaitingNurse: TWaitingNurse | null;
    connectMode: TConnectMode;
    onSelectConnectMode: (mode: TConnectMode) => void;
}

function ConnectionManageMethodStep({
    currentWaitingNurse,
    connectMode,
    onSelectConnectMode,
}: IConnectionManageMethodStepProps) {
    const {t} = useTypedTranslation();
    const waitingNurseSummary = currentWaitingNurse ? getWaitingNurseSummary(currentWaitingNurse) : null;

    return (
        <div className="w-full max-w-[620px] rounded-[16px] bg-white px-6 py-5" onClick={(event) => event.stopPropagation()}>
            <h1 className="font-apple text-[22px] font-semibold text-sub-1">{t('page.member.connectionManage.method.title')}</h1>

            <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-[#E3E8F1] bg-[#F9FBFE] px-4 py-3">
                <ProfileImage
                    className="h-9 w-9"
                    name={currentWaitingNurse?.name}
                    profileImg={{profileImgUrl: currentWaitingNurse?.profileImgUrl}}
                />
                <div className="min-w-0">
                    <p className="truncate font-apple text-[15px] font-semibold text-sub-1">{currentWaitingNurse?.name ?? '-'}</p>
                    <p className="font-poppins text-[13px] text-[#7E8798]">{waitingNurseSummary?.formattedPhoneNumber ?? '-'}</p>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                    type="button"
                    className={cn(
                        'flex h-11 items-center justify-center rounded-[10px] px-4 text-center transition-colors',
                        connectMode === 'link'
                            ? 'bg-main-1 text-white'
                            : 'bg-[#EEF2F7] text-[#5E6678] hover:bg-[#E4EAF2]',
                    )}
                    onClick={() => onSelectConnectMode('link')}
                >
                    <span className="inline-flex items-center justify-center gap-2 font-apple text-[15px] font-semibold">
                        <Link2 className="h-4 w-4" strokeWidth={2.6} />
                        {t('page.member.connectionManage.method.link')}
                    </span>
                </button>
                <button
                    type="button"
                    className={cn(
                        'flex h-11 items-center justify-center rounded-[10px] px-4 text-center transition-colors',
                        connectMode === 'add'
                            ? 'bg-main-1 text-white'
                            : 'bg-[#EEF2F7] text-[#5E6678] hover:bg-[#E4EAF2]',
                    )}
                    onClick={() => onSelectConnectMode('add')}
                >
                    <span className="inline-flex items-center justify-center gap-2 font-apple text-[15px] font-semibold">
                        <PlusCircle className="h-4 w-4" strokeWidth={2.6} />
                        {t('page.member.connectionManage.method.add')}
                    </span>
                </button>
            </div>
        </div>
    );
}

export default ConnectionManageMethodStep;
