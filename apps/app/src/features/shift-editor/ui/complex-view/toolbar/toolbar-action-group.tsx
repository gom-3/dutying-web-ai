import {events, sendEvent} from '@/analytics';
import {type TShiftTeam} from '@/entities';
import {
    CameraIcon,
    DutyIconSelected,
    HistoryBackIcon,
    HistoryNextIcon,
    PenIcon,
    SaveCompleteIcon,
    SavingIcon,
    ShareIcon,
} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Button from '@/shared/ui/form-controls/Button';
import Select from '@/shared/ui/form-controls/Select';
import {showValidationFeedback} from '@/shared/util/feedback';

type TToolbarActionGroupProps = {
    year: number;
    month: number;
    readonly: boolean;
    saveStatus: 'pending' | 'saved';
    currentShiftTeam: TShiftTeam | null;
    shiftTeams: TShiftTeam[] | null;
    onUndo: () => void;
    onRedo: () => void;
    onPostShift: () => void;
    onToggleEditMode: () => void;
    onDownloadExcel: () => void;
    onDownloadImage: () => void;
    onCreateNextMonth: () => void;
    onChangeShiftTeam: (shiftTeamId: number) => void;
    isDownloadingExcel: boolean;
    isDownloadingImage: boolean;
};

export function ToolbarActionGroup({
    year,
    month,
    readonly,
    saveStatus,
    currentShiftTeam,
    shiftTeams,
    onUndo,
    onRedo,
    onPostShift,
    onToggleEditMode,
    onDownloadExcel,
    onDownloadImage,
    onCreateNextMonth,
    onChangeShiftTeam,
    isDownloadingExcel,
    isDownloadingImage,
}: TToolbarActionGroupProps) {
    const {t} = useTypedTranslation();

    return (
        <>
            {!readonly && (
                <div className="ml-auto flex gap-[.3125rem] font-apple text-[.875rem] text-sub-2.5">
                    {saveStatus === 'pending' ? <SavingIcon className="h-5 w-5" /> : <SaveCompleteIcon className="h-5 w-5" />}
                    {saveStatus === 'pending'
                        ? t('feature.shiftEditor.toolbar.savingStatus')
                        : t('feature.shiftEditor.toolbar.savedStatus')}
                    <div className="ml-7.5 flex gap-[.625rem]">
                        <HistoryBackIcon
                            className="h-6.5 w-6.5 cursor-pointer"
                            onClick={() => {
                                onUndo();
                                sendEvent(events.makePage.toolbar.undoBytoolbar);
                            }}
                        />
                        <HistoryNextIcon
                            className="h-6.5 w-6.5 cursor-pointer"
                            onClick={() => {
                                onRedo();
                                sendEvent(events.makePage.toolbar.redoByToolbar);
                            }}
                        />
                    </div>
                </div>
            )}

            <div>
                {currentShiftTeam && (
                    <Select
                        value={currentShiftTeam.shiftTeamId}
                        options={shiftTeams?.map((shiftTeam) => ({
                            label: shiftTeam.name,
                            value: shiftTeam.shiftTeamId,
                        }))}
                        className="ml-7.5 h-11.5 w-42 font-apple text-[1.25rem] font-semibold text-main-1"
                        selectClassName="outline-[.0938rem] outline-main-1"
                        onChange={(e) => onChangeShiftTeam(parseInt(e.target.value))}
                    />
                )}
            </div>

            {readonly ? (
                <div className="ml-auto flex gap-[10px]">
                    <Button
                        variant="default"
                        className="flex h-10 items-center justify-center rounded-[.625rem] bg-main-2 px-[.75rem] text-[1.25rem] font-semibold"
                        onClick={() => {
                            onPostShift();
                            sendEvent(events.makePage.toolbar.postShift);
                        }}
                        disabled={new Date(year, month + 1, 1) <= new Date()}
                    >
                        {t('feature.shiftEditor.toolbar.publish')}
                    </Button>
                    <Button
                        id="editButton"
                        variant="default"
                        className="flex h-10 items-center justify-center gap-[.5rem] rounded-[.625rem] bg-main-2 pr-[.5rem] pl-[.75rem] text-[1.25rem] font-semibold"
                        onClick={() => {
                            onToggleEditMode();
                            sendEvent(events.makePage.toolbar.changeEditMode);
                        }}
                        disabled={new Date(year, month + 1, 1) <= new Date()}
                    >
                        {t('feature.shiftEditor.toolbar.edit')}
                        <PenIcon className="h-6 w-6 stroke-white" />
                    </Button>
                    <Button
                        id="El2"
                        variant="default"
                        className="flex h-10 items-center justify-center gap-[.5rem] rounded-[.625rem] bg-main-2 pr-[.5rem] pl-[.75rem] text-[1.25rem] font-semibold"
                        disabled={isDownloadingImage}
                        onClick={() => {
                            onDownloadImage();
                            sendEvent(events.makePage.toolbar.downloadImage);
                        }}
                    >
                        {isDownloadingImage
                            ? t('feature.shiftEditor.toolbar.savingImage')
                            : t('feature.shiftEditor.toolbar.saveImage')}
                        <CameraIcon className="h-6 w-6 stroke-white" />
                    </Button>
                    <Button
                        id="El3"
                        variant="default"
                        className="flex h-10 items-center justify-center gap-[.5rem] rounded-[.625rem] bg-main-2 pr-[.5rem] pl-[.75rem] text-[1.25rem] font-semibold"
                        disabled={isDownloadingExcel}
                        onClick={() => {
                            onDownloadExcel();
                            sendEvent(events.makePage.toolbar.downloadExcel);
                        }}
                    >
                        {isDownloadingExcel
                            ? t('feature.shiftEditor.toolbar.savingExcel')
                            : t('feature.shiftEditor.toolbar.saveExcel')}
                        <ShareIcon className="h-6 w-6" />
                    </Button>
                    <Button
                        variant="outline"
                        className="flex h-10 w-59 items-center justify-center gap-[.5rem] rounded-[.625rem] text-[1.25rem] font-semibold"
                        onClick={() => {
                            onCreateNextMonth();
                            sendEvent(events.makePage.toolbar.editNextMonth);
                        }}
                    >
                        {t('feature.shiftEditor.toolbar.createNextMonth')}
                        <DutyIconSelected className="h-6 w-6" />
                    </Button>
                </div>
            ) : (
                <div className="ml-5 flex gap-[.875rem]">
                    <Button
                        variant="default"
                        className="h-10 w-33 rounded-[3.125rem] border-none bg-[rgba(171,171,180,0.80)] text-[1.25rem] font-semibold text-white"
                        onClick={() => showValidationFeedback(t('feature.shiftEditor.toolbar.notReady'))}
                    >
                        {t('feature.shiftEditor.toolbar.autofill')}
                    </Button>
                    <Button
                        className="h-10 rounded-[3.125rem] border-main-1 bg-white px-5 text-[1.25rem] font-semibold text-main-1 transition-all hover:bg-main-1 hover:text-white"
                        onClick={onToggleEditMode}
                    >
                        {t('feature.shiftEditor.toolbar.save')}
                    </Button>
                </div>
            )}
        </>
    );
}
