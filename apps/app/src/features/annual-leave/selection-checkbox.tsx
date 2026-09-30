import {Check, Minus} from 'lucide-react';

export function AnnualLeaveSelectionCheckbox({
    label,
    checked,
    indeterminate = false,
    disabled = false,
    title,
    onChange,
}: {
    label: string;
    checked: boolean;
    indeterminate?: boolean;
    disabled?: boolean;
    title?: string;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label
            title={title}
            className={`group relative flex size-11 items-center justify-center rounded-lg has-[:focus-visible]:bg-main-4 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <input
                type="checkbox"
                aria-label={label}
                checked={checked}
                disabled={disabled}
                ref={(element) => {
                    if (element) element.indeterminate = indeterminate;
                }}
                onChange={(event) => onChange(event.target.checked)}
                className="peer cursor-inherit absolute size-5 opacity-0 forced-colors:opacity-100"
            />
            <span
                aria-hidden="true"
                className={`pointer-events-none flex size-5 items-center justify-center rounded-md transition-[background-color,transform,filter] peer-focus-visible:scale-110 peer-disabled:opacity-35 motion-reduce:transition-none forced-colors:hidden ${checked || indeterminate ? 'bg-main-1 text-white' : 'bg-gray-6'} ${disabled ? '' : checked || indeterminate ? 'group-hover:brightness-90' : 'group-hover:bg-gray-5'}`}
            >
                {indeterminate ? <Minus size={14} strokeWidth={3} /> : checked ? <Check size={14} strokeWidth={3} /> : null}
            </span>
        </label>
    );
}
