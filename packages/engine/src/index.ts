

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

export class DoIt {
    private state: any;
    private undoStack: HistoryEntry[] = [];
    private redoStack: HistoryEntry[] = [];
    private maxHistory: number;
    private listeners: Array<(state: any, history: any) => void> = [];

    constructor(initialState: any = {}, options: { maxHistory?: number } = {}) {
        this.state = initialState;
        this.maxHistory = options.maxHistory || 100;
    }

    public getState() {
        return this.state;
    }

    public getHistory() {
        return {
            undo: this.undoStack.length,
            redo: this.redoStack.length,
            canUndo: this.undoStack.length > 0,
            canRedo: this.redoStack.length > 0
        };
    }

    public set(path: string, value: any) {
        
        const tokens = parsePath(path);
        const probeResult = probe(this.state, tokens);

        let undoOp: Operation;

        if (probeResult.missingIndex !== -1) {
         
            const missingToken = tokens[probeResult.missingIndex];

            const creationPath = reconstructPath(tokens.slice(0, probeResult.missingIndex + 1));

            undoOp = { op: 'delete', path: creationPath };
        } else {
            
            undoOp = { op: 'set', path: path, value: probeResult.value };
        }

        const redoOp: Operation = { op: 'set', path, value };

        
        applyOperation(this.state, redoOp);

        
        this.undoStack.push({ undo: undoOp, redo: redoOp });
        this.redoStack = []; 

        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }

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
        this.notify();
    }

    public subscribe(fn: (state: any, history: any) => void) {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter(l => l !== fn);
        };
    }

    private notify() {
        const history = this.getHistory();
        this.listeners.forEach(l => l(this.state, history));
    }
}


export function parsePath(path: string): PathToken[] {
    const regex = /([^\.\[\]]+)|\[(\d+)\]|\[(\w+):([^\]]+)\]/g;
    const tokens: PathToken[] = [];
    let match;
    while ((match = regex.exec(path))) {
        if (match[1]) {
            tokens.push({ type: "key", value: match[1] });
        } else if (match[2]) {
            tokens.push({ type: "index", value: Number(match[2]) });
        } else if (match[3]) {
            
            let val: any = match[4];
            if (!isNaN(Number(val))) val = Number(val);
            
            if (typeof val === 'string' && (val.startsWith("'") || val.startsWith('"'))) {
                val = val.slice(1, -1);
            }

            tokens.push({
                type: "filter",
                key: match[3],
                value: val
            });
        }
    }
    return tokens;
}

export function reconstructPath(tokens: PathToken[]): string {
    return tokens.map((t, i) => {
        if (t.type === 'key') return (i > 0 ? '.' : '') + t.value;
        if (t.type === 'index') return `[${t.value}]`;
        if (t.type === 'filter') return `[${t.key}:${t.value}]`;
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
            if (token.value >= current.length) return { exists: false, value: undefined, missingIndex: i };
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
        } else if (lastToken.type === 'index') {
            if (Array.isArray(current)) {
                
                current.splice(lastToken.value, 1);
            }
        } else if (lastToken.type === 'filter') {
            if (Array.isArray(current)) {
                const idx = current.findIndex((item: any) => item[lastToken.key] == lastToken.value);
                if (idx !== -1) current.splice(idx, 1);
            }
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
        } else if (lastToken.type === 'filter') {
            
            if (Array.isArray(current)) {
                let found = current.find((item: any) => item[lastToken.key] == lastToken.value);
                if (!found) {
                    found = { [lastToken.key]: lastToken.value };
                    current.push(found);
                }
                Object.assign(found, operation.value);
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
        if (createIfMissing && current[token.value] === undefined) {
            current[token.value] = {}; 
        }
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
