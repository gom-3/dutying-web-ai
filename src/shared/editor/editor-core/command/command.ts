import type {CommandContext, CommandResult} from './types';

export abstract class Command<Doc, Sel, Op, Args extends unknown[] = []> {
    abstract run(ctx: CommandContext<Doc, Sel>, ...args: Args): CommandResult<Op>;

    dispose(): void {
        // 기본 no-op
    }
}
