import {observer} from 'mobx-react-lite';
import {useState} from 'react';
import {twMerge} from 'tailwind-merge';
import {events, sendEvent} from '@/analytics';
import {EditDutyStore} from '@/features/shift/editDuty/store';
import {useDependency} from '@/shared/hook/use-dependency';

function Panel() {
    const store = useDependency(EditDutyStore);
    const {readonly, faults, shiftStatus, shift} = store.viewState;
    const [open, setOpen] = useState(false);
    const [currentTab, setCurrentTab] = useState('histories');

    return !readonly && shiftStatus === 'success' && shift ? (
        <div
            className={twMerge(
                'flex flex-col rounded-[1.25rem] bg-white shadow-banner',
                open && 'absolute right-5 bottom-5 h-[300%] max-h-[50vh]',
            )}
            style={{
                width: `${(shift.wardShiftTypes.filter((x) => x.isCounted).length + 1) * 2 + 1.25 + 1.25}rem`,
            }}
        >
            <div className="flex h-10 w-full border-b-[.0313rem] border-sub-4 font-apple text-base font-medium">
                <div
                    className={`flex h-10 flex-1 cursor-pointer items-center justify-center rounded-tl-[1.25rem] border-r-[.0313rem] border-sub-4 ${currentTab === 'histories' ? 'bg-main-4 text-sub-1' : 'bg-sub-5 text-sub-2.5'}`}
                    onClick={() => {
                        setCurrentTab('histories');
                        sendEvent(events.makePage.panel.changePanelTab, 'histories');
                    }}
                >
                    기록
                </div>
                <div
                    className={`flex h-10 flex-1 cursor-pointer items-center justify-center rounded-tr-[1.25rem] ${currentTab === 'faults' ? 'bg-main-4 text-sub-1' : 'bg-sub-5 text-sub-2.5'}`}
                    onClick={() => {
                        setCurrentTab('faults');
                        sendEvent(events.makePage.panel.changePanelTab, 'faults');
                    }}
                >
                    <p className="relative">
                        문제점
                        <span className="absolute top-0 right-0 flex h-[.875rem] w-[.875rem] translate-x-full items-center justify-center rounded-full bg-main-2 font-apple text-[.625rem] text-white">
                            {[...faults.values()].length}
                        </span>
                    </p>
                </div>
            </div>
            <div className="scrollbar-hide flex flex-1 flex-col overflow-y-scroll">
                {currentTab === 'faults'
                    ? [...faults.values()].map((fault, index) => (
                          <p
                              key={index}
                              className="cursor-pointer border-b-[.0313rem] border-sub-4 px-[.8125rem] py-[.625rem] font-apple text-[.75rem] text-sub-2 last:border-none"
                              onClick={() => {
                                  store.changeFocus(fault.focus);
                              }}
                          >
                              {fault.focus.shiftNurseName} / {fault.focus.day + 1}일: {fault.message}
                          </p>
                      ))
                    : null}
            </div>
            <div
                className="flex h-7.5 w-full cursor-pointer items-center justify-center font-apple text-[.625rem] text-main-3"
                onClick={() => {
                    setOpen(!open);
                    sendEvent(open ? events.makePage.panel.foldPanel : events.makePage.panel.spreadPanel);
                }}
            >
                {open ? '닫기' : '펼치기'}
            </div>
        </div>
    ) : null;
}

export default observer(Panel);
