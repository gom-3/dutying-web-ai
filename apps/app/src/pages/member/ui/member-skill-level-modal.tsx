import {cn} from '@dutying/utils/style';
import {Info, Pencil, X} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {getSkillPalette, skillPalettes, type TSkillLevelConfig} from '@/features/ward-skill/model/skill-level';
import SkillBadge from '@/features/ward-skill/ui/skill-badge';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';

interface IMemberSkillLevelModalProps {
    open: boolean;
    config: TSkillLevelConfig;
    onClose: () => void;
    onSave: (config: TSkillLevelConfig) => void;
}

function MemberSkillLevelModal({open, config, onClose, onSave}: IMemberSkillLevelModalProps) {
    const {t} = useTypedTranslation();
    const [localConfig, setLocalConfig] = useState(config);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const palette = useMemo(() => getSkillPalette(localConfig.paletteId), [localConfig.paletteId]);
    const levelItems = useMemo(
        () => Array.from({length: localConfig.levelCount}, (_, index) => localConfig.levelCount - index),
        [localConfig.levelCount],
    );

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/45 px-4">
            <div
                role="dialog"
                aria-modal="true"
                className="w-full max-w-[710px] rounded-[20px] bg-white px-[42px] py-10 shadow-[0px_24px_80px_rgba(83,92,125,0.18)]"
            >
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="font-apple text-[32px] font-semibold text-text-1">{t('page.member.skillLevelModal.title')}</h2>
                        <p className="mt-2 font-apple text-[20px] font-medium text-gray-3">
                            {t('page.member.skillLevelModal.description')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid size-9 place-items-center rounded-full text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1"
                        aria-label={t('page.member.skillLevelModal.close')}
                    >
                        <X aria-hidden="true" className="size-6" />
                    </button>
                </div>

                <div className="mt-10 flex flex-wrap items-center gap-4">
                    <div className="relative">
                        <select
                            value={localConfig.levelCount}
                            onChange={(event) => setLocalConfig((prev) => ({...prev, levelCount: Number(event.target.value)}))}
                            name="skillLevelCount"
                            aria-label={t('page.member.skillLevelModal.levelCountOption', {levelCount: localConfig.levelCount})}
                            className="h-9 appearance-none rounded-[5px] border border-gray-6 bg-gray-7 pr-9 pl-4 font-apple text-[20px] font-medium text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1"
                        >
                            {[2, 3, 4, 5].map((levelCount) => (
                                <option key={levelCount} value={levelCount}>
                                    {t('page.member.skillLevelModal.levelCountOption', {levelCount})}
                                </option>
                            ))}
                        </select>
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-4">⌄</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 items-center gap-1 rounded-[5px] border border-gray-6 bg-gray-7 px-3">
                            {skillPalettes.map((candidate) => (
                                <button
                                    key={candidate.id}
                                    type="button"
                                    aria-label={`${candidate.id} palette`}
                                    onClick={() => setLocalConfig((prev) => ({...prev, paletteId: candidate.id}))}
                                    className={cn(
                                        'grid size-4 place-items-center rounded-full transition-transform focus-visible:outline-2 focus-visible:outline-main-1',
                                        candidate.id === localConfig.paletteId && 'scale-105 ring-2 ring-white',
                                    )}
                                    style={{backgroundColor: candidate.colors[0]}}
                                >
                                    {candidate.id === localConfig.paletteId ? (
                                        <span className="text-[10px] leading-none text-white">✓</span>
                                    ) : null}
                                </button>
                            ))}
                        </div>
                        <span className="font-apple text-[20px] font-medium text-sub-1">{t('page.member.skillLevelModal.colorLabel')}</span>
                    </div>
                </div>

                <div className="mt-8 overflow-hidden rounded-[10px] border border-gray-5">
                    <div className="grid grid-cols-[72px_1fr]">
                        <div className="bg-gradient-to-b from-sub-2 to-gray-5 px-4 py-6 text-center">
                            <p className="font-apple text-[20px] font-semibold text-white">{t('page.member.skillLevelModal.high')}</p>
                            <div className="mt-[150px]">
                                <p className="font-apple text-[20px] font-semibold text-text-1">{t('page.member.skillLevelModal.low')}</p>
                            </div>
                        </div>
                        <div className="px-4 py-5">
                            <div className="grid grid-cols-[1fr_1fr_40px] items-center px-2 pb-3 font-apple text-[16px] text-gray-4">
                                <span>{t('page.member.skillLevelModal.levelLabel')}</span>
                                <span>{t('page.member.skillLevelModal.categoryLabel')}</span>
                                <span />
                            </div>
                            <div className="space-y-4 rounded-[8px] border border-gray-6 px-3 py-4">
                                {levelItems.map((level, index) => (
                                    <div
                                        key={level}
                                        className={cn(
                                            'grid grid-cols-[1fr_1fr_40px] items-center rounded-[5px] px-3 py-2',
                                            index === 0 && 'bg-gray-6/70',
                                        )}
                                    >
                                        <SkillBadge level={level} config={{...localConfig, paletteId: palette.id}} />
                                        <span className="font-apple text-[16px] text-gray-3">
                                            {t('page.member.skillLevelModal.levelDisplay', {level})}
                                        </span>
                                        {index === 0 ? <Pencil className="ml-auto size-4 text-gray-4" /> : <span />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex items-start gap-3">
                    <label className="mt-0.5 flex items-center gap-3 font-apple text-[16px] text-gray-3">
                        <input
                            type="checkbox"
                            name="autoAssign"
                            checked={localConfig.autoAssign}
                            onChange={(event) => setLocalConfig((prev) => ({...prev, autoAssign: event.target.checked}))}
                            className="size-5 rounded-[5px] border border-gray-5 accent-main-1"
                        />
                        <span>{t('page.member.skillLevelModal.autoAssign')}</span>
                    </label>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className="mt-0.5 text-gray-4"
                                    aria-label={t('page.member.skillLevelModal.autoAssignTooltipAria')}
                                >
                                    <Info className="size-[18px]" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[255px] bg-gray-6 text-[14px] leading-5 text-sub-1">
                                {t('page.member.skillLevelModal.autoAssignTooltip')}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <div className="mt-10 flex items-center justify-between">
                    <button
                        type="button"
                        className="font-apple text-[20px] font-medium text-gray-4 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-main-1"
                        onClick={() => {
                            onSave(localConfig);
                            onClose();
                        }}
                    >
                        {t('page.member.skillLevelModal.temporarySave')}
                    </button>
                    <button
                        type="button"
                        className="rounded-[10px] bg-main-1 px-5 py-2 font-apple text-[24px] font-semibold text-white transition-colors hover:bg-main-2 focus-visible:outline-2 focus-visible:outline-main-1"
                        onClick={() => {
                            onSave(localConfig);
                            onClose();
                        }}
                    >
                        {t('page.member.skillLevelModal.complete')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default MemberSkillLevelModal;
