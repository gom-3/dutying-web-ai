import {useWardSettings} from './model/wardSettingsHook';
import {WardSettingsPageView} from './ui';

const WardSettingsPage = () => {
    const wardSettings = useWardSettings();

    return <WardSettingsPageView {...wardSettings} />;
};

export default WardSettingsPage;
