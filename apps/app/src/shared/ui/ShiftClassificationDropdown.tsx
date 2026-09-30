import {cn} from '@dutying/utils/style';
import {ChevronDown} from 'lucide-react';
import {type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {dropdownItemClassName, dropdownSurfaceClassName} from './dropdown-styles';

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
    portalled?: boolean;
};

type TMenuPosition = {
    left: number;
    top?: number;
    bottom?: number;
    minWidth: number;
    maxHeight?: number;
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
    portalled = true,
}: TShiftClassificationDropdownProps) {
    const [open, setOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const [menuPosition, setMenuPosition] = useState<TMenuPosition | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const menuId = useId();
    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find((option) => option.value === value) ?? options[0];
    const updateMenuPosition = useCallback(() => {
        if (!triggerRef.current) return;

        const rect = triggerRef.current.getBoundingClientRect();
        const estimatedMenuHeight = Math.min(MENU_MAX_HEIGHT, Math.max(44, options.length * 38 + 8));
        const dialogRect = !portalled ? triggerRef.current.closest('[role="dialog"]')?.getBoundingClientRect() : undefined;
        const spaceBelow = (dialogRect?.bottom ?? window.innerHeight) - rect.bottom - VIEWPORT_PADDING;
        const spaceAbove = rect.top - (dialogRect?.top ?? 0) - VIEWPORT_PADDING;
        const nextOpenUpward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
        const minWidth = rect.width;
        const left = Math.max(VIEWPORT_PADDING, Math.min(rect.left, window.innerWidth - minWidth - VIEWPORT_PADDING));

        setOpenUpward(nextOpenUpward);

        if (!portalled) {
            setMenuPosition({
                left: 0,
                minWidth,
                maxHeight: Math.max(44, Math.min(MENU_MAX_HEIGHT, (nextOpenUpward ? spaceAbove : spaceBelow) - 4)),
            });

            return;
        }

        setMenuPosition(
            nextOpenUpward ? {left, bottom: window.innerHeight - rect.top + 4, minWidth} : {left, top: rect.bottom + 4, minWidth},
        );
    }, [options.length, portalled]);

    useEffect(() => {
        if (open) menuRef.current?.children.item(activeIndex)?.scrollIntoView?.({block: 'nearest'});
    }, [activeIndex, open]);

    const openMenu = () => {
        updateMenuPosition();
        setActiveIndex(
            Math.max(
                0,
                options.findIndex((option) => option.value === value),
            ),
        );
        setOpen(true);
    };
    const selectOption = (nextValue: string) => {
        onChange(nextValue);
        setOpen(false);
        triggerRef.current?.querySelector('button')?.focus();
    };
    const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();

            if (!open) openMenu();
            else setActiveIndex((index) => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
        } else if (open && (event.key === 'Home' || event.key === 'End')) {
            event.preventDefault();
            setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
        } else if (open && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();

            if (options[activeIndex]) selectOption(options[activeIndex].value);
        } else if (event.key === 'Tab') {
            setOpen(false);
        }
    };

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

    const menuStyle =
        menuPosition && !portalled
            ? {
                  left: 0,
                  width: '100%',
                  maxHeight: menuPosition.maxHeight,
                  ...(openUpward ? {bottom: 'calc(100% + 4px)'} : {top: 'calc(100% + 4px)'}),
              }
            : menuPosition
              ? {
                    left: `${menuPosition.left}px`,
                    minWidth: `${menuPosition.minWidth}px`,
                    ...(openUpward ? {bottom: `${menuPosition.bottom}px`} : {top: `${menuPosition.top}px`}),
                }
              : undefined;
    const menu =
        open && menuPosition ? (
            <div
                ref={menuRef}
                id={menuId}
                role="listbox"
                aria-label={ariaLabel}
                style={menuStyle}
                className={cn(
                    dropdownSurfaceClassName,
                    portalled ? 'fixed' : 'absolute',
                    openUpward ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1',
                )}
            >
                {options.map((option, index) => {
                    const isSelected = option.value === selectedOption?.value;

                    return (
                        <button
                            key={option.value}
                            id={`${menuId}-${index}`}
                            type="button"
                            role="option"
                            tabIndex={-1}
                            aria-selected={isSelected}
                            className={cn(
                                dropdownItemClassName,
                                'justify-center',
                                isSelected ? 'bg-main-light font-semibold text-main-1' : 'text-sub-1',
                                index === activeIndex && !isSelected && 'bg-gray-7',
                            )}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectOption(option.value)}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        ) : null;

    return (
        <div ref={triggerRef} onKeyDown={handleKeyDown} className="relative w-full">
            <button
                type="button"
                role="combobox"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                aria-activedescendant={open && options[activeIndex] ? `${menuId}-${activeIndex}` : undefined}
                aria-disabled={disabled}
                onClick={() => {
                    if (disabled) {
                        onDisabledClick?.();

                        return;
                    }

                    if (open) setOpen(false);
                    else openMenu();
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

            {portalled && typeof document !== 'undefined' ? createPortal(menu, document.body) : menu}
        </div>
    );
}
