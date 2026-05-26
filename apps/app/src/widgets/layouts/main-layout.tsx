import {useQuery} from '@tanstack/react-query';
import {useEffect, useMemo, useState} from 'react';
import {Outlet, useLocation, useNavigate} from 'react-router';
import {getWardDisplayCode, getWardDisplayTitle, wardQueryOptions} from '@/entities/ward';
import useAuth from '@/features/auth';
import NavigationBar from '@/widgets/navigation-bar';
import WardChatWidget from '@/widgets/ward-chat';
import WardCodeGuideModal from '@/widgets/ward-code-guide-modal';

const WARD_CREATED_GUIDE_STORAGE_KEY = 'dutying:onboardingWardCreatedGuide';

type TWardCreatedGuidePayload = {
    wardCode?: string | null;
    wardTitle?: string | null;
};

type TMainLayoutLocationState = {
    onboardingWardCreated?: true | TWardCreatedGuidePayload;
} | null;

const normalizeWardCreatedGuidePayload = (value: unknown): TWardCreatedGuidePayload | null => {
    if (value === true) {
        return {};
    }

    if (!value || typeof value !== 'object') {
        return null;
    }

    return value as TWardCreatedGuidePayload;
};
const readStoredWardCreatedGuidePayload = () => {
    const rawPayload = window.sessionStorage.getItem(WARD_CREATED_GUIDE_STORAGE_KEY);

    if (!rawPayload) {
        return null;
    }

    try {
        return normalizeWardCreatedGuidePayload(JSON.parse(rawPayload));
    } catch {
        return null;
    }
};

export const MainLayout = () => {
    const {
        state: {wardId},
    } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const locationState = location.state as TMainLayoutLocationState;
    const locationGuidePayload = useMemo(
        () => normalizeWardCreatedGuidePayload(locationState?.onboardingWardCreated),
        [locationState?.onboardingWardCreated],
    );
    const [createdWardGuidePayload, setCreatedWardGuidePayload] = useState<TWardCreatedGuidePayload | null>(null);
    const wardQuery = useQuery({
        ...wardQueryOptions.id(wardId ?? -1),
        enabled: wardId !== null,
        staleTime: 1000 * 60 * 5,
    });
    const wardCode = createdWardGuidePayload?.wardCode ?? getWardDisplayCode(wardQuery.data, '확인 중');
    const wardTitle = createdWardGuidePayload?.wardTitle ?? getWardDisplayTitle(wardQuery.data);

    useEffect(() => {
        const guidePayload = locationGuidePayload ?? readStoredWardCreatedGuidePayload();

        if (!guidePayload) {
            return;
        }

        window.sessionStorage.removeItem(WARD_CREATED_GUIDE_STORAGE_KEY);
        setCreatedWardGuidePayload(guidePayload);

        if (locationGuidePayload) {
            navigate(`${location.pathname}${location.search}`, {replace: true, state: null});
        }
    }, [location.pathname, location.search, locationGuidePayload, navigate]);

    return (
        <div className="flex h-full w-full bg-main-bg">
            <WardCodeGuideModal
                open={createdWardGuidePayload !== null}
                wardCode={wardCode}
                wardTitle={wardTitle}
                onClose={() => setCreatedWardGuidePayload(null)}
            />
            <NavigationBar />
            <main className="min-w-0 flex-1 overflow-x-auto">
                <Outlet />
            </main>
            <WardChatWidget />
        </div>
    );
};
