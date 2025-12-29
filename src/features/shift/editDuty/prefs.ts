const KEY = 'duty-editor:prefs';

type Prefs = {
    shiftTeamId?: number | null;
};

function load(): Prefs {
    try {
        const raw = window.localStorage.getItem(KEY);

        if (!raw) return {};

        return JSON.parse(raw) as Prefs;
    } catch {
        return {};
    }
}

function save(prefs: Prefs) {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
}

export function getPreferredShiftTeamId(): number | null {
    const prefs = load();

    return typeof prefs.shiftTeamId === 'number' ? prefs.shiftTeamId : null;
}

export function setPreferredShiftTeamId(shiftTeamId: number) {
    const prefs = load();

    save({...prefs, shiftTeamId});
}
