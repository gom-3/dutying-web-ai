import * as yup from 'yup';
import {HOSPITAL_NAME_MAX_LENGTH, isValidWardIdentityName, WARD_NAME_MAX_LENGTH} from '@/shared/lib/ward-name';

export const registerWardSchema = yup.object().shape({
    name: yup
        .string()
        .transform((value) => value?.trim() ?? '')
        .required()
        .test('ward-name', (value) => isValidWardIdentityName(value ?? '', WARD_NAME_MAX_LENGTH)),
    hospitalName: yup
        .string()
        .transform((value) => value?.trim() ?? '')
        .required()
        .test('hospital-name', (value) => isValidWardIdentityName(value ?? '', HOSPITAL_NAME_MAX_LENGTH)),
});
