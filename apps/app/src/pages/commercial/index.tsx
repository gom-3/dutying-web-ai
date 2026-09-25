import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Check, Sparkles} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '@/features/auth/model/store';
import {CommercialAPI, commercialQueryKeys, type TCommercialPlan, type TCommercialPlanCode} from '@/features/commercial/api';
import PageState from '@/shared/ui/PageState';
import {Button} from '@/shared/ui/primitives/button';

const formatPrice = (price: number) => (price === 0 ? '무료' : `월 ${price.toLocaleString('ko-KR')}원`);
const remaining = (limit: number, used: number) => Math.max(limit - used, 0);

function UsageBar({label, used, limit}: {label: string; used: number; limit: number}) {
    const ratio = limit === 0 ? 0 : Math.min((used / limit) * 100, 100);

    return (
        <div>
            <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-sub-1">{label}</span>
                <span className="text-gray-3">
                    {used} / {limit}회 · {remaining(limit, used)}회 남음
                </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-6">
                <div className="h-full rounded-full bg-main-1 transition-[width]" style={{width: `${ratio}%`}} />
            </div>
        </div>
    );
}

function PlanCard({
    plan,
    current,
    changing,
    onSelect,
}: {
    plan: TCommercialPlan;
    current: boolean;
    changing: boolean;
    onSelect: (planCode: TCommercialPlanCode) => void;
}) {
    return (
        <article
            className={`flex min-h-[310px] flex-col rounded-[24px] border bg-white p-6 shadow-sm ${
                current ? 'border-main-1 ring-2 ring-main-4' : 'border-gray-6'
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-main-1">{plan.planCode}</p>
                    <h2 className="mt-1 text-2xl font-bold text-sub-1">{plan.displayName}</h2>
                </div>
                {current ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-main-light px-3 py-1 text-xs font-semibold text-main-1">
                        <Check className="size-3.5" /> 현재 요금제
                    </span>
                ) : null}
            </div>
            <p className="mt-5 text-xl font-bold text-sub-1">{formatPrice(plan.monthlyPrice)}</p>
            <ul className="text-gray-2 mt-6 space-y-3 text-sm">
                <li>근무자 {plan.includedStaff}명 포함</li>
                <li>AI 전체 생성 월 {plan.fullGenerateLimit}회</li>
                <li>AI 부분 조정 월 {plan.partialAdjustLimit}회</li>
            </ul>
            <Button type="button" className="mt-auto w-full" disabled={current || changing} onClick={() => onSelect(plan.planCode)}>
                {current ? '사용 중' : changing ? '변경 중…' : '개발 환경에서 적용'}
            </Button>
        </article>
    );
}

export default function CommercialPage() {
    const wardId = useAuthStore((state) => state.wardId);
    const queryClient = useQueryClient();
    const plansQuery = useQuery({
        queryKey: commercialQueryKeys.plans,
        queryFn: CommercialAPI.getPlans,
        retry: false,
    });
    const usageQuery = useQuery({
        queryKey: commercialQueryKeys.usage(wardId ?? 0),
        queryFn: () => CommercialAPI.getWardUsage(wardId!),
        enabled: wardId !== null,
        retry: false,
    });
    const planMutation = useMutation({
        mutationFn: (planCode: TCommercialPlanCode) => CommercialAPI.applyDevelopmentPlan(wardId!, planCode),
        onSuccess: (usage) => {
            queryClient.setQueryData(commercialQueryKeys.usage(usage.scopeRef), usage);
            toast.success(`${usage.planCode} 요금제가 적용됐습니다.`);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : '요금제를 변경하지 못했습니다.'),
    });

    if (wardId === null) {
        return <PageState tone="empty" title="병동을 먼저 선택해 주세요" description="요금제는 병동 단위로 관리됩니다." />;
    }

    if (plansQuery.isPending || usageQuery.isPending) {
        return <PageState tone="loading" title="요금제를 불러오고 있어요" description="잠시만 기다려 주세요." />;
    }

    if (plansQuery.isError || usageQuery.isError || !usageQuery.data) {
        return (
            <PageState
                tone="error"
                title="요금제 정보를 불러오지 못했어요"
                description="잠시 후 다시 시도해 주세요."
                action={{
                    label: '다시 시도',
                    onClick: () => void Promise.all([plansQuery.refetch(), usageQuery.refetch()]),
                }}
            />
        );
    }

    const usage = usageQuery.data;

    return (
        <main className="min-h-full bg-gray-7 px-6 py-8 lg:px-10">
            <div className="mx-auto max-w-[1120px]">
                <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-main-light text-main-1">
                        <Sparkles className="size-6" />
                    </span>
                    <div>
                        <h1 className="text-2xl font-bold text-sub-1">요금제 및 AI 사용량</h1>
                        <p className="mt-1 text-sm text-gray-3">현재 병동의 월별 AI 사용량과 제공 한도를 확인할 수 있어요.</p>
                    </div>
                </div>

                <section className="mt-8 rounded-[24px] bg-white p-6 shadow-sm">
                    <div className="mb-6 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm text-gray-3">현재 요금제</p>
                            <p className="mt-1 text-xl font-bold text-sub-1">{usage.planCode}</p>
                        </div>
                        <p className="text-sm text-gray-3">기준 월 {usage.usageMonth}</p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                        <UsageBar label="AI 전체 생성" used={usage.fullGenerateUsed} limit={usage.fullGenerateLimit} />
                        <UsageBar label="AI 부분 조정" used={usage.partialAdjustUsed} limit={usage.partialAdjustLimit} />
                    </div>
                </section>

                <section className="mt-8">
                    <div className="grid gap-5 md:grid-cols-3">
                        {plansQuery.data.map((plan) => (
                            <PlanCard
                                key={plan.planCode}
                                plan={plan}
                                current={plan.planCode === usage.planCode}
                                changing={planMutation.isPending}
                                onSelect={(planCode) => planMutation.mutate(planCode)}
                            />
                        ))}
                    </div>
                    <p className="mt-4 text-xs text-gray-3">
                        현재 요금제 변경은 개발 환경 검증용입니다. 실제 결제·자동 갱신·환불 기능은 아직 제공하지 않습니다.
                    </p>
                </section>
            </div>
        </main>
    );
}
