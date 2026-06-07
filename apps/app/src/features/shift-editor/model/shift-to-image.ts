import {toBlob} from 'html-to-image';

type TBuildShiftImageFileNameOptions = {
    year: number;
    month: number;
    teamName?: string | null;
};

type TShiftToImageOptions = TBuildShiftImageFileNameOptions & {
    element: HTMLElement;
    hospitalName?: string | null;
    wardName?: string | null;
};

const A4_LANDSCAPE_WIDTH = 3508;
const A4_LANDSCAPE_HEIGHT = 2480;
const A4_PAGE_MARGIN_X = 172;
const A4_PAGE_MARGIN_BOTTOM = 140;
const A4_TITLE_TOP = 132;
const A4_TITLE_MAX_FONT_SIZE = 68;
const A4_TITLE_MIN_FONT_SIZE = 42;
const A4_SCHEDULE_TOP = 252;
const A4_PAGE_BACKGROUND_COLOR = '#FFFFFF';
const WATERMARK_LOGO_SRC = '/img/group-19.png';

function sanitizeFileNameSegment(value: string) {
    return value
        .replace(/[\\/:*?"<>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeTitleSegment(value?: string | null) {
    return value?.replace(/\s+/g, ' ').trim() ?? '';
}

export function buildShiftImageFileName({year, month, teamName}: TBuildShiftImageFileNameOptions) {
    const safeTeamName = teamName ? sanitizeFileNameSegment(teamName) : '';
    const baseName = `${year}년 ${month}월 근무표`;

    return safeTeamName ? `${safeTeamName} ${baseName}.png` : `${baseName}.png`;
}

export function buildShiftImageTitle({
    year,
    month,
    hospitalName,
    wardName,
}: Pick<TShiftToImageOptions, 'year' | 'month' | 'hospitalName' | 'wardName'>) {
    const wardLabel = [normalizeTitleSegment(hospitalName), normalizeTitleSegment(wardName)].filter(Boolean).join(' ');

    return `${year}년 ${month}월${wardLabel ? ` ${wardLabel}` : ''} 근무표`;
}

export function downloadBlobAsFile(blob: Blob, fileName: string) {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();

    window.URL.revokeObjectURL(url);
}

function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('SHIFT_IMAGE_EXPORT_IMAGE_LOAD_FAILED'));
        image.src = src;
    });
}

async function loadBlobImage(blob: Blob) {
    const url = window.URL.createObjectURL(blob);

    try {
        return await loadImage(url);
    } finally {
        window.URL.revokeObjectURL(url);
    }
}

function canvasToBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('SHIFT_IMAGE_EXPORT_FAILED'));

                return;
            }

            resolve(blob);
        }, 'image/png');
    });
}

function applyTitleFont(context: CanvasRenderingContext2D, fontSize: number) {
    context.font = `700 ${fontSize}px "Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif`;
}

function drawTitle(context: CanvasRenderingContext2D, title: string) {
    const maxWidth = A4_LANDSCAPE_WIDTH - A4_PAGE_MARGIN_X * 2;

    let fontSize = A4_TITLE_MAX_FONT_SIZE;

    applyTitleFont(context, fontSize);

    while (fontSize > A4_TITLE_MIN_FONT_SIZE && context.measureText(title).width > maxWidth) {
        fontSize -= 2;
        applyTitleFont(context, fontSize);
    }

    context.fillStyle = '#17142F';
    context.textBaseline = 'top';
    context.fillText(title, A4_PAGE_MARGIN_X, A4_TITLE_TOP, maxWidth);
}

function drawScheduleImage(context: CanvasRenderingContext2D, image: HTMLImageElement) {
    const maxWidth = A4_LANDSCAPE_WIDTH - A4_PAGE_MARGIN_X * 2;
    const maxHeight = A4_LANDSCAPE_HEIGHT - A4_SCHEDULE_TOP - A4_PAGE_MARGIN_BOTTOM;
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight, 1);
    const width = Math.round(imageWidth * scale);
    const height = Math.round(imageHeight * scale);
    const x = Math.round((A4_LANDSCAPE_WIDTH - width) / 2);

    context.drawImage(image, x, A4_SCHEDULE_TOP, width, height);
}

function drawWatermark(context: CanvasRenderingContext2D, image: HTMLImageElement) {
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const aspectRatio = imageWidth / imageHeight;
    const width = Math.round(Math.min(A4_LANDSCAPE_WIDTH * 0.58, A4_LANDSCAPE_WIDTH - A4_PAGE_MARGIN_X * 2));
    const height = Math.round(width / aspectRatio);
    const x = Math.round((A4_LANDSCAPE_WIDTH - width) / 2);
    const y = Math.round(A4_SCHEDULE_TOP + (A4_LANDSCAPE_HEIGHT - A4_SCHEDULE_TOP - A4_PAGE_MARGIN_BOTTOM - height) / 2);

    context.save();
    context.globalAlpha = 0.055;
    context.filter = 'blur(7px)';
    context.drawImage(image, x, y, width, height);
    context.restore();
}

async function createA4ShiftImageBlob({sourceBlob, title}: {sourceBlob: Blob; title: string}) {
    const [scheduleImage, watermarkImage] = await Promise.all([loadBlobImage(sourceBlob), loadImage(WATERMARK_LOGO_SRC).catch(() => null)]);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('SHIFT_IMAGE_EXPORT_FAILED');
    }

    canvas.width = A4_LANDSCAPE_WIDTH;
    canvas.height = A4_LANDSCAPE_HEIGHT;

    context.fillStyle = A4_PAGE_BACKGROUND_COLOR;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    drawScheduleImage(context, scheduleImage);

    if (watermarkImage) {
        drawWatermark(context, watermarkImage);
    }

    drawTitle(context, title);

    return canvasToBlob(canvas);
}

export async function shiftToImage({element, year, month, teamName, hospitalName, wardName}: TShiftToImageOptions) {
    const blob = await toBlob(element, {
        backgroundColor: A4_PAGE_BACKGROUND_COLOR,
        cacheBust: true,
        pixelRatio: 2,
        width: Math.max(element.scrollWidth, element.clientWidth),
        height: Math.max(element.scrollHeight, element.clientHeight),
    });

    if (!blob) {
        throw new Error('SHIFT_IMAGE_EXPORT_FAILED');
    }

    const fileName = buildShiftImageFileName({year, month, teamName});
    const a4Blob = await createA4ShiftImageBlob({
        sourceBlob: blob,
        title: buildShiftImageTitle({year, month, hospitalName, wardName}),
    });

    downloadBlobAsFile(a4Blob, fileName);

    return fileName;
}
