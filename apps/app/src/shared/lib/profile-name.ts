import {isValidNurseName, NURSE_NAME_MAX_LENGTH} from './nurse-name';

// Account profiles also permit the separators shown in the profile form guidance.
// Keep roster/registration name policies unchanged.
const PROFILE_INPUT_SANITIZE_REGEXP =
    /[^\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF\uAC00-\uD7A3A-Za-z0-9 \u3040-\u309F\u30A0-\u30FF\u3400-\u9FFF\u3005・ー·-]/gu;

export const isValidProfileName = (name: string) => isValidNurseName(name.replace(/[·-]/g, '・'));

export const sanitizeProfileNameInput = (value: string) =>
    value
        .replace(/\u3000/g, ' ')
        .replace(PROFILE_INPUT_SANITIZE_REGEXP, '')
        .slice(0, NURSE_NAME_MAX_LENGTH);
