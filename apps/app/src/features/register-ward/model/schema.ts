import * as yup from 'yup';

export const registerWardSchema = yup.object().shape({
    name: yup
        .string()
        .transform((value) => value?.trim() ?? '')
        .required()
        .matches(/^[a-zA-Z0-9\s\u3131-\u318E\uAC00-\uD7A3\u3040-\u30FF\u3400-\u9FFF]{1,50}$/),
    hospitalName: yup
        .string()
        .transform((value) => value?.trim() ?? '')
        .required()
        .matches(/^[a-zA-Z0-9\s\u3131-\u318E\uAC00-\uD7A3\u3040-\u30FF\u3400-\u9FFF]{1,50}$/),
});
