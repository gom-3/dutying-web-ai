import type {ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {useAnnualLeaveSchedule} from './queries';

export type TAnnualLeaveScheduleColumns = {
    count: number;
    header: ReactNode;
    renderRow: (nurseId: number) => ReactNode;
};

export function useAnnualLeaveScheduleColumns(state: ReturnType<typeof useAnnualLeaveSchedule>, visible: boolean) {
    const {t} = useTypedTranslation();
    const people = new Map(state.data?.people.map((person) => [person.nurseId, person]));
    const error = state.overview.isError || (state.managed && state.preview.isError);
    const pending = !error && (state.overview.isLoading || state.pending || (state.managed && !state.data));
    const columns: TAnnualLeaveScheduleColumns | undefined = visible
        ? {
              count: 1,
              header: (
                  <span
                      data-private-annual-leave
                      className="text-center font-apple text-[clamp(10px,0.78cqw,13px)] leading-none font-medium whitespace-pre-line text-sub-3"
                  >
                      {t('annualLeave.display.balanceHeader')}
                  </span>
              ),
              renderRow: (nurseId) => {
                  const person = people.get(nurseId);
                  const value = error || pending ? null : person?.remainingDays;
                  const name = person?.name ?? state.names.get(nurseId) ?? `#${nurseId}`;
                  const label = pending ? t('annualLeave.calculating') : value == null ? '—' : t('annualLeave.days', {count: value});

                  return (
                      <span
                          data-private-annual-leave
                          aria-label={`${name} ${t('annualLeave.display.balance')} ${label}`}
                          aria-busy={pending}
                          className={`flex h-full w-full items-center justify-center font-poppins text-[clamp(11px,0.9cqw,14px)] whitespace-nowrap tabular-nums ${value != null && value < 0 ? 'text-red' : value != null ? 'font-bold text-main-1' : 'text-sub-2'}`}
                      >
                          {pending ? '…' : (value ?? '—')}
                      </span>
                  );
              },
          }
        : undefined;

    return {columns};
}
