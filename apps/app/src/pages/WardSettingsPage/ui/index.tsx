import {cn} from '@dutying/utils/style';
import {type KeyboardEvent, useMemo, useState} from 'react';
import {DUTY_RULE_KEYS, DUTY_RULE_META} from '@/features/shift-editor/model/duty-constraints';
import {type TDutyRuleMeta} from '@/features/shift-editor/model/duty-constraints';
import CreateShiftModal from '@/features/ward/CreateShiftModal';
import {type TCreateShiftTypeDTO} from '@/shared/api/ward/type';
import {PlusIcon2} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Select from '@/shared/ui/form-controls/Select';
import PageState from '@/shared/ui/PageState';
import Toggle from '@/shared/ui/Toggle';
import {formatShiftDuration} from '../model/utils';
import {
    type TWardSettingsActions,
    type TWardSettingsShiftType,
    type TWardSettingsState,
    type TWardSettingsTab,
} from '../model/wardSettingsHook';

type TWardSettingsPageViewProps = {
    state: TWardSettingsState;
    actions: TWardSettingsActions;
};

const TAB_ORDER: TWardSettingsTab[] = ['shiftTypes', 'constraints'];

function toShiftTypeDTO(shiftType: TWardSettingsShiftType, nextIsOff: boolean): TCreateShiftTypeDTO {
    return {
        name: shiftType.name,
        shortName: shiftType.shortName,
        startTime: shiftType.startTime,
        endTime: shiftType.endTime,
        color: shiftType.color,
        isDefault: shiftType.isDefault,
        isOff: nextIsOff,
        isCounted: shiftType.isCounted,
        classification: nextIsOff ? 'OTHER_LEAVE' : 'OTHER_WORK',
    };
}

function Tabs({currentTab, onSelect}: {currentTab: TWardSettingsTab; onSelect: (tab: TWardSettingsTab) => void}) {
    const {t} = useTypedTranslation();

    return (
        <div className="rounded-[15px] bg-main-light p-[10px]">
            <div className="flex items-center gap-4">
                {TAB_ORDER.map((tab) => {
                    const active = currentTab === tab;

                    return (
                        <button
                            key={tab}
                            type="button"
                            className={cn(
                                'rounded-[10px] px-4 py-[6px] font-apple text-[20px] font-semibold transition-colors',
                                active ? 'bg-main-1 text-white' : 'text-gray-4 hover:text-sub-1',
                            )}
                            onClick={() => onSelect(tab)}
                        >
                            {t(`page.wardSettings.tabs.${tab}`)}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function ShiftTypeKindSwitch({isOff, disabled, onChange}: {isOff: boolean; disabled: boolean; onChange: (nextIsOff: boolean) => void}) {
    const {t} = useTypedTranslation();

    return (
        <div className="flex h-[42px] w-[106px] rounded-[5px] border border-gray-6 bg-gray-7 p-1">
            <button
                type="button"
                className={cn(
                    'flex-1 rounded-[5px] font-apple text-[20px] font-medium transition-colors',
                    !isOff ? 'bg-main-1 text-white' : 'text-gray-4',
                    disabled ? 'cursor-default' : '',
                )}
                onClick={(event) => {
                    event.stopPropagation();

                    if (disabled) return;

                    onChange(false);
                }}
            >
                {t('page.wardSettings.type.work')}
            </button>
            <button
                type="button"
                className={cn(
                    'flex-1 rounded-[5px] font-apple text-[20px] font-medium transition-colors',
                    isOff ? 'bg-[#37404F] text-white' : 'text-gray-4',
                    disabled ? 'cursor-default' : '',
                )}
                onClick={(event) => {
                    event.stopPropagation();

                    if (disabled) return;

                    onChange(true);
                }}
            >
                {t('page.wardSettings.type.leave')}
            </button>
        </div>
    );
}

function ShiftTypeTable({
    shiftTypes,
    onOpenCreate,
    onOpenEdit,
    onToggleType,
    onRetry,
    status,
}: {
    shiftTypes: TWardSettingsShiftType[];
    status: TWardSettingsState['shiftTypesStatus'];
    onOpenCreate: () => void;
    onOpenEdit: (shiftType: TWardSettingsShiftType) => void;
    onToggleType: (shiftType: TWardSettingsShiftType, nextIsOff: boolean) => void;
    onRetry: () => void;
}) {
    const {t} = useTypedTranslation();

    if (status === 'pending') {
        return (
            <div className="rounded-[10px] bg-white">
                <PageState tone="loading" title={t('page.wardSettings.shiftTypes.loading')} className="py-0" />
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="rounded-[10px] bg-white">
                <PageState
                    tone="error"
                    title={t('page.wardSettings.shiftTypes.error')}
                    description={t('page.state.errorDescription')}
                    action={{label: t('page.state.retry'), onClick: () => void onRetry()}}
                    className="py-0"
                />
            </div>
        );
    }

    if (shiftTypes.length === 0) {
        return (
            <div className="rounded-[10px] bg-white">
                <PageState tone="empty" title={t('page.wardSettings.shiftTypes.empty')} className="py-0">
                    <div className="mt-1 flex justify-center">
                        <button
                            type="button"
                            className="flex items-center gap-1 font-apple text-base font-medium text-gray-3"
                            onClick={onOpenCreate}
                        >
                            <PlusIcon2 className="h-5 w-5" />
                            {t('page.wardSettings.addShiftType')}
                        </button>
                    </div>
                </PageState>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[980px] rounded-[10px] bg-white">
                <div className="grid grid-cols-[minmax(140px,1.15fr)_92px_140px_280px_80px] items-center gap-x-8 px-8 py-5 text-left font-apple text-base font-normal text-gray-4 md:px-[62px]">
                    <p>{t('page.wardSettings.shiftTypes.column.name')}</p>
                    <p>{t('page.wardSettings.shiftTypes.column.shortName')}</p>
                    <p>{t('page.wardSettings.shiftTypes.column.type')}</p>
                    <p>{t('page.wardSettings.shiftTypes.column.workTime')}</p>
                    <p>{t('page.wardSettings.shiftTypes.column.color')}</p>
                </div>

                {shiftTypes.map((shiftType) => (
                    <div
                        key={shiftType.wardShiftTypeId}
                        role="button"
                        tabIndex={0}
                        className="grid min-h-[74px] cursor-pointer grid-cols-[minmax(140px,1.15fr)_92px_140px_280px_80px] items-center gap-x-8 border-t border-gray-6 px-8 py-4 md:px-[62px]"
                        aria-label={t('page.wardSettings.shiftTypes.editAria', {name: shiftType.name})}
                        onClick={() => onOpenEdit(shiftType)}
                        onKeyDown={(event) => onRowKeyDown(event, () => onOpenEdit(shiftType))}
                    >
                        <p className="font-apple text-[20px] font-medium text-[#0A0F15]">{shiftType.name}</p>

                        <div className="flex">
                            <div className="flex size-[42px] items-center justify-center rounded-[5px] border border-gray-6 bg-gray-7 font-poppins text-[20px] font-medium text-[#0A0F15]">
                                {shiftType.shortName}
                            </div>
                        </div>

                        <ShiftTypeKindSwitch
                            isOff={shiftType.isOff}
                            disabled={shiftType.isDefault}
                            onChange={(nextIsOff) => onToggleType(shiftType, nextIsOff)}
                        />

                        {shiftType.isOff ? (
                            <p className="font-poppins text-[20px] font-medium text-[#0A0F15]">-</p>
                        ) : (
                            <div className="flex items-center gap-[10px]">
                                <div className="flex h-[42px] items-center justify-center rounded-[5px] border border-gray-6 bg-gray-7 px-4 font-poppins text-[20px] font-medium text-[#0A0F15]">
                                    {shiftType.startTime}
                                </div>
                                <p className="font-poppins text-[20px] font-medium text-[#0A0F15]">~</p>
                                <div className="flex h-[42px] items-center justify-center rounded-[5px] border border-gray-6 bg-gray-7 px-4 font-poppins text-[20px] font-medium text-[#0A0F15]">
                                    {shiftType.endTime}
                                </div>
                                <p className="font-apple text-base font-normal text-gray-4">
                                    {formatShiftDuration(shiftType.startTime, shiftType.endTime)}
                                </p>
                            </div>
                        )}

                        <div className="flex">
                            <div className="size-[42px] rounded-[5px]" style={{backgroundColor: shiftType.color}} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ConstraintsContent({
    state,
    actions,
}: {
    state: Pick<TWardSettingsState, 'shiftTeams' | 'shiftTeamsStatus' | 'currentShiftTeamId' | 'constraint' | 'constraintStatus'>;
    actions: Pick<TWardSettingsActions, 'selectShiftTeam' | 'updateConstraint' | 'retryShiftTeams' | 'retryConstraint'>;
}) {
    const {t} = useTypedTranslation();

    if (state.shiftTeamsStatus === 'pending') {
        return (
            <div className="rounded-[10px] bg-white">
                <PageState tone="loading" title={t('page.wardSettings.constraints.loading')} className="py-0" />
            </div>
        );
    }

    if (state.shiftTeamsStatus === 'error') {
        return (
            <div className="rounded-[10px] bg-white">
                <PageState
                    tone="error"
                    title={t('page.wardSettings.constraints.error')}
                    description={t('page.state.errorDescription')}
                    action={{label: t('page.state.retry'), onClick: () => void actions.retryShiftTeams()}}
                    className="py-0"
                />
            </div>
        );
    }

    if (state.shiftTeams.length === 0) {
        return (
            <div className="rounded-[10px] bg-white">
                <PageState
                    tone="empty"
                    title={t('page.wardSettings.constraints.noTeamsTitle')}
                    description={t('page.wardSettings.constraints.noTeamsDescription')}
                    className="py-0"
                />
            </div>
        );
    }

    const constraint = state.constraintStatus === 'success' ? state.constraint : null;

    return (
        <div className="rounded-[10px] bg-white">
            <div className="flex flex-col gap-4 border-b border-gray-6 px-8 py-6 md:flex-row md:items-center md:justify-between md:px-[42px]">
                <div>
                    <p className="font-apple text-base font-medium text-gray-4">{t('page.wardSettings.constraints.teamLabel')}</p>
                    <p className="mt-2 font-apple text-[20px] font-medium text-[#0A0F15]">
                        {t('page.wardSettings.constraints.teamDescription')}
                    </p>
                </div>

                <div className="max-w-full rounded-[10px] bg-main-light px-[10px] py-[7px]">
                    <div className="scrollbar-hide flex max-w-full gap-1 overflow-x-auto whitespace-nowrap">
                        {state.shiftTeams.map((team) => {
                            const active = team.shiftTeamId === state.currentShiftTeamId;

                            return (
                                <button
                                    key={team.shiftTeamId}
                                    type="button"
                                    className={cn(
                                        'rounded-[10px] px-4 py-[6px] font-apple text-base font-medium transition-colors',
                                        active ? 'bg-main-1 text-white' : 'text-gray-3 hover:bg-white/70',
                                    )}
                                    onClick={() => actions.selectShiftTeam(team.shiftTeamId)}
                                >
                                    {team.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {state.constraintStatus === 'pending' || state.constraintStatus === 'idle' ? (
                <PageState tone="loading" title={t('page.wardSettings.constraints.loading')} className="py-0" />
            ) : null}

            {state.constraintStatus === 'error' ? (
                <PageState
                    tone="error"
                    title={t('page.wardSettings.constraints.error')}
                    description={t('page.state.errorDescription')}
                    action={{label: t('page.state.retry'), onClick: () => void actions.retryConstraint()}}
                    className="py-0"
                />
            ) : null}

            {constraint ? (
                <>
                    <div className="grid grid-cols-[minmax(260px,1fr)_160px_150px] items-center gap-x-6 px-8 py-5 text-left font-apple text-base text-gray-4 md:px-[42px]">
                        <p>{t('page.wardSettings.constraints.column.rule')}</p>
                        <p>{t('page.wardSettings.constraints.column.value')}</p>
                        <p>{t('page.wardSettings.constraints.column.status')}</p>
                    </div>

                    {DUTY_RULE_KEYS.map((key) => {
                        const meta = DUTY_RULE_META[key];
                        const isActive = Boolean(constraint[meta.booleanField]);
                        const value = meta.valueField ? (constraint[meta.valueField] as number) : null;

                        return (
                            <div
                                key={key}
                                className="grid min-h-[74px] grid-cols-[minmax(260px,1fr)_160px_150px] items-center gap-x-6 border-t border-gray-6 px-8 py-4 md:px-[42px]"
                            >
                                <p className="font-apple text-[20px] font-medium text-[#0A0F15]">{t(meta.labelKey)}</p>
                                <div className="flex">
                                    <ConstraintValueEditor
                                        meta={meta}
                                        value={value}
                                        onChange={(nextValue) => {
                                            if (!meta.valueField) return;

                                            void actions.updateConstraint({
                                                ...constraint,
                                                [meta.valueField]: nextValue,
                                            });
                                        }}
                                    />
                                </div>

                                <div className="flex items-center gap-3">
                                    <Toggle
                                        isOn={isActive}
                                        setIsOn={() => {
                                            void actions.updateConstraint({
                                                ...constraint,
                                                [meta.booleanField]: !isActive,
                                            });
                                        }}
                                    />
                                    <p className="font-apple text-xs font-medium text-gray-3">
                                        {isActive ? t('page.wardSettings.constraints.apply') : t('page.wardSettings.constraints.exclude')}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </>
            ) : null}
        </div>
    );
}

function ConstraintValueEditor({
    meta,
    value,
    onChange,
}: {
    meta: TDutyRuleMeta;
    value: number | null;
    onChange: (nextValue: number) => void;
}) {
    const {t} = useTypedTranslation();

    if (!meta.valueField || !meta.valueOptions) {
        return <p className="font-poppins text-[20px] font-medium text-[#0A0F15]">-</p>;
    }

    return (
        <div className="flex items-center gap-3">
            {meta.kind === 'maxDays' ? (
                <p className="font-apple text-[20px] font-medium text-[#0A0F15]">{t('page.makeShift.constraints.phrase.max')}</p>
            ) : null}
            {meta.kind === 'minDays' ? (
                <p className="font-apple text-[20px] font-medium text-[#0A0F15]">{t('page.makeShift.constraints.phrase.min')}</p>
            ) : null}
            <Select
                value={value ?? ''}
                options={meta.valueOptions.map((option) => ({value: option, label: option}))}
                className="h-[42px] w-[88px]"
                selectClassName="rounded-[5px] border border-gray-6 bg-gray-7 px-4 font-poppins text-[20px] font-medium text-[#0A0F15] outline-none"
                onChange={(event) => onChange(parseInt(event.target.value, 10))}
            />
            {meta.kind !== 'noValue' ? (
                <p className="font-apple text-[20px] font-medium text-[#0A0F15]">{t('page.makeShift.constraints.phrase.day')}</p>
            ) : null}
        </div>
    );
}

function onRowKeyDown(event: KeyboardEvent<HTMLDivElement>, onActivate: () => void) {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    if (event.target !== event.currentTarget) return;

    event.preventDefault();
    onActivate();
}

export function WardSettingsPageView({state, actions}: TWardSettingsPageViewProps) {
    const {t} = useTypedTranslation();
    const [openModal, setOpenModal] = useState(false);
    const [editingShiftType, setEditingShiftType] = useState<TWardSettingsShiftType | null>(null);
    const showAddAction = state.currentTab === 'shiftTypes';
    const modalShiftType = useMemo(() => editingShiftType, [editingShiftType]);
    const openCreateModal = () => {
        setEditingShiftType(null);
        setOpenModal(true);
    };
    const openEditModal = (shiftType: TWardSettingsShiftType) => {
        setEditingShiftType(shiftType);
        setOpenModal(true);
    };

    return (
        <div className="flex min-h-screen w-full flex-col px-5 py-5 md:px-10 md:py-10">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                <h1 className="font-apple text-[32px] font-semibold text-[#0A0F15]">{t('page.wardSettings.title')}</h1>

                <div className="flex flex-wrap items-center gap-4">
                    <Tabs currentTab={state.currentTab} onSelect={actions.selectTab} />

                    {showAddAction ? (
                        <button
                            type="button"
                            className="flex items-center gap-1 font-apple text-base font-medium text-gray-3"
                            onClick={openCreateModal}
                        >
                            <PlusIcon2 className="h-5 w-5" />
                            {t('page.wardSettings.addShiftType')}
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="mt-10">
                {state.currentTab === 'shiftTypes' ? (
                    <ShiftTypeTable
                        shiftTypes={state.shiftTypes}
                        status={state.shiftTypesStatus}
                        onOpenCreate={openCreateModal}
                        onOpenEdit={openEditModal}
                        onToggleType={(shiftType, nextIsOff) => {
                            if (shiftType.isOff === nextIsOff) return;

                            void actions.updateShiftType(shiftType.wardShiftTypeId, toShiftTypeDTO(shiftType, nextIsOff));
                        }}
                        onRetry={actions.retryShiftTypes}
                    />
                ) : (
                    <ConstraintsContent
                        state={{
                            shiftTeams: state.shiftTeams,
                            shiftTeamsStatus: state.shiftTeamsStatus,
                            currentShiftTeamId: state.currentShiftTeamId,
                            constraint: state.constraint,
                            constraintStatus: state.constraintStatus,
                        }}
                        actions={{
                            selectShiftTeam: actions.selectShiftTeam,
                            updateConstraint: actions.updateConstraint,
                            retryShiftTeams: actions.retryShiftTeams,
                            retryConstraint: actions.retryConstraint,
                        }}
                    />
                )}
            </div>

            <CreateShiftModal
                open={openModal}
                close={() => {
                    setEditingShiftType(null);
                    setOpenModal(false);
                }}
                shiftType={modalShiftType}
                onSubmit={(shiftType: TCreateShiftTypeDTO) => {
                    if (editingShiftType) {
                        void actions.updateShiftType(editingShiftType.wardShiftTypeId, shiftType);

                        return;
                    }

                    void actions.addShiftType(shiftType);
                }}
                onDelete={() => {
                    if (!editingShiftType) return;

                    void actions.deleteShiftType(editingShiftType.wardShiftTypeId);
                }}
            />
        </div>
    );
}
