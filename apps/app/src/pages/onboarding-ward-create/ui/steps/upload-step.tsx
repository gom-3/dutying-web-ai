import {Upload} from 'lucide-react';
import {useRef, useState} from 'react';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/form-controls/Button';
import {Input} from '@/shared/ui/primitives/input';

interface IUploadStepProps {
    onUpload: (file: File, options?: TUploadTargetMonth) => void;
    isUploading: boolean;
    uploadError: string | null;
}

type TUploadTargetMonth = {
    targetYear: number;
    targetMonth: number;
};

const getCurrentMonthValue = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    return `${now.getFullYear()}-${month}`;
};
const parseTargetMonthValue = (value: string): TUploadTargetMonth | undefined => {
    const [year, month] = value.split('-').map(Number);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return undefined;
    }

    return {targetYear: year, targetMonth: month};
};

function UploadStep({onUpload, isUploading, uploadError}: IUploadStepProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [targetMonthValue, setTargetMonthValue] = useState(getCurrentMonthValue);
    const uploadFile = (file: File) => onUpload(file, parseTargetMonthValue(targetMonthValue));

    return (
        <div className="space-y-6">
            <Card
                variant="muted"
                padding="none"
                className="flex min-h-[204px] flex-col items-center justify-center bg-white px-10 py-[60px]"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                    event.preventDefault();

                    const file = event.dataTransfer.files?.[0];

                    if (file) {
                        uploadFile(file);
                    }
                }}
            >
                <label className="mb-5 flex w-full max-w-[360px] flex-col gap-2 font-apple text-[14px] font-medium text-sub-1">
                    근무표 기준 월
                    <Input
                        id="onboarding-upload-target-month"
                        type="month"
                        value={targetMonthValue}
                        disabled={isUploading}
                        variant="foundation"
                        fieldSize="md"
                        className="h-11 rounded-[10px] text-[16px]"
                        onChange={(event) => setTargetMonthValue(event.target.value)}
                    />
                </label>
                <p className="font-apple text-[20px] font-medium text-gray-3">근무표 파일을 여기에 놓아 주세요</p>
                <input
                    ref={inputRef}
                    data-testid="upload-input"
                    hidden
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(event) => {
                        const file = event.target.files?.[0];

                        if (file) {
                            uploadFile(file);
                            event.target.value = '';
                        }
                    }}
                />
                <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="mt-5 h-10 rounded-[10px] px-4 text-[20px] font-medium enabled:cursor-pointer"
                    disabled={isUploading}
                    onClick={() => inputRef.current?.click()}
                >
                    {isUploading ? '파일 해석 중...' : '파일 업로드'}
                    <Upload className="h-5 w-5" />
                </Button>
            </Card>
            {uploadError ? (
                <Card
                    data-testid="upload-error"
                    padding="none"
                    className="rounded-[10px] border border-[#F3C6C6] bg-[#FFF5F5] px-5 py-4 font-apple text-[16px] text-[#7A4F4F]"
                >
                    <p className="text-[18px] font-semibold text-[#C55252]">파일 업로드에 실패했어요</p>
                    <p className="mt-2">{uploadError}</p>
                </Card>
            ) : null}
        </div>
    );
}

export default UploadStep;
