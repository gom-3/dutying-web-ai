import {useContext} from 'react';
import {DependenciesContext} from '../hoc/with-dependencies';

type Token<T> = {name: string; prototype: T};

export function useDependency<T>(token: Token<T>): T {
    const deps = useContext(DependenciesContext);

    if (!deps) throw new Error('DependenciesContext is not provided. Wrap your tree with withDependencies().');

    const resolved = deps[token.name] as T | undefined;

    if (!resolved) throw new Error(`Dependency not found in context: ${token.name}`);

    return resolved;
}
