import {useCallback, useMemo, useState} from 'react';

export type TCreateAccountStatus = 'idle' | 'loading' | 'success' | 'failure' | 'exception';

export type TCreateAccountProfileDTO = {
    name: string;
    phoneNum: string;
    profileImg: {
        profileImgUrl?: string;
        defaultProfileImgId?: number;
    };
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
const FEEDBACK_BY_STATUS: Record<Exclude<TCreateAccountStatus, 'idle'>, TCreateAccountFeedback> = {
    loading: {
        tone: 'neutral',
        message: '계정 정보를 저장하고 있어요.',
    },
    success: {
        tone: 'neutral',
        message: '계정 정보를 저장했어요.',
    },
    failure: {
        tone: 'error',
        message: null,
    },
    exception: {
        tone: 'error',
        message: '계정 생성 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
    },
};

function isHandledFailure(error: unknown, customIsHandledError?: (error: unknown) => boolean) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as {code?: number}).code : undefined;

    return code === 400 || code === 401 || code === 404 || Boolean(customIsHandledError?.(error));
}

const useCreateAccount = ({submit, isHandledError, shouldRethrowError = true}: TUseCreateAccountParams) => {
    const [createAccountStatus, setCreateAccountStatus] = useState<TCreateAccountStatus>('idle');
    const createAccountFeedback = useMemo(() => {
        if (createAccountStatus === 'idle') {
            return DEFAULT_FEEDBACK;
        }

        return FEEDBACK_BY_STATUS[createAccountStatus];
    }, [createAccountStatus]);
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
