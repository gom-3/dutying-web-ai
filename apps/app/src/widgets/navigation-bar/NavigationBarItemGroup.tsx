import {
    AccountIcon,
    AccountIconSelected,
    DutyIcon,
    DutyIconSelected,
    NurseIcon,
    NurseIconSelected,
    RequestIcon,
    RequestIconSelected,
    SettingIcon,
    SettingIconSelected,
} from '@/shared/assets/svg';
import ROUTE, {type TRoute} from '@/shared/constant/path';
import NavigationBarItem from './NavigationBarItem';

type TNavItem = {
    path?: TRoute;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    selectedIcon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    text: string;
    disabled?: boolean;
};

type TNavSection = {
    label: string;
    items: TNavItem[];
};

const sections: TNavSection[] = [
    {
        label: '근무표',
        items: [
            {
                path: ROUTE.MAKE,
                icon: DutyIcon,
                selectedIcon: DutyIconSelected,
                text: '근무표 만들기',
            },
            {
                path: ROUTE.REQUEST,
                icon: RequestIcon,
                selectedIcon: RequestIconSelected,
                text: '신청근무 관리',
            },
        ],
    },
    {
        label: '근무 설정',
        items: [
            {
                path: ROUTE.MEMBER,
                icon: NurseIcon,
                selectedIcon: NurseIconSelected,
                text: '근무자 관리',
            },
            {
                path: ROUTE.WARD_SETTINGS,
                icon: SettingIcon,
                selectedIcon: SettingIconSelected,
                text: '근무 관리',
            },
            {
                path: ROUTE.PROFILE,
                icon: AccountIcon,
                selectedIcon: AccountIconSelected,
                text: '계정 관리',
            },
        ],
    },
];
const NavigationBarItemGroups = () => {
    return (
        <nav className="w-full">
            {sections.map((section) => (
                <div key={section.label}>
                    <div className="my-6 h-px w-full bg-gray-6" />
                    <div className="px-[20px] pb-[14px] text-[14px] font-medium text-gray-4">{section.label}</div>
                    <div className="mt-2 flex flex-col gap-2 px-[2px]">
                        {section.items.map((item) => (
                            <NavigationBarItem
                                key={item.path ?? item.text}
                                path={item.path}
                                Icon={item.icon}
                                SelectedIcon={item.selectedIcon}
                                text={item.text}
                                disabled={item.disabled}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </nav>
    );
};

export default NavigationBarItemGroups;
