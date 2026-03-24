import {cn} from '@dutying/utils/style';
import {Info, X} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';
import {getSkillPalette, skillPalettes, type TSkillLevelConfig} from '../../model';
import WizardButton from '../wizard-button';
import {SkillBadge} from './badges';

interface ISkillLevelModalProps {
    open: boolean;
    config: TSkillLevelConfig;
    onClose: () => void;
    onSave: (config: TSkillLevelConfig) => void;
}

function SkillLevelModal({open, config, onClose, onSave}: ISkillLevelModalProps) {
    const {t} = useTypedTranslation();
    const [localConfig, setLocalConfig] = useState(config);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    if (!open) {
        return null;
    }

    const palette = getSkillPalette(localConfig.paletteId);
    const levelItems = Array.from({length: localConfig.levelCount}, (_, index) => localConfig.levelCount - index);

    return (
        <div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/60 px-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-[710px] rounded-[20px] bg-white px-[42px] py-10">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="font-apple text-[32px] font-semibold text-text-1">
                            {t('page.onboardingWardCreate.skillLevelModal.title')}
                        </h2>
                        <p className="mt-2 font-apple text-[20px] font-medium text-gray-3">
                            {t('page.onboardingWardCreate.skillLevelModal.description')}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-4 hover:bg-gray-7">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-10 flex items-center gap-4">
                    <select
                        value={localConfig.levelCount}
                        onChange={(event) => setLocalConfig((prev) => ({...prev, levelCount: Number(event.target.value)}))}
                        className="h-9 rounded-[5px] border border-gray-6 bg-gray-7 px-3 font-apple text-[16px] text-sub-1 outline-none"
                    >
                        {[2, 3, 4, 5].map((levelCount) => (
                            <option key={levelCount} value={levelCount}>
                                {t('page.onboardingWardCreate.skillLevelModal.levelCountOption', {levelCount})}
                            </option>
                        ))}
                    </select>
                    <div className="flex items-center gap-2">
                        {skillPalettes.map((candidate) => (
                            <button
                                key={candidate.id}
                                type="button"
                                aria-label={`${candidate.id} palette`}
                                onClick={() => setLocalConfig((prev) => ({...prev, paletteId: candidate.id}))}
                                className={cn(
                                    'flex rounded-full border-2 p-1',
                                    candidate.id === localConfig.paletteId ? 'border-main-1' : 'border-transparent',
                                )}
                            >
                                {candidate.colors.slice(0, 4).map((color) => (
                                    <span
                                        key={color}
                                        className="h-4 w-4 rounded-full border border-white"
                                        style={{backgroundColor: color}}
                                    />
                                ))}
                            </button>
                        ))}
                        <span className="font-apple text-[20px] font-medium text-sub-2">
                            {t('page.onboardingWardCreate.skillLevelModal.colorLabel')}
                        </span>
                    </div>
                </div>

                <div className="mt-6 rounded-[10px] border border-gray-5">
                    <div className="grid grid-cols-[72px_1fr]">
                        <div className="from-gray-2 rounded-l-[10px] bg-gradient-to-b to-gray-5 px-4 py-6 text-center font-apple text-[20px] font-semibold text-white">
                            <div className="h-[176px]">
                                <p>{t('page.onboardingWardCreate.skillLevelModal.high')}</p>
                                <div className="flex h-full items-end justify-center">
                                    <p className="text-text-1">{t('page.onboardingWardCreate.skillLevelModal.low')}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-5 px-8 py-6">
                            <div className="grid grid-cols-[100px_1fr] text-center font-apple text-[16px] text-gray-3">
                                <span>{t('page.onboardingWardCreate.skillLevelModal.levelLabel')}</span>
                                <span>{t('page.onboardingWardCreate.skillLevelModal.categoryLabel')}</span>
                            </div>
                            {levelItems.map((level) => (
                                <div key={level} className="grid grid-cols-[100px_1fr] items-center">
                                    <div className="flex justify-center">
                                        <SkillBadge level={level} config={{...localConfig, paletteId: palette.id}} />
                                    </div>
                                    <div className="rounded-[5px] bg-gray-6/70 px-4 py-1.5 font-apple text-[16px] text-gray-3">
                                        {t('page.onboardingWardCreate.skillLevelModal.levelDisplay', {level})}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                    <input
                        id="skill-auto-assign"
                        type="checkbox"
                        checked={localConfig.autoAssign}
                        onChange={(event) => setLocalConfig((prev) => ({...prev, autoAssign: event.target.checked}))}
                    />
                    <label htmlFor="skill-auto-assign" className="font-apple text-[16px] text-gray-3">
                        {t('page.onboardingWardCreate.skillLevelModal.autoAssign')}
                    </label>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" className="text-gray-4">
                                    <Info className="h-4 w-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[220px] bg-gray-6 text-sub-1">
                                {t('page.onboardingWardCreate.skillLevelModal.autoAssignTooltip')}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <div className="mt-10 flex items-center justify-between">
                    <button type="button" className="font-apple text-[20px] text-gray-4 underline underline-offset-2" onClick={onClose}>
                        {t('page.onboardingWardCreate.skillLevelModal.cancel')}
                    </button>
                    <WizardButton
                        onClick={() => {
                            onSave(localConfig);
                            onClose();
                        }}
                    >
                        {t('page.onboardingWardCreate.skillLevelModal.complete')}
                    </WizardButton>
                </div>
            </div>
        </div>
    );
}

export default SkillLevelModal;
