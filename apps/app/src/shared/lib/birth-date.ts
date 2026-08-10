export const BIRTH_DATE_MIN = '1900-01-01';

const LOCAL_DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const BIRTH_DATE_DIGIT_LENGTH = 8;
const pad2 = (value: number) => value.toString().padStart(2, '0');
const getDateKeyFromDate = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const getTodayDateKey = () => getDateKeyFromDate(new Date());

export const normalizeBirthDateForStorage = (value: string | null | undefined) => {
    const trimmed = value?.trim() ?? '';

    return trimmed.length > 0 ? trimmed : null;
};

export const isValidBirthDate = (value: string | null | undefined, maxDate: string) => {
    const birthDate = normalizeBirthDateForStorage(value);

    if (!birthDate) return true;

    if (!LOCAL_DATE_KEY_PATTERN.test(birthDate)) return false;

    if (birthDate < BIRTH_DATE_MIN || birthDate > maxDate) return false;

    const parsedDate = new Date(`${birthDate}T00:00:00`);

    return !Number.isNaN(parsedDate.getTime()) && birthDate === getDateKeyFromDate(parsedDate);
};

export const formatBirthDateInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, BIRTH_DATE_DIGIT_LENGTH);

    if (digits.length <= 4) return digits;

    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;

    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
};
