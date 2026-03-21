import {Pencil, Plus, X} from 'lucide-react';
import {Input} from '@/shared/ui/primitives/input';
import type {TOnboardingWardShiftType} from '../../model';

const STEP_CARD_BASE_CLASS = 'rounded-[20px] border border-gray-6 bg-white p-8 shadow-[0_4px_34px_0_rgba(237,233,245,1)]';

interface IShiftTypeStepProps {
    shiftTypes: TOnboardingWardShiftType[];
    onChange: (shiftTypeId: string, updater: Partial<TOnboardingWardShiftType>) => void;
    onAdd: () => void;
    onDelete: (shiftTypeId: string) => void;
}

function ShiftTypeStep({shiftTypes, onChange, onAdd, onDelete}: IShiftTypeStepProps) {
    return (
        <div className={STEP_CARD_BASE_CLASS}>
            <div className="mb-6 flex items-center justify-between">
                <p className="font-apple text-[20px] font-medium text-gray-3">근무 유형</p>
                <button type="button" className="flex items-center gap-2 font-apple text-[16px] font-medium text-main-1" onClick={onAdd}>
                    <Plus className="h-5 w-5" />
                    근무 추가하기
                </button>
            </div>
            <div className="rounded-[12px] bg-gray-7">
                <div className="grid grid-cols-[2fr_88px_110px_220px_80px_50px] items-center gap-4 px-6 py-4 text-center font-apple text-[16px] text-gray-3">
                    <span>근무명</span>
                    <span>약자</span>
                    <span>유형</span>
                    <span>근무 시간</span>
                    <span>색상</span>
                    <span />
                </div>
                {shiftTypes.map((shiftType) => (
                    <div
                        key={shiftType.id}
                        className="grid grid-cols-[2fr_88px_110px_220px_80px_50px] items-center gap-4 border-t border-gray-6 bg-white px-6 py-4"
                    >
                        <Input
                            value={shiftType.name}
                            onChange={(event) => onChange(shiftType.id, {name: event.target.value})}
                            className="h-11 rounded-[10px] border-gray-5 font-apple text-[18px] text-sub-1"
                            placeholder="근무명"
                        />
                        <Input
                            value={shiftType.shortName}
                            maxLength={2}
                            onChange={(event) => onChange(shiftType.id, {shortName: event.target.value.toUpperCase()})}
                            className="h-11 rounded-[10px] border-gray-5 text-center font-poppins text-[18px] text-sub-1"
                            placeholder="-"
                        />
                        <select
                            value={shiftType.isOff ? 'OFF' : 'WORK'}
                            onChange={(event) =>
                                onChange(shiftType.id, {
                                    isOff: event.target.value === 'OFF',
                                    classification: event.target.value === 'OFF' ? 'OTHER_LEAVE' : 'OTHER_WORK',
                                    startTime: event.target.value === 'OFF' ? '' : shiftType.startTime || '09:00',
                                    endTime: event.target.value === 'OFF' ? '' : shiftType.endTime || '18:00',
                                })
                            }
                            className="h-11 rounded-[10px] border border-gray-5 bg-white px-3 font-apple text-[16px] text-sub-1 outline-none"
                        >
                            <option value="WORK">근무</option>
                            <option value="OFF">휴무</option>
                        </select>
                        <div className="flex items-center gap-2">
                            <Input
                                value={shiftType.startTime}
                                disabled={shiftType.isOff}
                                onChange={(event) => onChange(shiftType.id, {startTime: event.target.value})}
                                className="h-11 rounded-[10px] border-gray-5 text-center font-poppins text-[18px]"
                                placeholder="07:00"
                            />
                            <span className="font-poppins text-[18px] text-gray-3">~</span>
                            <Input
                                value={shiftType.endTime}
                                disabled={shiftType.isOff}
                                onChange={(event) => onChange(shiftType.id, {endTime: event.target.value})}
                                className="h-11 rounded-[10px] border-gray-5 text-center font-poppins text-[18px]"
                                placeholder="15:00"
                            />
                        </div>
                        <label className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] border border-gray-5 bg-white">
                            <input
                                className="sr-only"
                                type="color"
                                value={shiftType.color}
                                onChange={(event) => onChange(shiftType.id, {color: event.target.value})}
                            />
                            <span className="h-7 w-7 rounded-[8px]" style={{backgroundColor: shiftType.color}} />
                        </label>
                        <button
                            type="button"
                            aria-label={`${shiftType.name || '근무'} 삭제`}
                            onClick={() => onDelete(shiftType.id)}
                            className="flex h-11 w-11 items-center justify-center rounded-[10px] text-gray-4 hover:bg-gray-7 hover:text-sub-1"
                            disabled={shiftType.isDefault}
                        >
                            {shiftType.isDefault ? <Pencil className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ShiftTypeStep;
