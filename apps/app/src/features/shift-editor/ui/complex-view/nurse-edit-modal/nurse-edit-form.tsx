import {produce} from 'immer';
import {type ReactNode, type RefObject} from 'react';
import {events, sendEvent} from '@/analytics';
import {type TNurse} from '@/entities/nurse';
import {CancelIcon, CheckedIcon, UncheckedIcon2} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Button from '@/shared/ui/form-controls/Button';
import TextField from '@/shared/ui/form-controls/TextField';
import {isNurseEditSaveDisabled} from './is-nurse-edit-save-disabled';

const GENDER_MALE = '\uB0A8';
const GENDER_FEMALE = '\uC5EC';

type TNurseEditFormProps = {
    selectedNurse: TNurse | null;
    writeNurse: TNurse | null;
    nameRef: RefObject<HTMLInputElement | null>;
    onClose: () => void;
    onChange: <K extends keyof TNurse>(key: K, value: TNurse[K]) => void;
    onSubmit: () => void;
};

type TNurseEditFieldSectionProps = {
    title: string;
    description: string;
    children: ReactNode;
};

function NurseEditFieldSection({title, description, children}: TNurseEditFieldSectionProps) {
    return (
        <div className="flex h-29 w-full flex-col items-stretch justify-between border-b-[.0313rem] border-sub-4 px-10 pt-[.625rem] pb-7.5">
            <div className="flex items-center justify-between">
                <p className="shrink-0 font-apple text-base font-medium text-sub-2">{title}</p>
                <p className="ml-8 truncate font-apple text-[.625rem] font-light text-sub-3">{description}</p>
            </div>
            {children}
        </div>
    );
}

type TNurseEditToggleRowProps = {
    title: string;
    checked: boolean | undefined;
    onToggle: () => void;
    borderClassName: string;
};

function NurseEditToggleRow({title, checked, onToggle, borderClassName}: TNurseEditToggleRowProps) {
    const {t} = useTypedTranslation();

    return (
        <div className={`flex h-10 w-full items-center ${borderClassName} bg-main-bg px-10 py-[.625rem]`}>
            <p className="font-apple text-base font-medium text-sub-2">{title}</p>
            {checked ? (
                <div className="ml-auto flex items-center gap-[.625rem]">
                    <p className="max-w-28 truncate font-apple text-[.75rem] text-sub-3">{t('feature.shiftEditor.nurseEdit.enabled')}</p>
                    <CheckedIcon className="h-5 w-5 cursor-pointer" fill="#B08BFF" onClick={onToggle} />
                </div>
            ) : (
                <div className="ml-auto flex items-center gap-[.625rem]">
                    <p className="max-w-28 truncate font-apple text-[.75rem] text-sub-3">{t('feature.shiftEditor.nurseEdit.disabled')}</p>
                    <UncheckedIcon2 className="h-5 w-5 cursor-pointer" onClick={onToggle} />
                </div>
            )}
        </div>
    );
}

export function NurseEditForm({selectedNurse, writeNurse, nameRef, onClose, onChange, onSubmit}: TNurseEditFormProps) {
    const {t} = useTypedTranslation();

    return (
        <div className="flex h-fit w-full flex-col">
            <div className="flex h-11 items-center bg-sub-5 px-10">
                <p className="font-apple text-base text-sub-3">{t('feature.shiftEditor.nurseEdit.title')}</p>
                <div className="ml-auto flex cursor-pointer items-center" onClick={onClose}>
                    <p className="font-apple text-base text-sub-3">{t('feature.shiftEditor.nurseEdit.close')}</p>
                    <CancelIcon className="h-6 w-6" />
                </div>
            </div>
            <div className="my-5 flex h-10.5 w-full items-center px-10">
                <div className="h-10.5 w-10.5 rounded-full bg-gray-400" />
                <TextField
                    ref={nameRef}
                    autoFocus
                    className="ml-5 h-10.5 w-40.5 px-3 text-[1.875rem] font-semibold text-text-1"
                    onChange={(e) => {
                        onChange('name', e.target.value);
                        sendEvent(events.makePage.editNurseModal.changeNurseName);
                    }}
                    value={writeNurse?.name ?? ''}
                />
                <div
                    className="ml-auto flex h-5 w-7 cursor-pointer items-center justify-center rounded-[.3125rem] bg-sub-5 font-apple text-[.875rem] text-[#A2A6F5]"
                    onClick={() => {
                        onChange('gender', writeNurse?.gender === GENDER_MALE ? GENDER_FEMALE : GENDER_MALE);
                        sendEvent(events.makePage.editNurseModal.changeNurseGender);
                    }}
                >
                    {writeNurse?.gender === GENDER_MALE
                        ? t('feature.shiftEditor.nurseEdit.gender.male')
                        : writeNurse?.gender === GENDER_FEMALE
                          ? t('feature.shiftEditor.nurseEdit.gender.female')
                          : writeNurse?.gender}
                </div>
            </div>
            <div className="h-[.3125rem] w-full bg-sub-5" />
            <NurseEditFieldSection
                title={t('feature.shiftEditor.nurseEdit.employmentDate')}
                description={t('feature.shiftEditor.nurseEdit.employmentDateDescription')}
            >
                <TextField
                    type="date"
                    className="h-10 font-poppins text-[1.25rem] text-sub-3"
                    placeholder="YYYY-MM-DD"
                    onChange={(e) => {
                        onChange('employmentDate', e.target.value);
                        sendEvent(events.makePage.editNurseModal.changeNurseEmploymentDate);
                    }}
                    value={writeNurse?.employmentDate ?? ''}
                />
            </NurseEditFieldSection>
            <NurseEditFieldSection
                title={t('feature.shiftEditor.nurseEdit.phoneNumber')}
                description={t('feature.shiftEditor.nurseEdit.phoneNumberDescription')}
            >
                <TextField
                    type="tel"
                    className="h-10 font-poppins text-[1.25rem] text-sub-3"
                    onChange={(e) => {
                        onChange('phoneNum', e.target.value);
                        sendEvent(events.makePage.editNurseModal.changeNursePhone);
                    }}
                    value={writeNurse?.phoneNum ?? ''}
                />
            </NurseEditFieldSection>
            <NurseEditFieldSection
                title={t('feature.shiftEditor.nurseEdit.availableShifts')}
                description={t('feature.shiftEditor.nurseEdit.availableShiftsDescription')}
            >
                <div className="flex gap-5.5">
                    {writeNurse?.nurseShiftTypes.slice(0, 3).map(({nurseShiftTypeId, isPossible, name}) => (
                        <div
                            key={nurseShiftTypeId}
                            className={`flex h-10 flex-1 cursor-pointer items-center justify-center rounded-[.3125rem] border-[.0625rem] font-apple text-[1.25rem] ${isPossible ? 'border-main-1 text-main-1' : 'border-sub-4 text-sub-3'} `}
                            onClick={() => {
                                onChange(
                                    'nurseShiftTypes',
                                    produce(writeNurse.nurseShiftTypes, (draft: TNurse['nurseShiftTypes']) => {
                                        draft.find((x) => x.nurseShiftTypeId === nurseShiftTypeId)!.isPossible = !isPossible;
                                    }),
                                );
                                sendEvent(events.makePage.editNurseModal.changeNurseShiftTypes);
                            }}
                        >
                            {name}
                        </div>
                    ))}
                </div>
            </NurseEditFieldSection>
            <NurseEditToggleRow
                title={t('feature.shiftEditor.nurseEdit.worker')}
                checked={writeNurse?.isWorker}
                borderClassName="border-b-[.0313rem] border-sub-4"
                onToggle={() => {
                    onChange('isWorker', !writeNurse?.isWorker);
                    sendEvent(events.makePage.editNurseModal.changeNurseIsWorker);
                }}
            />
            <NurseEditToggleRow
                title={t('feature.shiftEditor.nurseEdit.dutyManager')}
                checked={writeNurse?.isDutyManager}
                borderClassName="mt-[.3125rem] border-y-[.0313rem] border-sub-4"
                onToggle={() => {
                    onChange('isDutyManager', !writeNurse?.isDutyManager);
                    sendEvent(events.makePage.editNurseModal.changeNurseIsManager);
                }}
            />

            <p className="mt-7.5 ml-10 font-apple text-base font-medium text-sub-2.5">{t('feature.shiftEditor.nurseEdit.memo')}</p>
            <textarea
                value={writeNurse?.memo ?? ''}
                className="mx-10 mt-[.9375rem] h-43.25 resize-none rounded-[.3125rem] border-[.0313rem] border-sub-4.5 bg-main-bg p-2 font-apple text-sm text-sub-1"
                onChange={(e) => {
                    onChange('memo', e.target.value);
                    sendEvent(events.makePage.editNurseModal.changeNurseMemo);
                }}
            />
            <Button
                id="nurse_edit_drawer"
                className="mt-6.25 mr-10 mb-6.5 ml-auto flex h-9 items-center justify-center rounded-[3.125rem] bg-main-1 px-5 py-[.5rem] font-apple text-base font-medium text-white"
                disabled={isNurseEditSaveDisabled(selectedNurse, writeNurse)}
                onClick={onSubmit}
            >
                {t('feature.shiftEditor.nurseEdit.save')}
            </Button>
        </div>
    );
}
