export type PathToken =
    | { type: 'key'; value: string }
    | { type: 'index'; value: number }
    | { type: 'filter'; key: string; value: any };

export type Operation =
    | { op: 'set'; path: string; value: any }
    | { op: 'delete'; path: string }
    | { op: 'batch'; ops: Operation[] };

interface HistoryEntry {
    undo: Operation;
    redo: Operation;
}

const PATH_REGEX = /([^\.\[\]]+)|\[(\d+)\]|\[(\w+):([^\]]+)\]/g;

interface StorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

interface PersistOptions {
    to: StorageAdapter;
    key?: string;
}

export class DoIt {
    private state: any;
    private undoStack: HistoryEntry[] = [];
    private redoStack: HistoryEntry[] = [];
    private maxHistory: number;
    private listeners: Array<(state: any, history: any) => void> = [];
    private pathCache = new Map<string, PathToken[]>();
    private historyDirty = true;
    private cachedHistory: any;
    private storage?: StorageAdapter;
    private storageKey: string = 'doit-state';

    constructor(initialState: any = {}, options: { maxHistory?: number } = {}) {
        this.state = initialState;
        this.maxHistory = options.maxHistory || 100;
    }

    public getState() {
        return this.state;
    }

    public getHistory() {
        if (!this.historyDirty) return this.cachedHistory;

        this.cachedHistory = {
            undo: this.undoStack.length,
            redo: this.redoStack.length,
            canUndo: this.undoStack.length > 0,
            canRedo: this.redoStack.length > 0
        };
        this.historyDirty = false;
        return this.cachedHistory;
    }

    public set(path: string, value: any, internal = false) {
        const tokens = this.getParsedPath(path);
        const probeResult = probe(this.state, tokens);
        if (probeResult.exists && deepEqual(probeResult.value, value)) return;
        let undoOp: Operation;
        if (probeResult.missingIndex !== -1) {
            const creationPath = reconstructPath(tokens.slice(0, probeResult.missingIndex + 1));
            undoOp = { op: 'delete', path: creationPath };
        } else {
            undoOp = { op: 'set', path: path, value: this.cloneValue(probeResult.value) };
        }
        const redoOp: Operation = { op: 'set', path, value };
        applyOperation(this.state, redoOp);
        if (!internal) {
            this.undoStack.push({ undo: undoOp, redo: redoOp });
            this.redoStack = [];
            if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
            this.notify();
        }
        return { undoOp, redoOp };
    }

    public batch(callback: (batch: { set: (path: string, value: any) => void }) => void) {
        const undoOps: Operation[] = [];
        const redoOps: Operation[] = [];
        const batchContext = {
            set: (path: string, value: any) => {
                const result = this.set(path, value, true);
                if (result) {
                    undoOps.push(result.undoOp);
                    redoOps.push(result.redoOp);
                }
            }
        };
        callback(batchContext);
        if (undoOps.length === 0) return;
        const batchUndo: Operation = { op: 'batch', ops: undoOps.reverse() };
        const batchRedo: Operation = { op: 'batch', ops: redoOps };
        this.undoStack.push({ undo: batchUndo, redo: batchRedo });
        this.redoStack = [];
        if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
        this.notify();
    }


    public undo() {
        if (this.undoStack.length === 0) return false;
        const entry = this.undoStack.pop()!;
        applyOperation(this.state, entry.undo);
        this.redoStack.push(entry);
        this.notify();
        return true;
    }

    public redo() {
        if (this.redoStack.length === 0) return false;
        const entry = this.redoStack.pop()!;
        applyOperation(this.state, entry.redo);
        this.undoStack.push(entry);
        this.notify();
        return true;
    }

    public clearHistory() {
        this.undoStack = [];
        this.redoStack = [];
        this.pathCache.clear();
        this.notify();
    }

    public persist(options: PersistOptions) {
        this.storage = options.to;
        this.storageKey = options.key || 'doit-state';
        this.loadFromStorage();
        return this;
    }

    public unpersist() {
        this.storage = undefined;
    }

    public subscribe(fn: (state: any, history: any) => void) {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter(l => l !== fn);
        };
    }

    private notify() {
        this.historyDirty = true;
        const history = this.getHistory();
        this.listeners.forEach(l => l(this.state, history));
        this.saveToStorage();
    }

    private saveToStorage() {
        if (!this.storage) return;
        try {
            const data = { state: this.state, undoStack: this.undoStack, redoStack: this.redoStack };
            this.storage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save to storage:', e);
        }
    }

    private loadFromStorage() {
        if (!this.storage) return;
        try {
            const raw = this.storage.getItem(this.storageKey);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.state) this.state = data.state;
            if (data.undoStack) this.undoStack = data.undoStack;
            if (data.redoStack) this.redoStack = data.redoStack;
            this.notify();
        } catch (e) {
            console.error('Failed to load from storage:', e);
        }
    }

    private getParsedPath(path: string): PathToken[] {
        let tokens = this.pathCache.get(path);
        if (!tokens) {
            tokens = parsePath(path);
            this.pathCache.set(path, tokens);
            if (this.pathCache.size > 1000) {
                const firstKey = this.pathCache.keys().next().value;
                if (firstKey) this.pathCache.delete(firstKey);
            }
        }
        return tokens;
    }

    private cloneValue(value: any): any {
        if (value === null || value === undefined || typeof value !== 'object') return value;
        if (Array.isArray(value)) return value.map(v => this.cloneValue(v));
        const cloned: any = {};
        for (const key in value) {
            if (value.hasOwnProperty(key)) cloned[key] = this.cloneValue(value[key]);
        }
        return cloned;
    }
}

export function parsePath(path: string): PathToken[] {
    const tokens: PathToken[] = [];
    let match;
    while ((match = PATH_REGEX.exec(path))) {
        if (match[1]) {
            tokens.push({ type: "key", value: match[1] });
        } else if (match[2]) {
            tokens.push({ type: "index", value: Number(match[2]) });
        } else if (match[3]) {
            let val: any = match[4];
            if (!isNaN(Number(val))) {
                val = Number(val);
            } else if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
                val = val.slice(1, -1);
            }
            tokens.push({ type: "filter", key: match[3], value: val });
        }
    }
    return tokens;
}

export function reconstructPath(tokens: PathToken[]): string {
    return tokens.map((t, i) => {
        if (t.type === 'key') return (i > 0 ? '.' : '') + t.value;
        if (t.type === 'index') return `[${t.value}]`;
        if (t.type === 'filter') {
            const val = typeof t.value === 'string' ? `"${t.value}"` : t.value;
            return `[${t.key}:${val}]`;
        }
        return '';
    }).join('');
}

interface ProbeResult {
    exists: boolean;
    value: any;
    missingIndex: number;
}

export function probe(obj: any, tokens: PathToken[]): ProbeResult {
    let current = obj;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (current === undefined || current === null) {
            return { exists: false, value: undefined, missingIndex: i };
        }

        if (token.type === 'key') {
            if (!(token.value in current)) return { exists: false, value: undefined, missingIndex: i };
            current = current[token.value];
        } else if (token.type === 'index') {
            if (!Array.isArray(current)) return { exists: false, value: undefined, missingIndex: i };
            if (token.value < 0 || token.value >= current.length) return { exists: false, value: undefined, missingIndex: i };
            current = current[token.value];
        } else if (token.type === 'filter') {
            if (!Array.isArray(current)) return { exists: false, value: undefined, missingIndex: i };
            const found = current.find((item: any) => item[token.key] == token.value);
            if (!found) return { exists: false, value: undefined, missingIndex: i };
            current = found;
        }
    }

    return { exists: true, value: current, missingIndex: -1 };
}

export function applyOperation(obj: any, operation: Operation) {
    if (operation.op === 'batch') {
        operation.ops.forEach(op => applyOperation(obj, op));
        return;
    }

    const tokens = parsePath(operation.path);
    let current = obj;

    if (operation.op === 'delete') {
        for (let i = 0; i < tokens.length - 1; i++) {
            const token = tokens[i];
            current = resolveNext(current, token, false);
            if (!current) return;
        }

        const lastToken = tokens[tokens.length - 1];
        if (lastToken.type === 'key') {
            delete current[lastToken.value];
        } else if (lastToken.type === 'index' && Array.isArray(current)) {
            current.splice(lastToken.value, 1);
        } else if (lastToken.type === 'filter' && Array.isArray(current)) {
            const idx = current.findIndex((item: any) => item[lastToken.key] == lastToken.value);
            if (idx !== -1) current.splice(idx, 1);
        }
    } else if (operation.op === 'set') {
        for (let i = 0; i < tokens.length - 1; i++) {
            const token = tokens[i];
            current = resolveNext(current, token, true);
        }
        const lastToken = tokens[tokens.length - 1];
        if (lastToken.type === 'key') {
            current[lastToken.value] = operation.value;
        } else if (lastToken.type === 'index') {
            current[lastToken.value] = operation.value;
        } else if (lastToken.type === 'filter' && Array.isArray(current)) {
            let found = current.find((item: any) => item && item[lastToken.key] == lastToken.value);
            if (!found) {
                found = { [lastToken.key]: lastToken.value };
                current.push(found);
            }
            if (typeof operation.value === 'object' && !Array.isArray(operation.value)) {
                Object.assign(found, operation.value);
            } else {
                const idx = current.indexOf(found);
                current[idx] = { ...found, ...operation.value };
            }
        }
    }
}

function resolveNext(current: any, token: PathToken, createIfMissing: boolean): any {
    if (token.type === 'key') {
        if ((current[token.value] === undefined || typeof current[token.value] !== 'object') && createIfMissing) {
            current[token.value] = {};
        }
        return current[token.value];
    }
    if (token.type === 'index') {
        if (createIfMissing && current[token.value] === undefined) current[token.value] = {};
        return current[token.value];
    }
    if (token.type === 'filter') {
        if (!Array.isArray(current)) return undefined;
        let found = current.find((item: any) => item[token.key] == token.value);
        if (!found && createIfMissing) {
            found = { [token.key]: token.value };
            current.push(found);
        }
        return found;
    }
    return undefined;
}

function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
}
