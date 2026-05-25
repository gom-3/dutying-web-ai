import * as yup from 'yup';

export const registerWardSchema = yup.object().shape({
    name: yup
        .string()
        .transform((value) => value?.trim() ?? '')
        .required()
        .matches(/^[a-zA-Zㄱ-ㅎㅏ-ㅣ가-힣0-9\s]{1,50}$/),
    hospitalName: yup
        .string()
        .transform((value) => value?.trim() ?? '')
        .required()
        .matches(/^[a-zA-Zㄱ-ㅎㅏ-ㅣ가-힣0-9\s]{1,50}$/),
});
