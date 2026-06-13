import {produce} from 'immer';
import {CornerDownLeft, Plus, X} from 'lucide-react';
import {type Dispatch, type SetStateAction} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

interface IRegisterWardShiftTeamsSectionProps {
    shiftTeams: string[][];
    setShiftTeams: Dispatch<SetStateAction<string[][]>>;
}

function RegisterWardShiftTeamsSection({shiftTeams, setShiftTeams}: IRegisterWardShiftTeamsSectionProps) {
    const {t} = useTypedTranslation();
    const appendClipboardTextToNurse = async (index: number) => {
        const nurses = (await navigator.clipboard.readText())
            .split('\n')
            .map((value) => value.replace(/\r/g, '').trim())
            .filter(Boolean);

        if (nurses.length === 0) return;

        setShiftTeams(
            produce(shiftTeams, (draft) => {
                draft[index] = draft[index].concat(nurses);
            }),
        );
    };

    return (
        <section className="mt-4 rounded-[24px] bg-white p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-[20px] font-semibold text-sub-1">{t('feature.registerWard.shiftTeams.title')}</h2>
                    <p className="mt-1 text-xs leading-5 text-gray-3">{t('feature.registerWard.shiftTeams.description')}</p>
                </div>
                <button
                    type="button"
                    className="h-9 shrink-0 cursor-pointer gap-1.5 rounded-[12px] bg-gray-7 px-3 text-sm font-semibold text-gray-3 transition-colors hover:bg-gray-6"
                    onClick={() => {
                        setShiftTeams(
                            produce(shiftTeams, (draft) => {
                                draft.push([]);
                            }),
                        );
                    }}
                >
                    <Plus className="h-4 w-4" />
                    {t('feature.registerWard.shiftTeams.addTeam')}
                </button>
            </div>

            <div className="mt-4 space-y-3">
                {shiftTeams.map((shiftTeam, index) => (
                    <article key={index} className="rounded-[16px] bg-gray-7 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-[16px] font-semibold text-sub-1">
                                    {t('feature.registerWard.shiftTeams.teamName', {index: index + 1})}
                                </h3>
                                <p className="mt-1 text-xs text-gray-3">
                                    {t('feature.registerWard.shiftTeams.count', {count: shiftTeam.length})}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="h-9 w-9 cursor-pointer rounded-full bg-white text-gray-3 transition-colors hover:bg-[#FFF1F6] hover:text-red disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => {
                                    setShiftTeams(
                                        produce(shiftTeams, (draft) => {
                                            draft.splice(index, 1);
                                        }),
                                    );
                                }}
                                disabled={shiftTeams.length === 1}
                                aria-label={t('feature.registerWard.shiftTeams.deleteTeamAria', {index: index + 1})}
                                title={t('feature.registerWard.shiftTeams.deleteTeamAria', {index: index + 1})}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {shiftTeam.map((name, nameIndex) => (
                                <span key={`${name}-${nameIndex}`} className="flex h-8 items-center gap-1 rounded-[10px] bg-white px-3">
                                    <span className="text-sm font-medium text-sub-1">{name}</span>
                                    <button
                                        type="button"
                                        className="h-5 w-5 cursor-pointer rounded-full text-gray-4 transition-colors hover:bg-gray-7 hover:text-gray-3"
                                        onClick={() => {
                                            setShiftTeams(
                                                produce(shiftTeams, (draft) => {
                                                    draft[index].splice(nameIndex, 1);
                                                }),
                                            );
                                        }}
                                        aria-label={t('feature.registerWard.shiftTeams.deleteNurseAria', {name})}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </span>
                            ))}
                            <label className="flex h-8 min-w-32 items-center gap-1 rounded-[10px] bg-white px-3">
                                <input
                                    aria-label={t('feature.registerWard.shiftTeams.addNurseAria', {index: index + 1})}
                                    placeholder={t('feature.registerWard.shiftTeams.addNamePlaceholder')}
                                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-sub-1 outline-none placeholder:text-gray-4"
                                    onKeyDown={(e) => {
                                        if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
                                            e.preventDefault();
                                            void appendClipboardTextToNurse(index);

                                            return;
                                        }

                                        if (e.nativeEvent.isComposing) return;

                                        if (e.key === 'Enter') {
                                            e.preventDefault();

                                            const value = e.currentTarget.value.trim();

                                            if (!value) return;

                                            e.currentTarget.value = '';
                                            setShiftTeams(
                                                produce(shiftTeams, (draft) => {
                                                    draft[index].push(value);
                                                }),
                                            );
                                        }
                                    }}
                                />
                                <CornerDownLeft className="h-4 w-4 shrink-0 text-gray-4" />
                            </label>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default RegisterWardShiftTeamsSection;
