import {useCallback, useMemo, useState} from 'react';
import type {TPreferredLanguage, TServiceRegion} from '@dutying/domain';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

export type TCreateAccountStatus = 'idle' | 'loading' | 'success' | 'failure' | 'exception';

export type TCreateAccountProfileDTO = {
    name: string;
    phoneNum: string;
    profileImg: {
        profileImgUrl?: string;
        defaultProfileImgId?: number;
    };
    preferredLanguage?: TPreferredLanguage;
    serviceRegion?: TServiceRegion;
};

type TCreateAccountFeedback = {
    tone: 'neutral' | 'error';
    message: string | null;
};

type TUseCreateAccountParams = {
    submit: (createAccountProfileDTO: TCreateAccountProfileDTO) => Promise<unknown>;
    isHandledError?: (error: unknown) => boolean;
    shouldRethrowError?: boolean;
};

const DEFAULT_FEEDBACK: TCreateAccountFeedback = {
    tone: 'neutral',
    message: null,
};
function isHandledFailure(error: unknown, customIsHandledError?: (error: unknown) => boolean) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as {code?: number}).code : undefined;

    return code === 400 || code === 401 || code === 404 || Boolean(customIsHandledError?.(error));
}

const useCreateAccount = ({submit, isHandledError, shouldRethrowError = true}: TUseCreateAccountParams) => {
    const {t} = useTypedTranslation();
    const [createAccountStatus, setCreateAccountStatus] = useState<TCreateAccountStatus>('idle');
    const createAccountFeedback = useMemo(() => {
        if (createAccountStatus === 'idle') {
            return DEFAULT_FEEDBACK;
        }

        if (createAccountStatus === 'loading') {
            return {
                tone: 'neutral',
                message: t('feature.account.create.loading'),
            } satisfies TCreateAccountFeedback;
        }

        if (createAccountStatus === 'success') {
            return {
                tone: 'neutral',
                message: t('feature.account.create.success'),
            } satisfies TCreateAccountFeedback;
        }

        if (createAccountStatus === 'exception') {
            return {
                tone: 'error',
                message: t('feature.account.create.exception'),
            } satisfies TCreateAccountFeedback;
        }

        return {
            tone: 'error',
            message: null,
        } satisfies TCreateAccountFeedback;
    }, [createAccountStatus, t]);
    const resetCreateAccountStatus = useCallback(() => {
        setCreateAccountStatus((currentStatus) => (currentStatus === 'idle' || currentStatus === 'loading' ? currentStatus : 'idle'));
    }, []);
    const handleCreateAccountValidationFailure = useCallback(() => {
        setCreateAccountStatus('idle');
    }, []);
    const handleCreateAccount = useCallback(
        async (createAccountProfileDTO: TCreateAccountProfileDTO) => {
            setCreateAccountStatus('loading');

            try {
                await submit(createAccountProfileDTO);
                setCreateAccountStatus('success');
            } catch (error) {
                setCreateAccountStatus(isHandledFailure(error, isHandledError) ? 'failure' : 'exception');

                if (shouldRethrowError) {
                    throw error;
                }
            }
        },
        [isHandledError, shouldRethrowError, submit],
    );

    return {
        createAccountStatus,
        createAccountFeedback,
        isSubmitting: createAccountStatus === 'loading',
        handleCreateAccount,
        handleCreateAccountValidationFailure,
        resetCreateAccountStatus,
    };
};

export default useCreateAccount;
