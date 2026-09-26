import {useEffect} from 'react';
import {Toaster} from 'react-hot-toast';
import {useTranslation} from 'react-i18next';
import useAuth from '@/features/auth';
import {initializeProfileImageStore} from '@/features/file';
import appI18n from '@/i18n';
import type {TLandingSession} from './landing-page-view';

function Session({onChange}: {onChange: (session: TLandingSession) => void}) {
    const {
        state: {accountMe, isAuth},
        actions: {handleLogout},
    } = useAuth(true);
    const {i18n} = useTranslation();

    useEffect(() => {
        initializeProfileImageStore();
    }, []);

    useEffect(() => {
        // Account/profile dialogs need product copy, loaded only for an existing session.
        Object.entries(appI18n.services.resourceStore.data).forEach(([language, resource]) => {
            i18n.addResourceBundle(language, 'translation', resource.translation, true, false);
        });
        onChange({accountMe, isAuth, onLogout: handleLogout});
        // The logout action closes over no session state used by the landing.
    }, [accountMe, isAuth, i18n, onChange]);

    return <Toaster position="bottom-center" />;
}

export function LandingSessionBridge({onChange}: {onChange: (session: TLandingSession) => void}) {
    return <Session onChange={onChange} />;
}
