
import { describe, it, expect, beforeEach } from 'vitest';
import { DoIt } from '../src/index';

describe('DoIt', () => {
    let engine: DoIt;

    beforeEach(() => {
        engine = new DoIt({
            user: {}
        });
    });

    it('should undo object creation correctly', () => {
        // profile doesn't exist initially
        expect(engine.getState().user.profile).toBeUndefined();

        // Set profile.active = true
        // This implicitly creates profile
        engine.set('user.profile.active', true);

        expect(engine.getState().user.profile).toBeDefined();
        expect(engine.getState().user.profile.active).toBe(true);

        // Undo
        engine.undo();

        // profile should be gone
        expect(engine.getState().user.profile).toBeUndefined();
    });

    it('should undo array item creation via filter', () => {
        engine = new DoIt({ items: [] });

        // Add item with id:1 and name: 'Apple'
        engine.set('items[id:1].name', 'Apple');

        expect(engine.getState().items.length).toBe(1);
        expect(engine.getState().items[0]).toEqual({ id: 1, name: 'Apple' });

        // Undo
        engine.undo();

        expect(engine.getState().items.length).toBe(0);
    });

    it('should handle standard replace undo', () => {
        engine = new DoIt({ config: { valid: true } });

        engine.set('config.valid', false);
        expect(engine.getState().config.valid).toBe(false);

        engine.undo();
        expect(engine.getState().config.valid).toBe(true);
    });

    it('should not create history entry for duplicate values', () => {
        engine = new DoIt({ count: 5 });
        expect(engine.getHistory().undo).toBe(0);

        engine.set('count', 5);
        expect(engine.getHistory().undo).toBe(0);

        engine.set('count', 10);
        expect(engine.getHistory().undo).toBe(1);

        engine.set('count', 10);
        expect(engine.getHistory().undo).toBe(1);
    });

    it('should persist state to storage', () => {
        const mockStorage: Record<string, string> = {};
        const storage = {
            getItem: (key: string) => mockStorage[key] || null,
            setItem: (key: string, value: string) => { mockStorage[key] = value; },
            removeItem: (key: string) => { delete mockStorage[key]; }
        };

        engine = new DoIt({ count: 0 });
        engine.persist({ to: storage });

        engine.set('count', 5);
        expect(mockStorage['doit-state']).toBeDefined();

        const saved = JSON.parse(mockStorage['doit-state']);
        expect(saved.state.count).toBe(5);
        expect(saved.undoStack.length).toBe(1);
    });

    it('should restore state from storage', () => {
        const mockStorage: Record<string, string> = {};
        const storage = {
            getItem: (key: string) => mockStorage[key] || null,
            setItem: (key: string, value: string) => { mockStorage[key] = value; },
            removeItem: (key: string) => { delete mockStorage[key]; }
        };

        mockStorage['doit-state'] = JSON.stringify({
            state: { count: 42 },
            undoStack: [{ undo: { op: 'set', path: 'count', value: 0 }, redo: { op: 'set', path: 'count', value: 42 } }],
            redoStack: []
        });

        engine = new DoIt({ count: 0 });
        engine.persist({ to: storage });

        expect(engine.getState().count).toBe(42);
        expect(engine.getHistory().undo).toBe(1);
    });

    it('should batch multiple operations into single history entry', () => {
        engine = new DoIt({ user: { name: '', age: 0, city: '' } });
        expect(engine.getHistory().undo).toBe(0);

        engine.batch((b) => {
            b.set('user.name', 'Alice');
            b.set('user.age', 25);
            b.set('user.city', 'NYC');
        });

        expect(engine.getState().user).toEqual({ name: 'Alice', age: 25, city: 'NYC' });
        expect(engine.getHistory().undo).toBe(1);
    });

    it('should undo all batch operations at once', () => {
        engine = new DoIt({ count: 0, total: 0 });

        engine.batch((b) => {
            b.set('count', 5);
            b.set('total', 100);
        });

        expect(engine.getState()).toEqual({ count: 5, total: 100 });

        engine.undo();

        expect(engine.getState()).toEqual({ count: 0, total: 0 });
        expect(engine.getHistory().undo).toBe(0);
    });

    it('should redo all batch operations at once', () => {
        engine = new DoIt({ x: 1, y: 2 });

        engine.batch((b) => {
            b.set('x', 10);
            b.set('y', 20);
        });

        engine.undo();
        expect(engine.getState()).toEqual({ x: 1, y: 2 });

        engine.redo();
        expect(engine.getState()).toEqual({ x: 10, y: 20 });
        expect(engine.getHistory().redo).toBe(0);
    });

    it('should skip duplicate values in batch', () => {
        engine = new DoIt({ a: 1, b: 2 });

        engine.batch((b) => {
            b.set('a', 1); // duplicate, should be skipped
            b.set('b', 5); // different, should be applied
        });

        expect(engine.getState()).toEqual({ a: 1, b: 5 });
    });
});
