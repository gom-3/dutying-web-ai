import {container} from 'tsyringe';
import type {DependencyContainer} from 'tsyringe';
import {EditDutyStore} from './store';

export function createEditDutyContainer(wardIdProvider: () => number | null): DependencyContainer {
    const c = container.createChildContainer();

    c.register(EditDutyStore, {useValue: new EditDutyStore(wardIdProvider)});

    return c;
}
