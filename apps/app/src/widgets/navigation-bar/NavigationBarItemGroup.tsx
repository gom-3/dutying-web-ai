import {cn} from '@dutying/utils/style';
import {CircleUserRound, MessageSquareText, SlidersHorizontal, UsersRound} from 'lucide-react';
import {type ComponentType, type SVGProps, useState} from 'react';
import {getWardDisplayCode, getWardDisplayIdentity, getWardDisplayTitle} from '@/entities/ward';
import useEditWard from '@/features/edit-ward';
import {useTotalPendingRequestCount} from '@/features/request-shift/model/use-total-pending-request-count';
import ROUTE, {type TRoute} from '@/shared/constant/path';
import {type TI18nKey, useTypedTranslation} from '@/shared/hook/use-typed-translation';
import WardCodeGuideModal from '@/widgets/ward-code-guide-modal';
import NavigationBarItem from './NavigationBarItem';

type TNavItem = {
    path?: TRoute;
    activePaths?: TRoute[];
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    selectedIcon?: ComponentType<SVGProps<SVGSVGElement>>;
    textKey: TI18nKey;
    disabled?: boolean;
};

type TNavSection = {
    labelKey: TI18nKey;
    items: TNavItem[];
};

const ScheduleIconOff = ({className}: SVGProps<SVGSVGElement>) => (
    <img src="/img/schedule-icon-off.png" alt="" aria-hidden="true" className={cn('!size-[23px] object-contain', className)} />
);
const ScheduleIconOn = ({className}: SVGProps<SVGSVGElement>) => (
    <img src="/img/schedule-icon-on.png" alt="" aria-hidden="true" className={cn('!size-[23px] object-contain', className)} />
);
const RequestShiftIconOff = ({className}: SVGProps<SVGSVGElement>) => (
    <img src="/img/request-icon-off.png" alt="" aria-hidden="true" className={cn('!size-[23px] object-contain', className)} />
);
const RequestShiftIconOn = ({className}: SVGProps<SVGSVGElement>) => (
    <img src="/img/request-icon-on.png" alt="" aria-hidden="true" className={cn('!size-[23px] object-contain', className)} />
);
const sections: TNavSection[] = [
    {
        labelKey: 'page.navigationBar.sections.operations',
        items: [
            {
                path: ROUTE.MAKE,
                activePaths: [ROUTE.MAKE, ROUTE.DUTY],
                icon: ScheduleIconOff,
                selectedIcon: ScheduleIconOn,
                textKey: 'page.navigationBar.items.make',
            },
            {
                path: ROUTE.REQUEST,
                icon: RequestShiftIconOff,
                selectedIcon: RequestShiftIconOn,
                textKey: 'page.navigationBar.items.request',
            },
            {
                path: ROUTE.BOARD,
                icon: MessageSquareText,
                textKey: 'page.navigationBar.items.board',
            },
        ],
    },
    {
        labelKey: 'page.navigationBar.sections.settings',
        items: [
            {
                path: ROUTE.MEMBER,
                icon: UsersRound,
                textKey: 'page.navigationBar.items.member',
            },
            {
                path: ROUTE.WARD_SETTINGS,
                icon: SlidersHorizontal,
                textKey: 'page.navigationBar.items.wardSettings',
            },
            {
                path: ROUTE.PROFILE,
                icon: CircleUserRound,
                textKey: 'page.navigationBar.items.account',
            },
        ],
    },
];

type TNavigationBarItemGroupsProps = {
    collapsed?: boolean;
};

type TWardIdentityProps = {
    collapsed: boolean;
    ward?: {
        hospitalName?: string;
        name?: string;
        code?: string;
    };
};

const WardIdentity = ({collapsed, ward}: TWardIdentityProps) => {
    const {supportingName, primaryName} = getWardDisplayIdentity(ward);
    const wardTitle = getWardDisplayTitle(ward);
    const wardCode = getWardDisplayCode(ward);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const wardCodeButton = (
        <button
            type="button"
            aria-label={`병동코드 ${wardCode} 안내 보기`}
            className="inline-flex shrink-0 items-center rounded-full bg-main-light px-2.5 py-1 transition-colors hover:bg-main-4 focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={() => setIsGuideOpen(true)}
        >
            <span className="font-poppins text-[11px] leading-none font-semibold text-main-1">{wardCode}</span>
        </button>
    );

    if (collapsed) {
        return null;
    }

    return (
        <>
            <div className="mb-5">
                <div className="mb-4 h-px w-full bg-gray-6" />
                <div className="px-2">
                    {supportingName ? (
                        <>
                            <div className="flex items-start justify-between gap-2">
                                <p
                                    className="min-w-0 flex-1 truncate pt-0.5 text-[10px] leading-4 font-semibold text-gray-4"
                                    title={supportingName}
                                >
                                    {supportingName}
                                </p>
                                {wardCodeButton}
                            </div>
                            <p className="mt-1 truncate text-[16px] leading-5 font-bold text-sub-1" title={primaryName}>
                                {primaryName}
                            </p>
                        </>
                    ) : (
                        <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 flex-1 truncate text-[16px] leading-5 font-bold text-sub-1" title={primaryName}>
                                {primaryName}
                            </p>
                            {wardCodeButton}
                        </div>
                    )}
                </div>
            </div>
            <WardCodeGuideModal open={isGuideOpen} wardCode={wardCode} wardTitle={wardTitle} onClose={() => setIsGuideOpen(false)} />
        </>
    );
};
const NavigationBarItemGroups = ({collapsed = false}: TNavigationBarItemGroupsProps) => {
    const {t} = useTypedTranslation();
    const {
        state: {ward, watingNurses},
    } = useEditWard();
    const waitingCount = watingNurses?.length ?? 0;
    const pendingRequestCount = useTotalPendingRequestCount(ward?.shiftTeams);

    return (
        <nav aria-label={t('page.navigationBar.ariaLabel')} className={cn('w-full', collapsed ? 'mt-5' : 'mt-6')}>
            <WardIdentity collapsed={collapsed} ward={ward} />
            {sections.map((section, sectionIndex) => (
                <div
                    key={section.labelKey}
                    className={cn(collapsed ? (sectionIndex === 0 ? 'mt-0' : 'mt-4') : sectionIndex === 0 ? 'mt-0' : 'mt-7')}
                >
                    <div className={cn('h-px bg-gray-6', collapsed ? 'mx-auto mb-4 w-8' : 'mb-4 w-full')} />
                    {collapsed ? null : <div className="px-3 pb-2 text-[12px] font-semibold text-gray-4">{t(section.labelKey)}</div>}
                    <div className={cn('flex flex-col', collapsed ? 'gap-2' : 'gap-1.5')}>
                        {section.items.map((item) => (
                            <NavigationBarItem
                                key={item.path ?? item.textKey}
                                path={item.path}
                                activePaths={item.activePaths}
                                Icon={item.icon}
                                SelectedIcon={item.selectedIcon}
                                text={t(item.textKey)}
                                collapsed={collapsed}
                                disabled={item.disabled}
                                badgeCount={
                                    item.path === ROUTE.MEMBER ? waitingCount : item.path === ROUTE.REQUEST ? pendingRequestCount : 0
                                }
                            />
                        ))}
                    </div>
                </div>
            ))}
        </nav>
    );
};

export default NavigationBarItemGroups;
