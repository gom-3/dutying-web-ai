import {produce} from 'immer';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {events, sendEvent} from '@/analytics';
import {type TNurse, type TWardShiftType} from '@/entities';
import {type TSkillLevelConfig} from '@/features/ward/skill-level';
import SkillBadge from '@/features/ward/SkillBadge';
import useEditShiftTeam from '@/features/ward/useEditShiftTeam';
import {LinkedIcon, UnlinkedIcon, XIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Button from '@/shared/ui/form-controls/Button';
import TextField from '@/shared/ui/form-controls/TextField';
import {Switch} from '@/shared/ui/primitives/switch';
import {getNurseDrawerFeedback, hasNurseChanges} from '../model/nurseEdit';

interface INurseDetailPanelProps {
    skillConfig: TSkillLevelConfig;
    skillLevel: number | null | undefined;
    wardShiftTypes: TWardShiftType[] | undefined;
}

function NurseDetailPanel({skillConfig, skillLevel, wardShiftTypes}: INurseDetailPanelProps) {
    const {
        state: {shiftTeams, selectedNurse, selectedNurseDrawerMode, nurseSaveStatus, isDeletingNurse},
        actions: {selectNurse, updateNurse, deleteNurse, setNurseDraftDirty},
    } = useEditShiftTeam();
    const {t} = useTypedTranslation();
    const [writeNurse, setWriteNurse] = useState<TNurse | null>(null);
    const textInputRef = useRef<HTMLInputElement>(null);
    const isDirty = hasNurseChanges(selectedNurse, writeNurse);
    const isBusy = nurseSaveStatus === 'saving' || isDeletingNurse;
    const feedback = getNurseDrawerFeedback({
        mode: selectedNurseDrawerMode,
        saveStatus: nurseSaveStatus,
        isDirty,
    });
    const shiftTypeColorById = useMemo(() => {
        return new Map(
            (wardShiftTypes ?? []).map((shiftType) => [
                shiftType.name,
                {
                    borderColor: shiftType.color,
                    color: shiftType.color,
                },
            ]),
        );
    }, [wardShiftTypes]);
    const handleChange = useCallback(
        <K extends keyof TNurse>(key: K, value: TNurse[K]) => {
            if (!writeNurse) return;

            setWriteNurse((prev) => (prev ? {...prev, [key]: value} : prev));
        },
        [writeNurse],
    );
    const save = useCallback(() => {
        if (writeNurse && !isBusy && isDirty) {
            updateNurse(writeNurse.nurseId, writeNurse);
        }
    }, [isBusy, isDirty, updateNurse, writeNurse]);

    useEffect(() => {
        setWriteNurse(selectedNurse ?? null);

        if (selectedNurse) {
            textInputRef.current?.focus();
        }
    }, [selectedNurse]);

    useEffect(() => {
        setNurseDraftDirty(isDirty);
    }, [isDirty, setNurseDraftDirty]);

    if (!selectedNurse || !writeNurse) {
        return (
            <aside className="min-h-[748px] w-[420px] rounded-[15px] bg-white p-8 shadow-[0px_7px_29px_rgba(138,132,160,0.2)]">
                <div className="flex h-full min-h-[684px] flex-col items-center justify-center rounded-[15px] border border-dashed border-gray-6 bg-gray-7 px-8 text-center">
                    <p className="font-apple text-[28px] font-semibold text-sub-1">{t('page.member.detail.emptyTitle')}</p>
                    <p className="mt-3 font-apple text-[16px] leading-7 font-medium text-gray-3">
                        {t('page.member.detail.emptyDescription')}
                    </p>
                </div>
            </aside>
        );
    }

    return (
        <aside className="w-[420px] overflow-hidden rounded-[15px] bg-white shadow-[0px_7px_29px_rgba(138,132,160,0.25)]">
            <div className="flex items-center justify-between border-b border-gray-6 px-[30px] py-6">
                <div className="flex items-center gap-4">
                    <TextField
                        ref={textInputRef}
                        autoFocus
                        disabled={isBusy}
                        name="nurseName"
                        autoComplete="name"
                        aria-label={t('page.member.table.name')}
                        className="h-auto rounded-none px-0 text-[22px] font-bold text-text-1 outline-none"
                        value={writeNurse.name}
                        onChange={(event) => {
                            handleChange('name', event.target.value);
                            sendEvent(events.memberPage.editNurseDrawer.changeNurseName);
                        }}
                    />
                    <button
                        type="button"
                        className="rounded-[5px] bg-sub-5 px-2 py-1 font-apple text-[12px] font-medium text-[#A2A6F5] focus-visible:outline-2 focus-visible:outline-main-1"
                        aria-label={t('page.member.detail.genderToggle')}
                        onClick={() => {
                            if (isBusy) return;

                            handleChange('gender', writeNurse.gender === '남' ? '여' : '남');
                            sendEvent(events.memberPage.editNurseDrawer.changeNurseGender);
                        }}
                    >
                        {writeNurse.gender}
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <SkillBadge level={skillLevel} config={skillConfig} />
                    <button
                        type="button"
                        className="grid size-8 place-items-center rounded-full text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1"
                        onClick={() => selectNurse(null)}
                        aria-label={t('page.member.detail.close')}
                    >
                        <XIcon aria-hidden="true" className="size-5" />
                    </button>
                </div>
            </div>

            <div className={`mx-[30px] mt-5 rounded-[10px] border px-4 py-3 ${feedback.toneClassName}`} aria-live="polite">
                <p className="font-apple text-[15px] font-semibold">{feedback.title}</p>
                <p className="mt-1 font-apple text-[13px] leading-5">{feedback.description}</p>
            </div>

            <div className="mt-5 border-y border-gray-6 px-[30px] py-6">
                <div className="flex items-center justify-between">
                    <p className="font-apple text-[16px] text-sub-2">{t('page.member.detail.shiftTypes')}</p>
                    <p className="font-apple text-[12px] text-gray-4">{t('page.member.detail.shiftTypesHint')}</p>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                    {writeNurse.nurseShiftTypes.map(({nurseShiftTypeId, isPossible, name}) => {
                        const colorStyle = shiftTypeColorById.get(name) ?? {borderColor: '#BFC7D4', color: '#657084'};

                        return (
                            <button
                                key={nurseShiftTypeId}
                                type="button"
                                disabled={isBusy}
                                className="min-w-[72px] rounded-[5px] border px-4 py-1.5 font-apple text-[20px] font-medium transition-opacity focus-visible:outline-2 focus-visible:outline-main-1 disabled:cursor-not-allowed disabled:opacity-50"
                                style={
                                    isPossible
                                        ? colorStyle
                                        : {
                                              borderColor: '#E0E5EB',
                                              color: '#BFC7D4',
                                          }
                                }
                                onClick={() => {
                                    handleChange(
                                        'nurseShiftTypes',
                                        produce(writeNurse.nurseShiftTypes, (draft) => {
                                            const target = draft.find((shiftType) => shiftType.nurseShiftTypeId === nurseShiftTypeId);

                                            if (target) {
                                                target.isPossible = !isPossible;
                                            }
                                        }),
                                    );
                                    sendEvent(events.memberPage.editNurseDrawer.changeNurseShiftTypes);
                                }}
                            >
                                {name}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="border-b border-gray-6 px-[30px] py-6">
                <div className="flex items-center justify-between">
                    <p className="font-apple text-[16px] text-sub-2">{t('page.member.detail.memo')}</p>
                    <p className="font-apple text-[12px] text-gray-4">{t('page.member.detail.memoHint')}</p>
                </div>
                <textarea
                    name="nurseMemo"
                    aria-label={t('page.member.detail.memo')}
                    value={writeNurse.memo}
                    disabled={isBusy}
                    className="mt-5 h-[125px] w-full resize-none rounded-[5px] border border-gray-6 bg-[#FDFCFE] p-4 font-apple text-[16px] text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1"
                    onChange={(event) => {
                        handleChange('memo', event.target.value);
                        sendEvent(events.memberPage.editNurseDrawer.changeNurseMemo);
                    }}
                />
            </div>

            <div className="border-b border-gray-6 px-[30px] py-6">
                <div className="flex items-center justify-between">
                    <p className="font-apple text-[16px] text-sub-2">{t('page.member.detail.employmentDate')}</p>
                    <p className="font-apple text-[12px] text-gray-4">{t('page.member.detail.employmentDateHint')}</p>
                </div>
                <TextField
                    type="date"
                    disabled={isBusy}
                    name="employmentDate"
                    autoComplete="off"
                    aria-label={t('page.member.detail.employmentDate')}
                    className="mt-4 h-10 rounded-[5px] border border-gray-6 px-4 font-poppins text-[20px] text-sub-1 outline-none"
                    value={writeNurse.employmentDate}
                    onChange={(event) => {
                        handleChange('employmentDate', event.target.value);
                        sendEvent(events.memberPage.editNurseDrawer.changeNurseEmploymentDate);
                    }}
                />
            </div>

            <div className="border-b border-gray-6 px-[30px] py-6">
                <div className="flex items-center justify-between">
                    <p className="font-apple text-[16px] text-sub-2">{t('page.member.detail.phone')}</p>
                    <p className="font-apple text-[12px] text-gray-4">{t('page.member.detail.phoneHint')}</p>
                </div>
                <TextField
                    type="tel"
                    disabled={isBusy}
                    name="phoneNum"
                    autoComplete="tel-national"
                    aria-label={t('page.member.detail.phone')}
                    className="mt-4 h-10 rounded-[5px] border border-gray-6 px-4 font-poppins text-[20px] text-sub-1 outline-none"
                    value={writeNurse.phoneNum}
                    onChange={(event) => {
                        handleChange('phoneNum', event.target.value);
                        sendEvent(events.memberPage.editNurseDrawer.changeNursePhone);
                    }}
                />
            </div>

            <div className="space-y-0 border-b border-gray-6 px-[30px] py-6">
                <div className="flex items-center justify-between py-4">
                    <p className="font-apple text-[16px] text-sub-2">{t('page.member.detail.isWorker')}</p>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={writeNurse.isWorker}
                            disabled={isBusy}
                            className="h-4 w-8 data-[state=checked]:bg-main-1 data-[state=unchecked]:bg-gray-6"
                            aria-label={t('page.member.detail.isWorker')}
                            onCheckedChange={(checked) => {
                                handleChange('isWorker', checked);
                                sendEvent(events.memberPage.editNurseDrawer.changeNurseIsWorker);
                            }}
                        />
                        <span className="font-apple text-[12px] font-medium text-main-1">
                            {writeNurse.isWorker ? t('page.member.detail.isWorkerOn') : t('page.member.detail.isWorkerOff')}
                        </span>
                    </div>
                </div>
                <div className="flex items-center justify-between border-t border-gray-6 py-4">
                    <p className="font-apple text-[16px] text-sub-2">{t('page.member.detail.connection')}</p>
                    <div className="flex items-center gap-2">
                        {writeNurse.isConnected ? (
                            <LinkedIcon aria-hidden="true" className="size-6" />
                        ) : (
                            <UnlinkedIcon aria-hidden="true" className="size-6" />
                        )}
                        <span className="font-apple text-[12px] font-medium text-gray-4">
                            {writeNurse.isConnected ? t('page.member.detail.connected') : t('page.member.detail.disconnected')}
                        </span>
                    </div>
                </div>
                <div className="flex items-center justify-between border-t border-gray-6 py-4">
                    <p className="font-apple text-[16px] text-sub-2">{t('page.member.detail.isDutyManager')}</p>
                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            checked={writeNurse.isDutyManager}
                            disabled={isBusy}
                            aria-label={t('page.member.detail.isDutyManager')}
                            className="size-4 rounded-[3px] accent-main-1"
                            onChange={(event) => {
                                handleChange('isDutyManager', event.target.checked);
                                sendEvent(events.memberPage.editNurseDrawer.changeNurseIsManager);
                            }}
                        />
                        <span className="font-apple text-[12px] font-medium text-main-1">
                            {writeNurse.isDutyManager ? t('page.member.detail.canMakeDuty') : t('page.member.detail.cannotMakeDuty')}
                        </span>
                    </label>
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-[30px] py-5">
                <button
                    type="button"
                    className="font-apple text-[16px] font-medium text-gray-4 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-main-1 disabled:opacity-50"
                    disabled={isBusy}
                    onClick={() => {
                        if (!selectedNurse || !shiftTeams) return;

                        const targetTeam = shiftTeams.find((shiftTeam) =>
                            shiftTeam.nurses.some((nurse) => nurse.nurseId === selectedNurse.nurseId),
                        );

                        if (!targetTeam) return;

                        const shouldDelete = window.confirm(`${selectedNurse.name} 간호사를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`);

                        if (!shouldDelete) return;

                        deleteNurse(targetTeam.shiftTeamId, selectedNurse.nurseId);
                    }}
                >
                    {isDeletingNurse ? t('page.member.detail.deleting') : t('page.member.detail.delete')}
                </button>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="md"
                        className="h-10 rounded-[10px] px-4 font-apple text-[16px]"
                        onClick={() => selectNurse(null)}
                    >
                        {isDirty ? t('page.member.detail.cancel') : t('page.member.detail.closeAction')}
                    </Button>
                    <Button
                        size="md"
                        className="h-10 rounded-[10px] px-4 font-apple text-[16px] text-white"
                        disabled={!isDirty || isBusy}
                        onClick={save}
                    >
                        {nurseSaveStatus === 'saving' ? t('page.member.detail.saving') : t('page.member.detail.save')}
                    </Button>
                </div>
            </div>
        </aside>
    );
}

export default NurseDetailPanel;
