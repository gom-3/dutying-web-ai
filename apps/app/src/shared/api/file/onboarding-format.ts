const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg'];
const EXTENSIONS = ['xlsx', 'xls', ...IMAGE_EXTENSIONS];

export const ONBOARDING_UPLOAD_ACCEPT = EXTENSIONS.map((extension) => `.${extension}`).join(',');
export const getOnboardingUploadExtension = (fileName: string) => /\.([^.]+)$/.exec(fileName)?.[1].toLowerCase() ?? '';
export const isOnboardingImageFile = (fileName: string) => IMAGE_EXTENSIONS.includes(getOnboardingUploadExtension(fileName));
export const isSupportedOnboardingUploadFile = (fileName: string) => EXTENSIONS.includes(getOnboardingUploadExtension(fileName));
