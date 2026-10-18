/** A report action lives in memory only; neither its note nor its key is analytics metadata. */
export class ScheduleReportAttempt {
    private pending?: {scope: string; note: string; key: string};

    constructor(private readonly newKey: () => string = () => crypto.randomUUID()) {}

    keyFor(scope: string, note: string): string {
        const normalized = note.trim();

        if (this.pending?.scope !== scope || this.pending.note !== normalized) {
            this.pending = {scope, note: normalized, key: this.newKey()};
        }

        return this.pending.key;
    }

    noteChanged(note: string) {
        if (this.pending && this.pending.note !== note.trim()) this.reset();
    }

    reset() {
        this.pending = undefined;
    }
}
