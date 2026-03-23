import {useWardSettings} from './model/useWardSettings';
import {WardSettingsPageView} from './ui';

const WardSettingsPage = () => {
    const wardSettings = useWardSettings();

    return <WardSettingsPageView {...wardSettings} />;
};

export default WardSettingsPage;
