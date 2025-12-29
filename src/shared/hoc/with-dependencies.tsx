import {observer} from 'mobx-react-lite';
import {createContext} from 'react';
import type {DependencyContainer} from 'tsyringe';

type Ctor<T = unknown> = new (...args: unknown[]) => T;

export const DependenciesContext = createContext<Record<string, unknown> | null>(null);

export function withDependencies(ui: React.ReactElement, deps: Ctor[], container: DependencyContainer) {
    const Wrapped = observer(() => {
        const resolved: Record<string, unknown> = {};

        for (const dep of deps) {
            resolved[dep.name] = container.resolve(dep);
        }

        return <DependenciesContext.Provider value={resolved}>{ui}</DependenciesContext.Provider>;
    });

    Wrapped.displayName = `WithDependencies(${ui.type?.toString?.() ?? 'Anonymous'})`;

    return Wrapped;
}
