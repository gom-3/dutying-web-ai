import {createPortal} from 'react-dom';
import Draggable from 'react-draggable';
import {type TWardConstraint} from '@/entities';
import {CancelIcon} from '@/shared/assets/svg';
import {useTypedTranslation, type TI18nKey} from '@/shared/hook/use-typed-translation';
import SetConstraint from '../edit-ward/set-constraint';
import SetDesignTheme from '../edit-ward/set-design-theme';
import SetShiftType from '../edit-ward/set-shift-type';
import {type TToolbarSetupTab} from '../types';

type TToolbarSettingsPanelProps = {
    currentSetup: TToolbarSetupTab | null;
    wardConstraint: TWardConstraint | null;
    onSelectSetup: (setup: TToolbarSetupTab) => void;
    onClose: () => void;
    onUpdateConstraint: (constraint: TWardConstraint) => void;
};

const setupTabs: {key: TToolbarSetupTab; labelKey: TI18nKey}[] = [
    {key: 'constraint', labelKey: 'feature.shiftEditor.toolbar.settings.constraint'},
    {key: 'shiftType', labelKey: 'feature.shiftEditor.toolbar.settings.shiftType'},
    {key: 'designTheme', labelKey: 'feature.shiftEditor.toolbar.settings.designTheme'},
];

export function ToolbarSettingsPanel({
    currentSetup,
    wardConstraint,
    onSelectSetup,
    onClose,
    onUpdateConstraint,
}: TToolbarSettingsPanelProps) {
    const {t} = useTypedTranslation();

    if (currentSetup === null) return null;

    return createPortal(
        <Draggable>
            <div className="absolute top-22 left-70.5 z-1001 flex flex-col rounded-[1.25rem] bg-white shadow-shadow-3">
                <div className="flex h-11 cursor-move items-center rounded-t-[1.25rem] bg-sub-5">
                    {setupTabs.map((tab) => (
                        <div
                            key={tab.key}
                            className={`flex h-full w-37.5 cursor-pointer items-center justify-center rounded-t-[1.25rem] font-apple text-base ${
                                currentSetup === tab.key ? 'bg-white text-main-1' : 'text-sub-3'
                            } `}
                            onClick={() => onSelectSetup(tab.key)}
                        >
                            {t(tab.labelKey)}
                        </div>
                    ))}
                    <CancelIcon className="absolute right-[.5rem] h-6 w-6 cursor-pointer" onClick={onClose} />
                </div>
                {currentSetup === 'constraint' && wardConstraint && (
                    <SetConstraint wardConstraint={wardConstraint} onUpdateConstraint={onUpdateConstraint} />
                )}
                {currentSetup === 'shiftType' && <SetShiftType />}
                {currentSetup === 'designTheme' && <SetDesignTheme />}
            </div>
        </Draggable>,
        document.getElementById('edit-modal-root')!,
    );
}
