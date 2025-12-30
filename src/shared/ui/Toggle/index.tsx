import {Switch} from '@/shared/ui/shadcn/switch';
import {cn} from '@/shared/util/style';

interface ToggleProps {
    isOn: boolean;
    setIsOn: (isOn: boolean) => void;
}

const Toggle = ({isOn, setIsOn}: ToggleProps) => {
    return (
        <Switch
            data-testid="toggle"
            checked={isOn}
            onCheckedChange={(checked) => setIsOn(checked)}
            className={cn('relative h-4 w-7.5 rounded-2xl transition-[0.8s]', isOn ? 'bg-main-1' : 'bg-sub-4')}
        />
    );
};

export default Toggle;
