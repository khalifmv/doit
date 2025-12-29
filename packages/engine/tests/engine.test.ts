
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
});
