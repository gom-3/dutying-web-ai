import {cn} from '@dutying/utils/style';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {Hospital} from 'lucide-react';
import {useEffect, useState} from 'react';
import toast from 'react-hot-toast';
import {wardQueryKeys, wardQueryOptions} from '@/entities/ward';
import useAuth from '@/features/auth';
import WardAdminsPage from '@/pages/ward-admins';
import {WardAPI} from '@/shared/api';
import Card from '@/shared/ui/Card';
import PageState from '@/shared/ui/PageState';
import {Button} from '@/shared/ui/primitives/button';
import {showActionErrorFeedback} from '@/shared/util/feedback';

type TWardInfoField = 'hospitalName' | 'name';
type TWardInfoForm = Record<TWardInfoField, string>;
type TWardInfoErrors = Partial<Record<TWardInfoField, string>>;
type TWardInfoTouched = Partial<Record<TWardInfoField, boolean>>;

const WARD_NAME_MAX_LENGTH = 20;
const WARD_NAME_ALLOWED_REGEXP = /^[A-Za-zㄱ-ㅎㅏ-ㅣ가-힣0-9\s]+$/u;
const WARD_NAME_INPUT_SANITIZE_REGEXP = /[^A-Za-zㄱ-ㅎㅏ-ㅣ가-힣0-9\s]/gu;
const FIELD_CLASS =
    'h-11 w-full rounded-[12px] border border-transparent bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';

const sanitizeWardNameInput = (rawValue: string) =>
    rawValue.replace(WARD_NAME_INPUT_SANITIZE_REGEXP, '').slice(0, WARD_NAME_MAX_LENGTH);
const getFieldLabel = (field: TWardInfoField) => (field === 'hospitalName' ? '병원명' : '병동명');
const validateWardName = (field: TWardInfoField, value: string) => {
    const label = getFieldLabel(field);
    const trimmed = value.trim();

    if (!trimmed) return `${label}을 입력해 주세요.`;

    if (trimmed.length > WARD_NAME_MAX_LENGTH || !WARD_NAME_ALLOWED_REGEXP.test(trimmed)) {
        return `${label}은 20자 이하, 한글/영문/숫자만 입력할 수 있어요.`;
    }

    return undefined;
};

function WardInfoSettingsPage() {
    const {
        state: {wardId},
    } = useAuth();
    const queryClient = useQueryClient();
    const wardQuery = useQuery({
        ...wardQueryOptions.id(wardId ?? 0),
        enabled: Boolean(wardId),
    });
    const ward = wardQuery.data;
    const [draft, setDraft] = useState<TWardInfoForm>({hospitalName: '', name: ''});
    const [fieldErrors, setFieldErrors] = useState<TWardInfoErrors>({});
    const [fieldTouched, setFieldTouched] = useState<TWardInfoTouched>({});
    const [isSaving, setIsSaving] = useState(false);
    const originalDraft: TWardInfoForm = {
        hospitalName: ward?.hospitalName ?? '',
        name: ward?.name ?? '',
    };
    const isDirty =
        draft.hospitalName.trim() !== originalDraft.hospitalName.trim() || draft.name.trim() !== originalDraft.name.trim();
    const isSaveDisabled = isSaving || !isDirty;
    const setFieldError = (field: TWardInfoField, value: string) => {
        const message = validateWardName(field, value);

        setFieldErrors((prev) => ({...prev, [field]: message}));

        return message;
    };
    const handleChange = (field: TWardInfoField, value: string) => {
        const nextValue = sanitizeWardNameInput(value);

        setDraft((prev) => ({...prev, [field]: nextValue}));

        if (fieldTouched[field]) setFieldError(field, nextValue);
    };
    const validateForm = () => {
        const nextErrors: TWardInfoErrors = {
            hospitalName: validateWardName('hospitalName', draft.hospitalName),
            name: validateWardName('name', draft.name),
        };

        setFieldErrors(nextErrors);
        setFieldTouched({hospitalName: true, name: true});

        return !nextErrors.hospitalName && !nextErrors.name;
    };
    const save = async () => {
        if (!wardId) return;
        if (!validateForm()) return;

        try {
            setIsSaving(true);

            const nextWard = await WardAPI.editWard(wardId, {
                hospitalName: draft.hospitalName.trim(),
                name: draft.name.trim(),
            });

            setDraft({
                hospitalName: nextWard.hospitalName ?? draft.hospitalName.trim(),
                name: nextWard.name ?? draft.name.trim(),
            });
            queryClient.setQueryData(wardQueryKeys.id(wardId), nextWard);
            await queryClient.invalidateQueries({queryKey: wardQueryKeys.id(wardId)});
            toast.success('병동 정보를 저장했어요.');
        } catch (error) {
            showActionErrorFeedback(error, '병동 정보를 저장하지 못했어요.');
        } finally {
            setIsSaving(false);
        }
    };
    useEffect(() => {
        if (!ward) return;

        setDraft({
            hospitalName: ward.hospitalName ?? '',
            name: ward.name ?? '',
        });
        setFieldErrors({});
        setFieldTouched({});
    }, [ward]);

    if (!wardId) {
        return (
            <div className="mx-auto flex h-full w-full max-w-306 items-center justify-center px-8">
                <PageState
                    tone="empty"
                    title="병동 연결이 필요해요"
                    description="병동에 입장하거나 새 병동을 만든 뒤 병동 설정을 수정할 수 있어요."
                    className="py-0"
                />
            </div>
        );
    }

    if (wardQuery.isPending) {
        return (
            <div className="mx-auto flex h-full w-full max-w-306 items-center justify-center px-8">
                <PageState tone="loading" title="병동 정보를 불러오고 있어요" className="py-0" />
            </div>
        );
    }

    if (wardQuery.isError || !ward) {
        return (
            <div className="mx-auto flex h-full w-full max-w-306 items-center justify-center px-8">
                <PageState
                    tone="error"
                    title="병동 정보를 불러오지 못했어요"
                    description="잠시 후 다시 시도해 주세요."
                    action={{label: '다시 시도', onClick: () => void wardQuery.refetch()}}
                    className="py-0"
                />
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-[560px] px-4 py-8 md:px-0">
            <div className="mx-auto flex max-w-[480px] items-start justify-between gap-4">
                <div>
                    <h1 className="font-apple text-[32px] font-semibold tracking-normal text-sub-1">병동 설정</h1>
                </div>
            </div>

            <div className="mx-auto mt-6 max-w-[480px] space-y-4">
                <Card className="rounded-[24px] border-transparent p-6">
                    <div className="mb-5 flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-main-light text-main-1">
                            <Hospital className="h-5 w-5" />
                        </span>
                        <h2 className="text-lg font-semibold text-sub-1">병동 정보</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <div className="max-w-[440px]">
                            <label htmlFor="hospitalName" className="mb-1.5 block font-apple text-sm font-medium text-sub-2">
                                병원명
                            </label>
                            <input
                                id="hospitalName"
                                className={cn(
                                    FIELD_CLASS,
                                    fieldErrors.hospitalName && 'border-red bg-[#FFF7F8] focus-visible:bg-white',
                                )}
                                maxLength={WARD_NAME_MAX_LENGTH}
                                placeholder="병원명을 입력하세요"
                                value={draft.hospitalName}
                                onChange={(event) => handleChange('hospitalName', event.target.value)}
                                onBlur={(event) => {
                                    setFieldTouched((prev) => ({...prev, hospitalName: true}));
                                    setFieldError('hospitalName', event.target.value);
                                }}
                                aria-invalid={Boolean(fieldErrors.hospitalName)}
                                aria-describedby={fieldErrors.hospitalName ? 'ward-hospital-name-error' : undefined}
                            />
                            {fieldErrors.hospitalName ? (
                                <p id="ward-hospital-name-error" className="mt-1 font-apple text-xs text-red">
                                    {fieldErrors.hospitalName}
                                </p>
                            ) : null}
                        </div>
                        <div className="max-w-[440px]">
                            <label htmlFor="wardName" className="mb-1.5 block font-apple text-sm font-medium text-sub-2">
                                병동명
                            </label>
                            <input
                                id="wardName"
                                className={cn(FIELD_CLASS, fieldErrors.name && 'border-red bg-[#FFF7F8] focus-visible:bg-white')}
                                maxLength={WARD_NAME_MAX_LENGTH}
                                placeholder="병동명을 입력하세요"
                                value={draft.name}
                                onChange={(event) => handleChange('name', event.target.value)}
                                onBlur={(event) => {
                                    setFieldTouched((prev) => ({...prev, name: true}));
                                    setFieldError('name', event.target.value);
                                }}
                                aria-invalid={Boolean(fieldErrors.name)}
                                aria-describedby={fieldErrors.name ? 'ward-name-error' : undefined}
                            />
                            {fieldErrors.name ? (
                                <p id="ward-name-error" className="mt-1 font-apple text-xs text-red">
                                    {fieldErrors.name}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </Card>
            </div>

            <div className="mx-auto mt-6 max-w-[480px]">
                <WardAdminsPage />
            </div>

            <div className="sticky bottom-3 mx-auto mt-4 flex max-w-[480px] items-center justify-end py-2">
                <Button type="button" onClick={() => void save()} disabled={isSaveDisabled} className="h-11 rounded-[12px] px-5 text-sm">
                    {isSaving ? '저장 중...' : '변경사항 저장'}
                </Button>
            </div>
        </div>
    );
}

export default WardInfoSettingsPage;
