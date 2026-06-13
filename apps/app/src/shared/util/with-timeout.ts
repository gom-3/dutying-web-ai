export const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, errorMessage = 'request_timeout') => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            promise,
            new Promise<never>((_resolve, reject) => {
                timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
            }),
        ]);
    } finally {
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }
    }
};
