import {observer} from 'mobx-react-lite';
import {createContext} from 'react';
import {type EditDutyStore} from '@/features/shift/editDuty/model/store';
import {type EditDutyUseCase} from '@/features/shift/editDuty/model/use-case';

interface DutyEditorDependencies {
    store: {
        editDutyStore: EditDutyStore;
    };
    useCase: {
        editDutyUseCase: EditDutyUseCase;
    };
}

export const DutyEditorContext = createContext<DutyEditorDependencies>({} as DutyEditorDependencies);

interface DutyEditorProviderProps extends DutyEditorDependencies {
    children: React.ReactNode;
}

export const DutyEditorProvider = observer(({children, ...deps}: DutyEditorProviderProps) => (
    <DutyEditorContext.Provider value={deps}>{children}</DutyEditorContext.Provider>
));
