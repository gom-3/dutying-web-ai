import {useQuery} from '@tanstack/react-query';
import {Download, Info} from 'lucide-react';
import {Component, useMemo, useRef, useState, type ReactNode} from 'react';
import {events, sendEvent} from '@/analytics';
import {type TShift} from '@/entities';
import {getWardDisplayCode, getWardDisplayTitle, wardQueryOptions} from '@/entities/ward';
import useAuth from '@/features/auth';
import {shiftToDoc, type TViolation, useShiftImageExport} from '@/features/shift-editor';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Button from '@/shared/ui/form-controls/Button';
import PageState from '@/shared/ui/PageState';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';
import WardCodeGuideModal from '@/widgets/ward-code-guide-modal';
import {useMakeShiftStore} from '../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../model/make-shift-use-case';
import {MAKE_SHIFT_STEP_NAV_BUTTON_CLASS} from '../make-shift-step-nav';
import {MakeShiftCalendar} from './shared/make-shift-calendar';
import {useMakeShiftSkillColumn} from './shared/use-make-shift-skill-column';

const EMPTY_VIOLATION_MAP: Map<string, TViolation> = new Map();

function toConfirmedDoc(shift: TShift | null | undefined, year: number, month: number) {
    if (!shift) return null;

    try {
        return shiftToDoc(shift, year, month);
    } catch {
        return null;
    }
}

export function ConfirmedShifts() {
    const {t} = useTypedTranslation();
    const calendarExportRef = useRef<HTMLDivElement>(null);
    const [wardCodeGuideOpen, setWardCodeGuideOpen] = useState(false);
    const {
        state: {wardId},
    } = useAuth();
    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const shiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const confirmedShiftSnapshot = useMakeShiftStore((s) => s.confirmedShiftSnapshot);
    const useCase = useMakeShiftUseCase();
    const enabled = wardId !== null && currentShiftTeamId !== null;
    const dutyQuery = useQuery({
        ...wardQueryOptions.duty(wardId ?? -1, currentShiftTeamId ?? -1, year, month),
        enabled,
    });
    const wardQuery = useQuery({
        ...wardQueryOptions.id(wardId ?? -1),
        enabled: wardId !== null,
        staleTime: 1000 * 60 * 5,
    });
    const teamName =
        shiftTeams.find((team) => team.shiftTeamId === currentShiftTeamId)?.name ?? t('page.makeShift.confirmedShifts.fallbackTeamName');
    const shift = dutyQuery.data ?? confirmedShiftSnapshot;
    const skillColumn = useMakeShiftSkillColumn(shift);
    const doc = useMemo(() => toConfirmedDoc(shift, year, month), [month, shift, year]);
    const {isExporting, downloadImage} = useShiftImageExport({
        targetRef: calendarExportRef,
        year,
        month,
        teamName,
        hospitalName: wardQuery.data?.hospitalName ?? null,
        wardName: wardQuery.data?.name ?? null,
        disabled: !shift || !doc,
    });
    const calendarResetKey = `${wardId ?? 'none'}:${currentShiftTeamId ?? 'none'}:${year}:${month}:${shift ? 'ready' : 'empty'}`;
    const imageActionLabel = isExporting
        ? t('page.makeShift.confirmedShifts.imageActionLoading')
        : t('page.makeShift.confirmedShifts.imageAction');
    const wardCodeGuideLabel = t('page.makeShift.confirmedShifts.wardCodeGuideAction');

    return (
        <>
            <WardCodeGuideModal
                open={wardCodeGuideOpen}
                wardCode={getWardDisplayCode(wardQuery.data, t('entity.ward.codeChecking'))}
                wardTitle={getWardDisplayTitle(wardQuery.data)}
                onClose={() => setWardCodeGuideOpen(false)}
            />
            <div id="make_confirmed_shifts_step" className="confirmed-shifts-root flex w-full min-w-0 flex-col gap-3 pt-3 outline-none">
                <div className="confirmed-shifts-toolbar flex w-full min-w-0 flex-nowrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 pl-8 min-[1600px]:pl-10">
                        <h1 className="confirmed-shifts-toolbar__title truncate font-apple text-[26px] leading-tight font-bold text-sub-1 min-[1600px]:text-[28px]">
                            {t('page.makeShift.confirmedShifts.title', {teamName, month})}
                        </h1>
                        <div className="mt-3 flex min-w-0 items-center gap-1.5 min-[1600px]:mt-4">
                            <p className="confirmed-shifts-toolbar__hint truncate font-apple text-[15px] leading-[26px] font-medium text-gray-3 min-[1600px]:text-[16px] min-[1600px]:leading-[28px]">
                                {t('page.makeShift.confirmedShifts.hint')}
                            </p>
                            <TooltipProvider delayDuration={120}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            aria-label={wardCodeGuideLabel}
                                            title={wardCodeGuideLabel}
                                            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-main-1 transition-colors hover:bg-main-light hover:text-main-2 focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none"
                                            onClick={() => setWardCodeGuideOpen(true)}
                                        >
                                            <Info className="size-4" strokeWidth={2.2} aria-hidden="true" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent
                                        side="top"
                                        className="rounded-full bg-[#1C2331] px-3 py-1.5 text-[12px] font-semibold text-white"
                                    >
                                        {wardCodeGuideLabel}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>

                    <div className="confirmed-shifts-toolbar__actions ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-2">
                        <TooltipProvider delayDuration={120}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="secondary"
                                        size="md"
                                        type="button"
                                        aria-label={imageActionLabel}
                                        title={imageActionLabel}
                                        className="size-10 cursor-pointer rounded-[12px] border border-gray-6 bg-white p-0 text-gray-3 shadow-none hover:bg-gray-7 hover:text-sub-1 focus-visible:ring-1 focus-visible:ring-main-1 focus-visible:ring-offset-0 disabled:bg-gray-7 disabled:text-gray-4"
                                        onClick={() => {
                                            void downloadImage();
                                            sendEvent(events.makePage.toolbar.downloadImage);
                                        }}
                                        disabled={!shift || !doc || isExporting}
                                    >
                                        <Download
                                            className={`size-5 ${isExporting ? 'animate-pulse' : ''}`}
                                            strokeWidth={1.8}
                                            aria-hidden="true"
                                        />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent
                                    side="top"
                                    className="rounded-full bg-[#1C2331] px-3 py-1.5 text-[12px] font-semibold text-white"
                                >
                                    {imageActionLabel}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <Button
                            variant="secondary"
                            size="md"
                            type="button"
                            className={`min-w-[112px] cursor-pointer border-0 px-5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 ${MAKE_SHIFT_STEP_NAV_BUTTON_CLASS}`}
                            onClick={useCase.editConfirmed}
                        >
                            {t('page.makeShift.confirmedShifts.editAction')}
                        </Button>
                    </div>
                </div>

                {!shift && dutyQuery.isLoading && (
                    <PageState
                        tone="loading"
                        loadingColor="purple"
                        title={t('page.makeShift.confirmedShifts.loading')}
                        description={t('page.state.loadingDescription')}
                    />
                )}
                {!shift && dutyQuery.isError && (
                    <PageState
                        tone="error"
                        title={t('page.makeShift.confirmedShifts.error')}
                        description={t('page.state.errorDescription')}
                        action={{label: t('page.state.retry'), onClick: () => void dutyQuery.refetch()}}
                    />
                )}
                {shift && !doc && (
                    <PageState
                        tone="error"
                        title={t('page.makeShift.confirmedShifts.error')}
                        description={t('page.state.errorDescription')}
                        action={{label: t('page.state.retry'), onClick: () => void dutyQuery.refetch()}}
                    />
                )}
                {shift && doc && (
                    <div ref={calendarExportRef} className="confirmed-shifts-calendar-wrap w-full min-w-0">
                        <ConfirmedCalendarBoundary
                            resetKey={calendarResetKey}
                            fallback={
                                <PageState
                                    tone="error"
                                    title={t('page.makeShift.confirmedShifts.error')}
                                    description={t('page.state.errorDescription')}
                                    action={{label: t('page.state.retry'), onClick: () => void dutyQuery.refetch()}}
                                />
                            }
                        >
                            <MakeShiftCalendar
                                shift={shift}
                                doc={doc}
                                violationMap={EMPTY_VIOLATION_MAP}
                                showFaults={false}
                                readonly
                                disableInitialSelection
                                skillColumn={skillColumn}
                            />
                        </ConfirmedCalendarBoundary>
                    </div>
                )}
                {!dutyQuery.isLoading && !dutyQuery.isError && !shift && (
                    <PageState
                        tone="empty"
                        title={t('page.makeShift.confirmedShifts.empty')}
                        description={t('page.state.emptyDescription')}
                    />
                )}
            </div>
        </>
    );
}

class ConfirmedCalendarBoundary extends Component<{children: ReactNode; fallback: ReactNode; resetKey: string}, {hasError: boolean}> {
    state = {hasError: false};

    static getDerivedStateFromError() {
        return {hasError: true};
    }

    componentDidUpdate(prevProps: {resetKey: string}) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
            this.setState({hasError: false});
        }
    }

    render() {
        if (this.state.hasError) return this.props.fallback;

        return this.props.children;
    }
}
