import {ArrowLeft, ChevronRight} from 'lucide-react';
import {useNavigate} from 'react-router';
import useAuth from '@/features/auth';
import {useCommercialContext} from '@/features/commercial/api';
import {useTranslation} from 'react-i18next';
import wardCodeEnterIcon from '@/shared/assets/images/ward-code-enter-icon.webp';
import wardInfoSettingsIcon from '@/shared/assets/images/ward-info-settings-icon.webp';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

interface ISelectEnterOrCreateProps {
    onBack?: () => void;
}

function SelectEnterOrCreate({onBack}: ISelectEnterOrCreateProps) {
    const {t} = useTypedTranslation();
    const commercial = useCommercialContext();
    const {i18n} = useTranslation();
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
                {commercial.data?.enabled ? (
                    <button
                        type="button"
                        className="flex min-h-24 w-full items-center justify-between rounded-[24px] bg-white p-6 text-left hover:bg-gray-7"
                        onClick={() => navigate('/workspace/adoption')}
                    >
                        <span>
                            <strong className="block text-[20px]">
                                {i18n.language.startsWith('ko') ? '병원 전체 도입' : 'Hospital rollout'}
                            </strong>
                            <span className="mt-2 block text-sm text-gray-3">
                                {i18n.language.startsWith('ko')
                                    ? '여러 병동의 계약과 운영 현황을 관리합니다.'
                                    : 'Manage contracts and overview across wards.'}
                            </span>
                        </span>
                        <ChevronRight className="h-5 w-5" />
                    </button>
                ) : null}
                <button
                    type="button"
                    className="group flex min-h-36 w-full cursor-pointer items-center gap-4 rounded-[24px] bg-white p-6 text-left transition-colors hover:bg-gray-7"
                    onClick={() => navigate(ROUTE.ONBOARDING_WARD_CREATE, {state: {resetOnboardingWardCreateStep: true}})}
                >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center">
                        <img src={wardInfoSettingsIcon} alt="" aria-hidden="true" className="h-12 w-12 object-contain" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[22px] leading-tight font-semibold text-sub-1">
                            {t('page.register.select.createTitle')}
                        </span>
                        <span className="mt-2 block text-sm leading-6 text-gray-3">{t('page.register.select.createDescription')}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-4 transition-transform group-hover:translate-x-0.5" />
                </button>

                <button
                    type="button"
                    className="group flex min-h-24 w-full cursor-pointer items-center gap-4 rounded-[24px] bg-white p-5 text-left transition-colors hover:bg-gray-7"
                    onClick={() => navigate(ROUTE.ENTER_WARD)}
                >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center">
                        <img src={wardCodeEnterIcon} alt="" aria-hidden="true" className="h-10 w-10 object-contain" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[17px] leading-tight font-semibold text-sub-1">
                            {t('page.register.select.enterTitle')}
                        </span>
                        <span className="mt-1 block text-sm leading-6 text-gray-3">{t('page.register.select.enterDescription')}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-4 transition-transform group-hover:translate-x-0.5" />
                </button>
            </div>
        </div>
    );
}

export default SelectEnterOrCreate;
