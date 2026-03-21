import * as yup from 'yup';

export const registerWardSchema = yup.object().shape({
    name: yup
        .string()
        .required()
        .matches(/^[a-z|A-Z|ㄱ-ㅎ|ㅏ-ㅣ|가-힣|0-9|\s]{1,50}$/),
    hospitalName: yup
        .string()
        .required()
        .matches(/^[a-z|A-Z|ㄱ-ㅎ|ㅏ-ㅣ|가-힣|0-9|\s]{1,50}$/),
});
