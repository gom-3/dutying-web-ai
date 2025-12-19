import type React from 'react';
import {useTranslation} from 'react-i18next';
import {type ko} from '../locales/ko';

type Join<K, P> = K extends string | number ? (P extends string | number ? `${K}.${P}` : never) : never;

type Paths<T> = T extends string
    ? never
    : {
          [K in Extract<keyof T, string | number>]: T[K] extends string
              ? `${K & (string | number)}`
              : T[K] extends Record<string, unknown>
                ? Join<K & (string | number), Paths<T[K]>>
                : never;
      }[Extract<keyof T, string | number>];

type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
        ? PathValue<T[K], Rest>
        : never
    : P extends keyof T
      ? T[P]
      : never;

type MessageByKey<K extends I18nKey> = PathValue<typeof ko, K>;

export type I18nKey = Paths<typeof ko> & string;

type ValueType = string | number | React.JSX.Element;

type ValueFormat<Key extends string = string, Rest extends string = string> = `${string}{${Key}}${Rest}`;

type ExtractKeys<T extends string> = T extends ValueFormat<infer K, infer R> ? K | ExtractKeys<R> : never;

type InterpolationValues<T extends string> = [ExtractKeys<T>] extends [never] ? undefined : Record<ExtractKeys<T>, ValueType>;

export function useTypedTranslation() {
    const {t} = useTranslation();

    function typedT<K extends I18nKey>(key: K, values?: InterpolationValues<Extract<MessageByKey<K>, string>>): string {
        return t(key, values) as string;
    }

    return {t: typedT};
}
