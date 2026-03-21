import {Upload} from 'lucide-react';
import {useRef} from 'react';
import Card from '@/shared/ui/Card';
import {Button} from '@/shared/ui/primitives/button';
import type {TOnboardingWardDraft} from '../../model';

interface IUploadStepProps {
    draft: TOnboardingWardDraft;
    onUpload: (file: File) => void;
}

function UploadStep({draft, onUpload}: IUploadStepProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-6">
            <Card
                variant="muted"
                padding="none"
                className="flex min-h-[204px] flex-col items-center justify-center px-10 py-[60px]"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                    event.preventDefault();

                    const file = event.dataTransfer.files?.[0];

                    if (file) {
                        onUpload(file);
                    }
                }}
            >
                <p className="font-apple text-[20px] font-medium text-gray-3">근무표 파일을 여기에 드롭하세요</p>
                <input
                    ref={inputRef}
                    data-testid="upload-input"
                    hidden
                    type="file"
                    accept=".xlsx,.xls,.csv,.png,.jpg,.jpeg,.pdf"
                    onChange={(event) => {
                        const file = event.target.files?.[0];

                        if (file) {
                            onUpload(file);
                        }
                    }}
                />
                <Button
                    type="button"
                    variant="outline"
                    className="mt-5 h-10 rounded-[10px] border-gray-4 bg-gray-6 px-4 font-apple text-[20px] font-medium text-gray-3 hover:bg-gray-5"
                    onClick={() => inputRef.current?.click()}
                >
                    파일 업로드
                    <Upload className="h-5 w-5" />
                </Button>
            </Card>
            {draft.uploadedFileName ? (
                <Card variant="success" padding="none" className="rounded-[10px] px-5 py-4 font-apple text-[18px]">
                    업로드됨: {draft.uploadedFileName}
                </Card>
            ) : null}
        </div>
    );
}

export default UploadStep;
