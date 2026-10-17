import {forwardRef, useRef, useState} from 'react';
import {Input, type IInputProps} from '@/shared/ui/primitives/input';

interface ICompositionInputProps extends Omit<IInputProps, 'value' | 'onChange'> {
    value: string;
    onValueChange: (value: string) => void;
}

// Let an IME finish conversion before callers normalize or truncate the text.
const CompositionInput = forwardRef<HTMLInputElement, ICompositionInputProps>(
    ({value, onValueChange, maxLength, onCompositionStart, onCompositionEnd, ...props}, ref) => {
        const composing = useRef(false);
        const [compositionValue, setCompositionValue] = useState<string | null>(null);
        const commit = (nextValue: string) => onValueChange(maxLength == null ? nextValue : nextValue.slice(0, maxLength));

        return (
            <Input
                {...props}
                ref={ref}
                value={compositionValue ?? value}
                onCompositionStart={(event) => {
                    composing.current = true;
                    setCompositionValue(event.currentTarget.value);
                    onCompositionStart?.(event);
                }}
                onCompositionEnd={(event) => {
                    composing.current = false;
                    setCompositionValue(null);
                    commit(event.currentTarget.value);
                    onCompositionEnd?.(event);
                }}
                onChange={(event) => {
                    if (composing.current || (event.nativeEvent as InputEvent).isComposing) {
                        setCompositionValue(event.target.value);

                        return;
                    }

                    commit(event.target.value);
                }}
            />
        );
    },
);

CompositionInput.displayName = 'CompositionInput';

export default CompositionInput;
