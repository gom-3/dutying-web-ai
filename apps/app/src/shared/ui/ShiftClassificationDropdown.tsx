import {cn} from '@dutying/utils/style';
import {ChevronDown} from 'lucide-react';
import {type ReactNode, useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

export type TShiftClassificationDropdownOption = {
    value: string;
    label: ReactNode;
};

type TShiftClassificationDropdownProps = {
    value: string;
    options: readonly TShiftClassificationDropdownOption[];
    ariaLabel: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    onDisabledClick?: () => void;
    className?: string;
};

type TMenuPosition = {
    left: number;
    top?: number;
    bottom?: number;
    minWidth: number;
};

const MENU_MAX_HEIGHT = 240;
const VIEWPORT_PADDING = 12;

export default function ShiftClassificationDropdown({
    value,
    options,
    ariaLabel,
    onChange,
    disabled = false,
    onDisabledClick,
    className,
}: TShiftClassificationDropdownProps) {
    const [open, setOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const [menuPosition, setMenuPosition] = useState<TMenuPosition | null>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find((option) => option.value === value) ?? options[0];
    const updateMenuPosition = useCallback(() => {
        if (!triggerRef.current) return;

        const rect = triggerRef.current.getBoundingClientRect();
        const estimatedMenuHeight = Math.min(MENU_MAX_HEIGHT, Math.max(44, options.length * 38 + 8));
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const nextOpenUpward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
        const minWidth = rect.width;
        const left = Math.max(VIEWPORT_PADDING, Math.min(rect.left, window.innerWidth - minWidth - VIEWPORT_PADDING));

        setOpenUpward(nextOpenUpward);
        setMenuPosition(
            nextOpenUpward ? {left, bottom: window.innerHeight - rect.top + 4, minWidth} : {left, top: rect.bottom + 4, minWidth},
        );
    }, [options.length]);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (triggerRef.current?.contains(event.target as Node) || menuRef.current?.contains(event.target as Node)) return;

            setOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };

        updateMenuPosition();
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [open, updateMenuPosition]);

    const menuStyle = menuPosition
        ? {
              left: `${menuPosition.left}px`,
              minWidth: `${menuPosition.minWidth}px`,
              ...(openUpward ? {bottom: `${menuPosition.bottom}px`} : {top: `${menuPosition.top}px`}),
          }
        : undefined;

    return (
        <div ref={triggerRef} className="relative w-full">
            <button
                type="button"
                role="combobox"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-disabled={disabled}
                onClick={() => {
                    if (disabled) {
                        onDisabledClick?.();

                        return;
                    }

                    if (!open) updateMenuPosition();

                    setOpen((previous) => !previous);
                }}
                className={cn(
                    'relative flex h-10 w-full cursor-pointer items-center justify-center rounded-[10px] border-0 bg-gray-7 px-3 pr-9 font-poppins text-[15px] leading-[1.4] text-sub-1 ring-1 ring-transparent transition-[background-color,box-shadow] duration-150 ease-out hover:bg-gray-6/50 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-main-1/70 focus-visible:outline-none',
                    disabled && 'cursor-not-allowed bg-gray-6 text-gray-4 opacity-70 hover:bg-gray-6',
                    className,
                )}
            >
                <span className="truncate">{selectedOption?.label ?? value}</span>
                <ChevronDown
                    className={cn('pointer-events-none absolute right-2.5 h-4 w-4 text-gray-3 transition-transform', open && 'rotate-180')}
                    strokeWidth={2.25}
                    aria-hidden="true"
                />
            </button>

            {open && menuPosition && typeof document !== 'undefined'
                ? createPortal(
                      <div
                          ref={menuRef}
                          role="listbox"
                          aria-label={ariaLabel}
                          style={menuStyle}
                          className={cn(
                              'fixed z-[2147483647] max-h-[240px] animate-in overflow-y-auto rounded-[10px] border border-gray-6 bg-white py-1 shadow-[0px_10px_28px_rgba(95,100,135,0.16)] duration-150 fade-in-0 zoom-in-95',
                              openUpward ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1',
                          )}
                      >
                          {options.map((option) => {
                              const isSelected = option.value === selectedOption?.value;

                              return (
                                  <button
                                      key={option.value}
                                      type="button"
                                      role="option"
                                      aria-selected={isSelected}
                                      className={cn(
                                          'flex min-h-9 w-full cursor-pointer items-center justify-center px-3 py-2 font-apple text-[14px] leading-[1.4] whitespace-nowrap transition-colors hover:bg-gray-7 focus-visible:outline-2 focus-visible:outline-main-1',
                                          isSelected ? 'bg-main-light font-semibold text-main-1' : 'text-sub-1',
                                      )}
                                      onClick={() => {
                                          onChange(option.value);
                                          setOpen(false);
                                      }}
                                  >
                                      {option.label}
                                  </button>
                              );
                          })}
                      </div>,
                      document.body,
                  )
                : null}
        </div>
    );
}
