import {Info, X} from 'lucide-react';
import {useEffect, useState} from 'react';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';
import {cn} from '@/shared/util/style';
import {getSkillPalette, skillPalettes, type TSkillLevelConfig} from '../../model';
import WizardButton from '../WizardButton';
import {SkillBadge} from './Badges';

interface ISkillLevelModalProps {
    open: boolean;
    config: TSkillLevelConfig;
    onClose: () => void;
    onSave: (config: TSkillLevelConfig) => void;
}

function SkillLevelModal({open, config, onClose, onSave}: ISkillLevelModalProps) {
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
                        <h2 className="font-apple text-[32px] font-semibold text-text-1">숙련도 단계 설정</h2>
                        <p className="mt-2 font-apple text-[20px] font-medium text-gray-3">기준은 자유롭게 정할 수 있어요</p>
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
                                {levelCount}단계
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
                        <span className="font-apple text-[20px] font-medium text-sub-2">색상</span>
                    </div>
                </div>

                <div className="mt-6 rounded-[10px] border border-gray-5">
                    <div className="grid grid-cols-[72px_1fr]">
                        <div className="from-gray-2 rounded-l-[10px] bg-gradient-to-b to-gray-5 px-4 py-6 text-center font-apple text-[20px] font-semibold text-white">
                            <div className="h-[176px]">
                                <p>높음</p>
                                <div className="flex h-full items-end justify-center">
                                    <p className="text-text-1">낮음</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-5 px-8 py-6">
                            <div className="grid grid-cols-[100px_1fr] text-center font-apple text-[16px] text-gray-3">
                                <span>숙련도</span>
                                <span>구분</span>
                            </div>
                            {levelItems.map((level) => (
                                <div key={level} className="grid grid-cols-[100px_1fr] items-center">
                                    <div className="flex justify-center">
                                        <SkillBadge level={level} config={{...localConfig, paletteId: palette.id}} />
                                    </div>
                                    <div className="rounded-[5px] bg-gray-6/70 px-4 py-1.5 font-apple text-[16px] text-gray-3">
                                        LV. {level}
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
                        자동 배정
                    </label>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" className="text-gray-4">
                                    <Info className="h-4 w-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[220px] bg-gray-6 text-sub-1">
                                등록된 간호사 목록을 단계별로 분배해서 자동으로 1차 배정합니다.
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <div className="mt-10 flex items-center justify-between">
                    <button type="button" className="font-apple text-[20px] text-gray-4 underline underline-offset-2" onClick={onClose}>
                        임시 저장
                    </button>
                    <WizardButton
                        onClick={() => {
                            onSave(localConfig);
                            onClose();
                        }}
                    >
                        완료
                    </WizardButton>
                </div>
            </div>
        </div>
    );
}

export default SkillLevelModal;
