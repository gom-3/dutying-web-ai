// The upload API limits the request body. Keep the original file on the device when it exceeds that limit.
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_OCR_IMAGE_SIDE = 2048;

export async function prepareOnboardingPhoto(file: File, failureMessage: string): Promise<File> {
    if (file.size <= MAX_UPLOAD_BYTES) {
        return file;
    }

    try {
        const image = await createImageBitmap(file);
        try {
            const scale = Math.min(1, MAX_OCR_IMAGE_SIDE / Math.max(image.width, image.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            const context = canvas.getContext('2d', {alpha: false});
            if (!context) {
                throw new Error(failureMessage);
            }
            context.fillStyle = '#fff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94));
            if (!jpeg?.size || jpeg.type !== 'image/jpeg' || jpeg.size > MAX_UPLOAD_BYTES) {
                throw new Error(failureMessage);
            }
            return new File([jpeg], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: jpeg.type,
                lastModified: file.lastModified,
            });
        } finally {
            image.close();
        }
    } catch (error) {
        throw Object.defineProperty(new Error(failureMessage), 'cause', {value: error, writable: true, configurable: true});
    }
}
