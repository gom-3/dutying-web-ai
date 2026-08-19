import {type TReqShiftReceptionSettingsResponse, type TUpdateReqShiftReceptionSettingsDTO} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import * as Dialog from '@radix-ui/react-dialog';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {X} from 'lucide-react';
import {wardQueryKeys, wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {DEFAULT_REQ_SHIFT_RECEPTION_SETTINGS} from '@/pages/ward-settings/model/ward-settings-hook';
import {RequestReceptionContent, type TRequestReceptionStatus} from '@/pages/ward-settings/ui/request-reception-content';
import {WardAPI} from '@/shared/api';
import requestReceptionIcon from '@/shared/assets/images/request-reception-icon.webp';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {showActionErrorFeedback} from '@/shared/util/feedback';

type TRequestReceptionSettingsModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const REQUEST_RECEPTION_SETTINGS_STALE_TIME_MS = 1000 * 60 * 5;

async function getReqShiftReceptionSettingsOrDefault(wardId: number): Promise<TReqShiftReceptionSettingsResponse> {
    try {
        return await WardAPI.getReqShiftReceptionSettings(wardId);
    } catch {
        return DEFAULT_REQ_SHIFT_RECEPTION_SETTINGS;
    }
}

function RequestReceptionSettingsModal({open, onOpenChange}: TRequestReceptionSettingsModalProps) {
    const {t} = useTypedTranslation();
    const {
        state: {wardId},
    } = useAuth();
    const queryClient = useQueryClient();
    const requestReceptionSettingsQuery = useQuery({
        ...wardQueryOptions.requestReceptionSettings(wardId ?? -1),
        queryFn: () => (wardId === null ? DEFAULT_REQ_SHIFT_RECEPTION_SETTINGS : getReqShiftReceptionSettingsOrDefault(wardId)),
        enabled: open && wardId !== null,
        retry: false,
        staleTime: REQUEST_RECEPTION_SETTINGS_STALE_TIME_MS,
    });
    const status: TRequestReceptionStatus =
        requestReceptionSettingsQuery.isFetching && !requestReceptionSettingsQuery.data
            ? 'pending'
            : requestReceptionSettingsQuery.isError
              ? 'error'
              : 'success';
    const portalContainer = typeof document === 'undefined' ? undefined : (document.getElementById('modal-root') ?? document.body);
    const retryRequestReceptionSettings = async () => {
        await requestReceptionSettingsQuery.refetch();
    };
    const updateRequestReceptionSettings = async (settings: TUpdateReqShiftReceptionSettingsDTO) => {
        if (!wardId) return false;

        try {
            await WardAPI.updateReqShiftReceptionSettings(wardId, settings);
            await queryClient.invalidateQueries({queryKey: wardQueryKeys.requestReceptionSettings(wardId)});
            onOpenChange(false);

            return true;
        } catch (error) {
            showActionErrorFeedback(error, t('page.wardSettings.requestReception.toast.updateFailed'));

            return false;
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal container={portalContainer}>
                <Dialog.Overlay className="fixed inset-0 z-[1100] overflow-y-auto bg-[#111827]/55 px-4 py-8 backdrop-blur-[2px] sm:py-10">
                    <Dialog.Content
                        className={cn(
                            'relative z-[1101] mx-auto w-full max-w-[860px] overflow-hidden rounded-[22px] bg-white shadow-[0_24px_80px_rgba(18,23,38,0.2)] focus-visible:outline-none',
                        )}
                    >
                        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5">
                            <div className="flex min-w-0 items-start gap-3">
                                <img src={requestReceptionIcon} alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain" />
                                <div className="min-w-0">
                                    <Dialog.Title className="font-apple text-[24px] leading-8 font-semibold text-sub-1">
                                        {t('page.wardSettings.tabs.requestReception')}
                                    </Dialog.Title>
                                    <Dialog.Description className="mt-1 font-apple text-[13px] leading-5 text-gray-3">
                                        {t('page.wardSettings.description.requestReception')}
                                    </Dialog.Description>
                                </div>
                            </div>
                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-7 text-gray-3 transition-colors hover:bg-gray-6 hover:text-sub-1"
                                    aria-label={t('shared.confirmActionDialog.close')}
                                >
                                    <X className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </Dialog.Close>
                        </div>
                        <div className="bg-[#F4F6F8] px-5 py-5">
                            <RequestReceptionContent
                                settings={requestReceptionSettingsQuery.data ?? DEFAULT_REQ_SHIFT_RECEPTION_SETTINGS}
                                status={status}
                                onSave={updateRequestReceptionSettings}
                                onRetry={retryRequestReceptionSettings}
                            />
                        </div>
                    </Dialog.Content>
                </Dialog.Overlay>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

export default RequestReceptionSettingsModal;
