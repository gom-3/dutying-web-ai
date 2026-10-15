// Session-only image cache: no browser storage or server uploads.
const images = new Map<string, Blob>();
let bytes = 0;
let queue = Promise.resolve();
export function readConversationImage(key: string) {
    const blob = images.get(key);
    if (blob) {
        images.delete(key);
        images.set(key, blob);
    }
    return blob;
}
export function saveConversationImage(key: string, blob: Blob) {
    const old = images.get(key);
    if (old) bytes -= old.size;
    images.delete(key);
    if (blob.size > 16 * 1024 * 1024) return;
    images.set(key, blob);
    bytes += blob.size;
    while (images.size > 8 || bytes > 16 * 1024 * 1024) {
        const first = images.keys().next().value!;
        bytes -= images.get(first)!.size;
        images.delete(first);
    }
}
export function queueConversationCapture<T>(job: () => Promise<T>): Promise<T> {
    const result = queue.then(job);
    queue = result.then(
        () => undefined,
        () => undefined,
    );
    return result;
}
