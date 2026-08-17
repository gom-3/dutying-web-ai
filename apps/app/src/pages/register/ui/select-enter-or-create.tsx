import {ArrowLeft, ChevronRight, DoorOpen} from 'lucide-react';
import {useNavigate} from 'react-router';
import useAuth from '@/features/auth';
import wardInfoSettingsIcon from '@/shared/assets/images/ward-info-settings.png';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

interface ISelectEnterOrCreateProps {
    onBack?: () => void;
}

function SelectEnterOrCreate({onBack}: ISelectEnterOrCreateProps) {
    const {t} = useTypedTranslation();
    const {
        state: {accountMe},
    } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="flex w-full flex-col">
            {onBack ? (
                <button
                    type="button"
                    className="mb-6 flex h-10 w-fit cursor-pointer items-center gap-2 rounded-[12px] bg-white px-3 text-sm font-medium text-gray-3 transition-colors hover:bg-gray-7"
                    onClick={onBack}
                >
                    <ArrowLeft className="h-4 w-4" />
                    {t('page.register.select.back')}
                </button>
            ) : null}

            <div>
                <h1 className="text-[32px] font-semibold text-sub-1">
                    {accountMe?.name
                        ? t('page.register.select.titleWithName', {name: accountMe.name})
                        : t('page.register.select.titleWithoutName')}
                </h1>
                <p className="mt-2 text-sm text-gray-3">{t('page.register.select.description')}</p>
            </div>

            <div className="mt-6 space-y-3">
                <button
                    type="button"
                    className="group flex min-h-36 w-full cursor-pointer items-center gap-4 rounded-[24px] bg-white p-6 text-left transition-colors hover:bg-gray-7"
                    onClick={() => navigate(ROUTE.ONBOARDING_WARD_CREATE, {state: {resetOnboardingWardCreateStep: true}})}
                >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-main-light text-main-1">
                        <img src={wardInfoSettingsIcon} alt="" aria-hidden="true" className="h-12 w-12 object-contain" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[22px] leading-tight font-semibold text-sub-1">{t('page.register.select.createTitle')}</span>
                        <span className="mt-2 block text-sm leading-6 text-gray-3">{t('page.register.select.createDescription')}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-4 transition-transform group-hover:translate-x-0.5" />
                </button>

                <button
                    type="button"
                    className="group flex min-h-24 w-full cursor-pointer items-center gap-4 rounded-[24px] bg-white p-5 text-left transition-colors hover:bg-gray-7"
                    onClick={() => navigate(ROUTE.ENTER_WARD)}
                >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-main-light text-main-1">
                        <DoorOpen className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[17px] leading-tight font-semibold text-sub-1">{t('page.register.select.enterTitle')}</span>
                        <span className="mt-1 block text-sm leading-6 text-gray-3">{t('page.register.select.enterDescription')}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-4 transition-transform group-hover:translate-x-0.5" />
                </button>
            </div>
        </div>
    );
}

export default SelectEnterOrCreate;
