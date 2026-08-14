import {cn} from '@dutying/utils/style';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {CalendarDays, Hospital, Info} from 'lucide-react';
import {useEffect, useState} from 'react';
import toast from 'react-hot-toast';
import {getWardDisplayCode, getWardDisplayTitle, type TWard, wardQueryKeys, wardQueryOptions} from '@/entities/ward';
import {useEditAccount} from '@/features/account/model';
import useAuth from '@/features/auth';
import {isWardAdminAccessToken} from '@/features/auth/model/admin-token';
import WardAdminsPage from '@/pages/ward-admins';
import {WardAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Card from '@/shared/ui/Card';
import PageState from '@/shared/ui/PageState';
import {Button} from '@/shared/ui/primitives/button';
import {Switch} from '@/shared/ui/primitives/switch';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';
import {showActionErrorFeedback} from '@/shared/util/feedback';
import {NotificationBell} from '@/widgets/notifications/notification-bell';
import WardCodeGuideModal from '@/widgets/ward-code-guide-modal';

type TWardInfoField = 'hospitalName' | 'name';
type TWardInfoForm = Record<TWardInfoField, string>;
type TWardInfoErrors = Partial<Record<TWardInfoField, string>>;
type TWardInfoTouched = Partial<Record<TWardInfoField, boolean>>;

const WARD_NAME_MAX_LENGTH = 20;
const WARD_NAME_ALLOWED_REGEXP = /^[A-Za-z\u3131-\u318E\uAC00-\uD7A3\u3040-\u30FF\u3400-\u9FFF0-9\s]+$/u;
const WARD_NAME_INPUT_SANITIZE_REGEXP = /[^A-Za-z\u3131-\u318E\uAC00-\uD7A3\u3040-\u30FF\u3400-\u9FFF0-9\s]/gu;
const FIELD_CLASS =
    'h-11 w-full rounded-[12px] border border-transparent bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';
const sanitizeWardNameInput = (rawValue: string) => rawValue.replace(WARD_NAME_INPUT_SANITIZE_REGEXP, '').slice(0, WARD_NAME_MAX_LENGTH);

function WardCalendarSettingsSection({
    ward,
    onSave,
}: {
    ward: TWard;
    onSave: (settings: Pick<TWard, 'showMemberBirthdaysInCalendar'>) => Promise<boolean>;
}) {
    const {t} = useTypedTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [infoPinned, setInfoPinned] = useState(false);
    const [infoHovered, setInfoHovered] = useState(false);
    const persistedShowBirthdays = ward.showMemberBirthdaysInCalendar !== false;
    const [draftShowBirthdays, setDraftShowBirthdays] = useState(persistedShowBirthdays);
    const infoOpen = infoPinned || infoHovered;

    useEffect(() => {
        setDraftShowBirthdays(persistedShowBirthdays);
    }, [persistedShowBirthdays]);

    return (
        <Card className="rounded-[24px] border-transparent p-6">
            <h2 className="mb-5 flex items-center gap-2 font-apple text-[20px] font-semibold text-sub-1">
                <CalendarDays aria-hidden="true" className="h-5 w-5 shrink-0 text-main-1" />
                <span>{t('page.wardInfoSettings.calendar.sectionTitle')}</span>
            </h2>
            <div className="flex min-h-14 items-center justify-between gap-3 rounded-[12px] bg-gray-7 px-3.5 py-3">
                <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <p className="font-apple text-[14px] font-semibold text-sub-1">
                            {t('page.wardInfoSettings.calendar.birthdayTitle')}
                        </p>
                        <TooltipProvider delayDuration={120}>
                            <Tooltip
                                open={infoOpen}
                                onOpenChange={(next) => {
                                    if (infoPinned && !next) return;

                                    if (!infoPinned) setInfoHovered(next);
                                }}
                            >
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={t('page.wardInfoSettings.calendar.birthdayInfoAria')}
                                        aria-expanded={infoOpen}
                                        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-gray-3 transition-colors hover:bg-white hover:text-main-1 focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none"
                                        onClick={() => setInfoPinned((prev) => !prev)}
                                        onPointerEnter={() => setInfoHovered(true)}
                                        onPointerLeave={() => setInfoHovered(false)}
                                    >
                                        <Info className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent
                                    side="top"
                                    align="start"
                                    sideOffset={6}
                                    className="max-w-[260px] rounded-[10px] bg-[#1C2331] px-3 py-2 font-apple text-[12px] leading-4 font-medium text-white"
                                >
                                    {t('page.wardInfoSettings.calendar.birthdayDescription')}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
                <Switch
                    checked={draftShowBirthdays}
                    disabled={isSaving}
                    onCheckedChange={async (checked) => {
                        const previousShowBirthdays = draftShowBirthdays;

                        setDraftShowBirthdays(checked);
                        setIsSaving(true);

                        try {
                            const saved = await onSave({showMemberBirthdaysInCalendar: checked});

                            if (saved) {
                                toast.success(t('page.wardInfoSettings.calendar.toast.saveSuccess'));
                            } else {
                                setDraftShowBirthdays(previousShowBirthdays);
                            }
                        } finally {
                            setIsSaving(false);
                        }
                    }}
                    className="relative h-6 w-10 shrink-0 justify-start border-0 bg-sub-4 p-0 shadow-none data-[state=checked]:bg-main-1 data-[state=unchecked]:bg-sub-4"
                    thumbClassName="absolute top-0.5 left-0.5 h-5 w-5 translate-x-0 bg-white shadow-sm data-[state=checked]:translate-x-4"
                    aria-label={t('page.wardInfoSettings.calendar.birthdaySwitchAria')}
                />
            </div>
        </Card>
    );
}

function WardInfoSettingsPage() {
    const {t} = useTypedTranslation();
    const {
        state: {accessToken, wardId},
    } = useAuth();
    const {quitWard} = useEditAccount();
    const queryClient = useQueryClient();
    const wardQuery = useQuery({
        ...wardQueryOptions.id(wardId ?? 0),
        enabled: Boolean(wardId),
    });
    const ward = wardQuery.data;
    const [draft, setDraft] = useState<TWardInfoForm>({hospitalName: '', name: ''});
    const [fieldErrors, setFieldErrors] = useState<TWardInfoErrors>({});
    const [fieldTouched, setFieldTouched] = useState<TWardInfoTouched>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isWardCodeGuideOpen, setIsWardCodeGuideOpen] = useState(false);
    const originalDraft: TWardInfoForm = {
        hospitalName: ward?.hospitalName ?? '',
        name: ward?.name ?? '',
    };
    const isDirty = draft.hospitalName.trim() !== originalDraft.hospitalName.trim() || draft.name.trim() !== originalDraft.name.trim();
    const isSaveDisabled = isSaving || !isDirty;
    const shouldShowNotificationBell = isWardAdminAccessToken(accessToken);
    const getFieldLabel = (field: TWardInfoField) =>
        field === 'hospitalName' ? t('page.wardInfoSettings.hospitalName') : t('page.wardInfoSettings.wardName');
    const validateWardName = (field: TWardInfoField, value: string) => {
        const label = getFieldLabel(field);
        const trimmed = value.trim();

        if (!trimmed) return t('page.wardInfoSettings.validation.required', {label});

        if (trimmed.length > WARD_NAME_MAX_LENGTH || !WARD_NAME_ALLOWED_REGEXP.test(trimmed)) {
            return t('page.wardInfoSettings.validation.invalid', {label, count: WARD_NAME_MAX_LENGTH});
        }

        return undefined;
    };
    const setFieldError = (field: TWardInfoField, value: string) => {
        const message = validateWardName(field, value);

        setFieldErrors((prev) => ({...prev, [field]: message}));

        return message;
    };
    const handleChange = (field: TWardInfoField, value: string) => {
        const nextValue = sanitizeWardNameInput(value);

        setDraft((prev) => ({...prev, [field]: nextValue}));

        if (fieldTouched[field]) setFieldError(field, nextValue);
    };
    const validateForm = () => {
        const nextErrors: TWardInfoErrors = {
            hospitalName: validateWardName('hospitalName', draft.hospitalName),
            name: validateWardName('name', draft.name),
        };

        setFieldErrors(nextErrors);
        setFieldTouched({hospitalName: true, name: true});

        return !nextErrors.hospitalName && !nextErrors.name;
    };
    const save = async () => {
        if (!wardId) return;

        if (!validateForm()) return;

        try {
            setIsSaving(true);

            const nextWard = await WardAPI.editWard(wardId, {
                hospitalName: draft.hospitalName.trim(),
                name: draft.name.trim(),
            });

            setDraft({
                hospitalName: nextWard.hospitalName ?? draft.hospitalName.trim(),
                name: nextWard.name ?? draft.name.trim(),
            });
            queryClient.setQueryData(wardQueryKeys.id(wardId), nextWard);
            await queryClient.invalidateQueries({queryKey: wardQueryKeys.id(wardId)});
            toast.success(t('page.wardInfoSettings.toast.saveSuccess'));
        } catch (error) {
            showActionErrorFeedback(error, t('page.wardInfoSettings.toast.saveFailed'));
        } finally {
            setIsSaving(false);
        }
    };
    const updateCalendarSettings = async (settings: Pick<TWard, 'showMemberBirthdaysInCalendar'>) => {
        if (!wardId) return false;

        try {
            const nextWard = await WardAPI.editWard(wardId, settings);

            queryClient.setQueryData(wardQueryKeys.id(wardId), nextWard);
            await Promise.all([
                queryClient.invalidateQueries({queryKey: wardQueryKeys.id(wardId)}),
                queryClient.invalidateQueries({queryKey: ['ward-board', 'schedules', wardId]}),
                queryClient.invalidateQueries({queryKey: ['home', 'board-schedules']}),
            ]);

            return true;
        } catch (error) {
            showActionErrorFeedback(error, t('page.wardInfoSettings.calendar.toast.updateFailed'));

            return false;
        }
    };

    useEffect(() => {
        if (!ward) return;

        setDraft({
            hospitalName: ward.hospitalName ?? '',
            name: ward.name ?? '',
        });
        setFieldErrors({});
        setFieldTouched({});
    }, [ward]);

    if (!wardId) {
        return (
            <div className="mx-auto flex h-full w-full max-w-306 items-center justify-center px-8">
                <PageState
                    tone="empty"
                    title={t('page.wardInfoSettings.state.noWardTitle')}
                    description={t('page.wardInfoSettings.state.noWardDescription')}
                    className="py-0"
                />
            </div>
        );
    }

    if (wardQuery.isPending) {
        return (
            <div className="mx-auto flex h-full w-full max-w-306 items-center justify-center px-8">
                <PageState tone="loading" title={t('page.wardInfoSettings.state.loadingTitle')} className="py-0" />
            </div>
        );
    }

    if (wardQuery.isError || !ward) {
        return (
            <div className="mx-auto flex h-full w-full max-w-306 items-center justify-center px-8">
                <PageState
                    tone="error"
                    title={t('page.wardInfoSettings.state.loadFailedTitle')}
                    description={t('page.wardInfoSettings.state.retryDescription')}
                    action={{label: t('page.wardInfoSettings.state.retry'), onClick: () => void wardQuery.refetch()}}
                    className="py-0"
                />
            </div>
        );
    }

    const wardCode = getWardDisplayCode(ward);
    const wardTitle = getWardDisplayTitle(ward);

    return (
        <div className="mx-auto w-full max-w-[560px] px-4 py-8 md:px-0">
            <div className="relative mx-auto flex max-w-[480px] items-start justify-between gap-4">
                {shouldShowNotificationBell ? (
                    <div className="pointer-events-none absolute top-0 right-0 z-[1002]">
                        <NotificationBell />
                    </div>
                ) : null}
                <div>
                    <h1 className="font-apple text-[32px] font-semibold tracking-normal text-sub-1">{t('page.wardInfoSettings.title')}</h1>
                </div>
            </div>

            <div className="mx-auto mt-6 max-w-[480px] space-y-4">
                <Card className="rounded-[24px] border-transparent p-6">
                    <h2 className="mb-5 flex items-center gap-2 font-apple text-[20px] font-semibold text-sub-1">
                        <Hospital aria-hidden="true" className="h-5 w-5 shrink-0 text-main-1" />
                        <span>{t('page.wardInfoSettings.sectionTitle')}</span>
                    </h2>
                    <div className="grid grid-cols-1 gap-3">
                        <div className="max-w-[440px]">
                            <p className="mb-1.5 block font-apple text-sm font-medium text-sub-2">{t('page.wardInfoSettings.wardCode')}</p>
                            <button
                                type="button"
                                aria-label={t('page.navigationBar.wardCodeGuideAria', {wardCode})}
                                className="inline-flex items-center rounded-full bg-main-light px-3 py-1.5 transition-colors hover:bg-main-4 focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none"
                                onClick={() => setIsWardCodeGuideOpen(true)}
                            >
                                <span className="font-poppins text-[13px] leading-none font-semibold text-main-1">{wardCode}</span>
                            </button>
                        </div>
                        <div className="max-w-[440px]">
                            <label htmlFor="hospitalName" className="mb-1.5 block font-apple text-sm font-medium text-sub-2">
                                {t('page.wardInfoSettings.hospitalName')}
                            </label>
                            <input
                                id="hospitalName"
                                className={cn(FIELD_CLASS, fieldErrors.hospitalName && 'border-red bg-[#FFF7F8] focus-visible:bg-white')}
                                maxLength={WARD_NAME_MAX_LENGTH}
                                placeholder={t('page.wardInfoSettings.hospitalNamePlaceholder')}
                                value={draft.hospitalName}
                                onChange={(event) => handleChange('hospitalName', event.target.value)}
                                onBlur={(event) => {
                                    setFieldTouched((prev) => ({...prev, hospitalName: true}));
                                    setFieldError('hospitalName', event.target.value);
                                }}
                                aria-invalid={Boolean(fieldErrors.hospitalName)}
                                aria-describedby={fieldErrors.hospitalName ? 'ward-hospital-name-error' : undefined}
                            />
                            {fieldErrors.hospitalName ? (
                                <p id="ward-hospital-name-error" className="mt-1 font-apple text-xs text-red">
                                    {fieldErrors.hospitalName}
                                </p>
                            ) : null}
                        </div>
                        <div className="max-w-[440px]">
                            <label htmlFor="wardName" className="mb-1.5 block font-apple text-sm font-medium text-sub-2">
                                {t('page.wardInfoSettings.wardName')}
                            </label>
                            <input
                                id="wardName"
                                className={cn(FIELD_CLASS, fieldErrors.name && 'border-red bg-[#FFF7F8] focus-visible:bg-white')}
                                maxLength={WARD_NAME_MAX_LENGTH}
                                placeholder={t('page.wardInfoSettings.wardNamePlaceholder')}
                                value={draft.name}
                                onChange={(event) => handleChange('name', event.target.value)}
                                onBlur={(event) => {
                                    setFieldTouched((prev) => ({...prev, name: true}));
                                    setFieldError('name', event.target.value);
                                }}
                                aria-invalid={Boolean(fieldErrors.name)}
                                aria-describedby={fieldErrors.name ? 'ward-name-error' : undefined}
                            />
                            {fieldErrors.name ? (
                                <p id="ward-name-error" className="mt-1 font-apple text-xs text-red">
                                    {fieldErrors.name}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </Card>
                <WardCalendarSettingsSection ward={ward} onSave={updateCalendarSettings} />
            </div>

            <div className="mx-auto mt-4 max-w-[480px]">
                <WardAdminsPage />
            </div>

            <div className="mx-auto mt-4 flex max-w-[480px] items-center justify-end px-1">
                <button
                    type="button"
                    className="cursor-pointer bg-transparent p-0 font-apple text-sm font-medium text-gray-3 underline-offset-4 hover:underline"
                    onClick={() => void quitWard()}
                >
                    {t('page.wardInfoSettings.quitWard')}
                </button>
            </div>

            <div className="mx-auto mt-6 flex max-w-[480px] items-center justify-end">
                <Button type="button" onClick={() => void save()} disabled={isSaveDisabled} className="h-11 rounded-[12px] px-5 text-sm">
                    {isSaving ? t('page.wardInfoSettings.saving') : t('page.wardInfoSettings.save')}
                </Button>
            </div>
            <WardCodeGuideModal
                open={isWardCodeGuideOpen}
                wardCode={wardCode}
                wardTitle={wardTitle}
                onClose={() => setIsWardCodeGuideOpen(false)}
            />
        </div>
    );
}

export default WardInfoSettingsPage;
