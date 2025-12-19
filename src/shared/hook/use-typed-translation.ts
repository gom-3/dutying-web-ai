import type React from 'react';
import {useTranslation} from 'react-i18next';
import {type TLocale} from '../locales/ko';

type FirstDepth = keyof TLocale;

type SecondDepth<F extends FirstDepth> = keyof TLocale[F];

type MessageByKey<K extends I18nKey> = K extends `${infer F}.${infer S}`
    ? F extends keyof TLocale
        ? S extends keyof TLocale[F]
            ? TLocale[F][S]
            : never
        : never
    : never;

export type I18nKey = {
    [F in FirstDepth]: `${F & string}.${SecondDepth<F> & string}`;
}[FirstDepth];

type ValueType = string | number | React.JSX.Element;

type ValueFormat<Key extends string = string, Rest extends string = string> = `${string}{${Key}}${Rest}`;

type ExtractKeys<T extends string> = T extends ValueFormat<infer K, infer R> ? K | ExtractKeys<R> : never;

type InterpolationValues<T extends string> = [ExtractKeys<T>] extends [never] ? undefined : Record<ExtractKeys<T>, ValueType>;

export function useTypedTranslation() {
    const {t} = useTranslation();

    function typedT<K extends I18nKey>(key: K, values?: InterpolationValues<MessageByKey<K>>): string {
        return t(key, values) as string;
    }

    return {t: typedT};
}
