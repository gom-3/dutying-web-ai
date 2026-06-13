import {type TCreateWardDTO} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {yupResolver} from '@hookform/resolvers/yup';
import {ArrowLeft, Save} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useForm} from 'react-hook-form';
import {useNavigate} from 'react-router';
import useRegister from '@/features/register';
import {registerWardSchema} from '@/features/register-ward/model/schema';
import {createDefaultWardShiftTypes, getWardShiftValidationMessage} from '@/features/register-ward/model/ward';
import RegisterWardShiftTeamsSection from '@/features/register-ward/ui/register-ward-shift-teams-section';
import RegisterWardShiftTypesSection from '@/features/register-ward/ui/register-ward-shift-types-section';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import ValidationMessage from '@/shared/ui/ValidationMessage';
import RegisterShell from './register-shell';

const FIELD_CLASS =
    'h-11 w-full rounded-[12px] bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';

function RegisterWard() {
    const {t} = useTypedTranslation();
    const [shiftTeams, setShiftTeams] = useState<string[][]>([[]]);
    const [wardShiftTypes, setWardShiftTypes] = useState<TCreateWardDTO['wardShiftTypes']>(() => createDefaultWardShiftTypes(t));
    const [wardShiftError, setWardShiftError] = useState<string | null>(null);
    const {
        formState: {errors, isValid},
        register,
        handleSubmit,
    } = useForm({
        mode: 'onTouched',
        defaultValues: {
            name: '',
            hospitalName: '',
        },
        resolver: yupResolver(registerWardSchema),
    });
    const {
        state: {accountMe},
        actions: {createWard},
    } = useRegister();
    const navigate = useNavigate();
    const hospitalNameError = errors.hospitalName ? t('page.register.createWard.validation.wardName') : undefined;
    const wardNameError = errors.name ? t('page.register.createWard.validation.wardName') : undefined;

    useEffect(() => {
        if (accountMe?.status !== 'WARD_SELECT_PENDING') navigate(ROUTE.REGISTER);
    }, [accountMe, navigate]);

    useEffect(() => {
        setWardShiftError(null);
    }, [wardShiftTypes]);

    return (
        <RegisterShell maxWidth="max-w-[760px]">
            <form
                onSubmit={handleSubmit((data) => {
                    const validationMessage = getWardShiftValidationMessage(wardShiftTypes);

                    if (validationMessage) {
                        setWardShiftError(validationMessage);

                        return;
                    }

                    setWardShiftError(null);
                    createWard({
                        name: data.name,
                        hospitalName: data.hospitalName,
                        shiftTeams: shiftTeams
                            .map((shiftTeam) => shiftTeam.map((nurseName) => nurseName.trim()).filter(Boolean))
                            .filter((nurseNames) => nurseNames.length > 0)
                            .map((nurseNames) => ({nurseNames})),
                        wardShiftTypes,
                    });
                })}
                className="flex w-full flex-col"
            >
                <button
                    type="button"
                    className="mb-6 flex h-10 w-fit cursor-pointer items-center gap-2 rounded-[12px] bg-white px-3 text-sm font-medium text-gray-3 transition-colors hover:bg-gray-7"
                    onClick={() => navigate(ROUTE.REGISTER)}
                >
                    <ArrowLeft className="h-4 w-4" />
                    {t('page.register.createWard.back')}
                </button>

                <div>
                    <h1 className="text-[32px] font-semibold text-sub-1">{t('page.register.createWard.title')}</h1>
                    <p className="mt-2 text-sm text-gray-3">{t('page.register.createWard.description')}</p>
                </div>

                <section className="mt-6 rounded-[24px] bg-white p-6">
                    <h2 className="text-[20px] font-semibold text-sub-1">{t('page.register.createWard.basicInfo')}</h2>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_0.8fr]">
                        <div>
                            <label htmlFor="hospitalName" className="mb-1.5 block text-sm font-medium text-sub-2">
                                {t('page.register.createWard.hospitalName')}
                            </label>
                            <input
                                id="hospitalName"
                                className={cn(FIELD_CLASS, hospitalNameError && 'bg-[#FFF1F6]')}
                                placeholder={t('page.register.createWard.hospitalNamePlaceholder')}
                                aria-invalid={Boolean(hospitalNameError)}
                                aria-describedby={hospitalNameError ? 'hospital-name-error' : undefined}
                                {...register('hospitalName')}
                            />
                            {hospitalNameError ? (
                                <p id="hospital-name-error" className="mt-1 text-xs text-red">
                                    {hospitalNameError}
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label htmlFor="wardName" className="mb-1.5 block text-sm font-medium text-sub-2">
                                {t('page.register.createWard.wardName')}
                            </label>
                            <input
                                id="wardName"
                                className={cn(FIELD_CLASS, wardNameError && 'bg-[#FFF1F6]')}
                                placeholder="7A"
                                aria-invalid={Boolean(wardNameError)}
                                aria-describedby={wardNameError ? 'ward-name-error' : undefined}
                                {...register('name')}
                            />
                            {wardNameError ? (
                                <p id="ward-name-error" className="mt-1 text-xs text-red">
                                    {wardNameError}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </section>

                <RegisterWardShiftTypesSection wardShiftTypes={wardShiftTypes} setWardShiftTypes={setWardShiftTypes} />
                <ValidationMessage message={wardShiftError} className="mt-3" />
                <RegisterWardShiftTeamsSection shiftTeams={shiftTeams} setShiftTeams={setShiftTeams} />

                <button
                    type="submit"
                    disabled={!isValid}
                    className="mt-6 h-11 cursor-pointer gap-2 self-end rounded-[12px] bg-main-1 px-5 text-sm font-semibold text-white transition-colors hover:bg-main-1-hover disabled:cursor-not-allowed disabled:bg-main-3"
                >
                    <Save className="h-4 w-4" />
                    {t('page.register.createWard.save')}
                </button>
            </form>
        </RegisterShell>
    );
}

export default RegisterWard;
