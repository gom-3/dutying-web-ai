import {observer} from 'mobx-react-lite';
import {useMemo, createContext} from 'react';
import {EditDutyStore} from '@/features/shift/editDuty/model/store';
import {EditDutyUseCase} from '@/features/shift/editDuty/model/use-case';
import {DutyEditorProvider} from '@/widgets/duty-editor/model/provider';
import {MakeShiftFlowStore} from './store';
import {MakeShiftFlowUseCase} from './use-case';

export type MakeShiftDependencies = {
    store: {
        editDutyStore: EditDutyStore;
        flowStore: MakeShiftFlowStore;
    };
    useCase: {
        flowUseCase: MakeShiftFlowUseCase;
    };
};

export const MakeShiftContext = createContext<MakeShiftDependencies>({} as MakeShiftDependencies);

type MakeShiftProviderProps = {
    wardId: number | null;
    children: React.ReactNode;
};

export const MakeShiftProvider = observer(({wardId, children}: MakeShiftProviderProps) => {
    const deps = useMemo(() => {
        const wardIdProvider = () => wardId;
        const editDutyStore = new EditDutyStore(wardIdProvider);
        const editDutyUseCase = new EditDutyUseCase(editDutyStore);
        const flowStore = new MakeShiftFlowStore(editDutyStore);
        const flowUseCase = new MakeShiftFlowUseCase(flowStore, editDutyUseCase);

        return {
            store: {
                editDutyStore,
                flowStore,
            },
            useCase: {
                flowUseCase,
                editDutyUseCase,
            },
        };
    }, [wardId]);

    return (
        <MakeShiftContext.Provider value={deps}>
            <DutyEditorProvider store={{editDutyStore: deps.store.editDutyStore}} useCase={{editDutyUseCase: deps.useCase.editDutyUseCase}}>
                {children}
            </DutyEditorProvider>
        </MakeShiftContext.Provider>
    );
});
