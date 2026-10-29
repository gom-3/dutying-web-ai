import {useId} from 'react';
import {usePersonalRestText} from '@/features/personal-rest-policy';
import {isRestShiftOption, type TNurseShiftTypeOption} from '../model/nurse-shift-types';
import './rest-allocation-settings.css';

export function RestAllocationSettings({
    options,
    disabled,
    onChange,
}: {
    options: TNurseShiftTypeOption[];
    disabled: boolean;
    onChange: (apiShiftTypeId: number, isPossible: boolean) => void;
}) {
    const text = usePersonalRestText();
    const descriptionId = useId();
    const restOptions = options.filter(isRestShiftOption);

    if (restOptions.length === 0) return null;

    return (
        <details className="rest-allocation">
            <summary className="rest-allocation__summary">
                <span className="rest-allocation__heading">
                    <span>{text.allocationTitle}</span>
                    <span className="rest-allocation__chevron" aria-hidden="true" />
                </span>
                <span className="rest-allocation__overview">
                    {restOptions.map((type) => (
                        <span key={type.apiShiftTypeId}>
                            {type.name}: {type.isPossible ? text.allowed : text.blocked}
                        </span>
                    ))}
                </span>
            </summary>
            <div className="rest-allocation__body">
                <p id={descriptionId} className="rest-allocation__intro">
                    {text.allocationHint}
                </p>
                <ul className="rest-allocation__options">
                    {restOptions.map((type) => {
                        const hintId = `${descriptionId}-${type.apiShiftTypeId}`;
                        const hint =
                            type.classification === 'ANNUAL_LEAVE'
                                ? text.annualHint
                                : type.classification === 'OFF'
                                  ? text.offHint
                                  : text.otherHint;

                        return (
                            <li key={type.apiShiftTypeId}>
                                <label className="rest-allocation__option" data-disabled={disabled}>
                                    <span className="rest-allocation__option-copy">
                                        <span className="rest-allocation__name">{type.name}</span>
                                        <span id={hintId} className="rest-allocation__hint">
                                            {hint}
                                        </span>
                                    </span>
                                    <input
                                        className="rest-allocation__input"
                                        type="checkbox"
                                        role="switch"
                                        aria-label={`${type.name} ${text.automatic}`}
                                        aria-checked={type.isPossible}
                                        aria-describedby={`${descriptionId} ${hintId}`}
                                        checked={type.isPossible}
                                        disabled={disabled}
                                        onChange={(event) => onChange(type.apiShiftTypeId, event.target.checked)}
                                    />
                                    <span className="rest-allocation__control" aria-hidden="true">
                                        <span className="rest-allocation__track" />
                                        <span>{type.isPossible ? text.automaticAllowed : text.automaticBlocked}</span>
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                </ul>
                <div className="rest-allocation__note">
                    <p>{text.preserveAssignments}</p>
                    <p className="rest-allocation__save-hint">{text.saveNurseHint}</p>
                </div>
            </div>
        </details>
    );
}
