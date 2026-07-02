import {type TCreateShiftTypeDTO, type TCreateWardDTO} from '@dutying/api/ward';
import {produce} from 'immer';
import {Pencil, Plus} from 'lucide-react';
import {type Dispatch, type SetStateAction, useState} from 'react';
import {type TWardShiftType} from '@/entities/ward';
import CreateShiftModal from '@/features/create-shift-modal';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

interface IRegisterWardShiftTypesSectionProps {
    wardShiftTypes: TCreateWardDTO['wardShiftTypes'];
    setWardShiftTypes: Dispatch<SetStateAction<TCreateWardDTO['wardShiftTypes']>>;
}

function RegisterWardShiftTypesSection({wardShiftTypes, setWardShiftTypes}: IRegisterWardShiftTypesSectionProps) {
    const {t} = useTypedTranslation();
    const [openModal, setOpenModal] = useState(false);
    const [tempShiftType, setTempShiftType] = useState<TWardShiftType | null>(null);

    return (
        <section className="mt-4 rounded-[24px] bg-white p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-[20px] font-semibold text-sub-1">{t('feature.registerWard.shiftTypes.title')}</h2>
                    <p className="mt-1 text-xs leading-5 text-gray-3">{t('feature.registerWard.shiftTypes.description')}</p>
                </div>
                <button
                    type="button"
                    className="h-9 shrink-0 cursor-pointer gap-1.5 rounded-[12px] bg-gray-7 px-3 text-sm font-semibold text-gray-3 transition-colors hover:bg-gray-6"
                    onClick={() => {
                        setOpenModal(true);
                    }}
                >
                    <Plus className="h-4 w-4" />
                    {t('feature.registerWard.shiftTypes.add')}
                </button>
            </div>

            <div className="mt-4 space-y-2">
                {wardShiftTypes.map((shiftType, index) => (
                    <article key={`${shiftType.shortName}-${index}`} className="rounded-[16px] bg-gray-7 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="truncate font-apple text-[17px] font-semibold text-sub-1">{shiftType.name}</h3>
                                    <span className="rounded-[8px] bg-white px-2 py-0.5 font-poppins text-xs font-semibold text-gray-3">
                                        {shiftType.shortName}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-gray-3">
                                    {shiftType.isOff
                                        ? t('feature.registerWard.shiftTypes.noTimeLeave')
                                        : `${shiftType.startTime} - ${shiftType.endTime}`}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="h-9 w-9 shrink-0 cursor-pointer rounded-full bg-white text-gray-3 transition-colors hover:bg-main-light hover:text-main-1"
                                onClick={() => {
                                    setTempShiftType({...shiftType, wardShiftTypeId: index, isCounted: true});
                                    setOpenModal(true);
                                }}
                                aria-label={t('feature.registerWard.shiftTypes.editAria', {name: shiftType.name})}
                                title={t('feature.registerWard.shiftTypes.editAria', {name: shiftType.name})}
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-[12px] bg-white px-3 py-2">
                                <p className="text-xs text-gray-4">{t('feature.registerWard.shiftTypes.typeLabel')}</p>
                                <p className="mt-1 text-sm font-semibold text-sub-2">
                                    {shiftType.isOff
                                        ? t('feature.registerWard.shiftTypes.leave')
                                        : t('feature.registerWard.shiftTypes.work')}
                                </p>
                            </div>
                            <div className="rounded-[12px] bg-white px-3 py-2">
                                <p className="text-xs text-gray-4">{t('feature.registerWard.shiftTypes.colorLabel')}</p>
                                <div className="mt-1 h-5 w-8 rounded-[8px]" style={{backgroundColor: shiftType.color}} />
                            </div>
                            <div className="rounded-[12px] bg-white px-3 py-2">
                                <p className="text-xs text-gray-4">{t('feature.registerWard.shiftTypes.shortNameLabel')}</p>
                                <p className="mt-1 font-poppins text-sm font-semibold text-sub-2">{shiftType.shortName}</p>
                            </div>
                        </div>
                    </article>
                ))}
            </div>

            <CreateShiftModal
                open={openModal}
                close={() => {
                    setTempShiftType(null);
                    setOpenModal(false);
                }}
                shiftType={tempShiftType}
                existingShortNames={wardShiftTypes.map((shiftType) => shiftType.shortName)}
                onSubmit={(shiftType: TCreateShiftTypeDTO) => {
                    if (tempShiftType) {
                        setWardShiftTypes(
                            produce(wardShiftTypes, (draft) => {
                                draft[tempShiftType.wardShiftTypeId] = shiftType;
                            }),
                        );
                    } else {
                        setWardShiftTypes(
                            produce(wardShiftTypes, (draft) => {
                                draft.push(shiftType);
                            }),
                        );
                    }

                    setTempShiftType(null);
                }}
                onDelete={() =>
                    tempShiftType &&
                    setWardShiftTypes(
                        produce(wardShiftTypes, (draft) => {
                            draft.splice(tempShiftType.wardShiftTypeId, 1);
                        }),
                    )
                }
            />
        </section>
    );
}

export default RegisterWardShiftTypesSection;
