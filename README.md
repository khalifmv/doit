<div align="center">
<img src="doit.png" width="100px" style="background-color: #505050ff; padding: 10px; border-radius: 10px;"/>
<p>A lightweight & framework-agnostic, path-based undo-redo state management library for JavaScript/TypeScript applications.</p>
<div style="display: inline-block;">
  <a href="https://www.npmjs.com/package/doit-lib" target="_blank"><img src="https://img.shields.io/badge/npm-CB3837?logo=npm&logoColor=fff" alt="npm"></a>
  <a href="https://github.com/khalifmv/doit-lib/blob/main/LICENSE" target="_blank">
  <img src="https://img.shields.io/npm/l/doit-lib" alt="license">
  <img src="https://img.shields.io/badge/platform-browser-blue" />
  <img alt="gzip size" src="https://img.shields.io/bundlejs/size/doit-lib">

</a>

</div>
</div>

## Concept

`doit-lib` provides a centralized store where every mutation is recorded as an operation (`set`, `delete`). It allows you to modify deeply nested state using a string-based path syntax, automatically generating the corresponding inverse operations for undo capabilities.

Key features:
- **Path-based mutations**: Modify deep state easily (e.g., `users[0].name`).
- **Array Filtering**: Target array items by properties (e.g., `todos[id:123].completed`).
- **Automatic History**: Every `set` generates an undo/redo stack.
- **Framework Agnostic**: Works with Vanilla JS, React, Vue, Svelte, etc.
- **TypeScript Support**: Full type inference and autocompletion.
- **Persistence**: Auto-save to localStorage or sessionStorage.
- **Batch Operations**: Group multiple `set` operations into a single undo/redo entry.

## Installation

```bash
npm install doit-lib
```

## Basic Usage

```typescript
import { DoIt } from 'doit-lib';

// Initialize store
const store = new DoIt({
    user: { name: 'Alice', score: 10 },
    todos: []
});

// Subscribe to changes
store.subscribe((state, history) => {
    console.log('New State:', state);
    console.log('History:', history);
});

// Update state
store.set('user.score', 20); 
store.set('todos[0]', { id: 1, task: 'Buy milk', done: false });

// Undo change
store.undo(); // user.score reverts to 10
```

## Path Syntax

The library uses a powerful path syntax to traverse and modify objects:

- **Dot Notation**: `user.name` targets the `name` property of `user`.
- **Array Index**: `items[0]` targets the first element of `items`.
- **Filter Selector**: `users[id:42]` targets the element in the `users` array where `id` equals `42`.
  - If the item doesn't exist during a `set` operation, it can verify existence or handle it based on logic (currently, it might attempt to create it if implied, or strictly find it). *Note: The current implementation attempts to find existing items.*

## API

### Constructor

```typescript
new DoIt(initialState?, options?)
```

- **initialState** (optional): The initial state object. Default: `{}`
- **options** (optional):
  - `maxHistory`: Maximum number of history entries to keep. Default: `100`

**Example:**
```typescript
const store = new DoIt({ count: 0 }, { maxHistory: 50 });
```

---

### Methods

#### `set(path: string, value: any): void`
Sets a value at the specified path and records the operation in history.

```typescript
store.set('user.name', 'Alice');
store.set('todos[0].completed', true);
store.set('items[id:42].quantity', 10);
```

> **Note:** If the value is identical to the current value (using deep equality), the operation is skipped and no history entry is created.

#### `getState(): any`
Returns the current state object.

```typescript
const currentState = store.getState();
```

#### `getHistory(): HistoryInfo`
Returns information about the undo/redo history.

```typescript
const history = store.getHistory();
// { undo: 5, redo: 2, canUndo: true, canRedo: true }
```

#### `undo(): boolean`
Undoes the last operation. Returns `true` if successful, `false` if there's nothing to undo.

```typescript
const success = store.undo();
```

#### `redo(): boolean`
Redoes the last undone operation. Returns `true` if successful, `false` if there's nothing to redo.

```typescript
const success = store.redo();
```

#### `clearHistory(): void`
Clears all undo/redo history (does not modify the current state).

```typescript
store.clearHistory();
```

#### `subscribe(callback: (state: any, history: any) => void): () => void`
Subscribes to state changes. Returns an unsubscribe function.

```typescript
const unsubscribe = store.subscribe((state, history) => {
    console.log('State changed:', state);
    console.log('Can undo:', history.canUndo);
});

// Later: unsubscribe()
```

#### `batch(callback: (batch) => void): void`
Groups multiple `set` operations into a single history entry. All operations within the batch are undone/redone together.

```typescript
store.batch((b) => {
    b.set('user.name', 'Alice');
    b.set('user.age', 25);
    b.set('user.city', 'NYC');
});

// Only 1 history entry created for all 3 operations
// Undo will revert all 3 changes at once
```

**Use cases:**
- Form submissions with multiple field updates
- Bulk data imports
- Complex state transitions that should be atomic

> **Note:** Duplicate values are still skipped within batches.

#### `persist(options: PersistOptions): DoIt`
Enables automatic persistence to localStorage or sessionStorage. Returns the store instance for chaining.

```typescript
store.persist({ to: localStorage });
store.persist({ to: sessionStorage, key: 'my-app-state' });
```

- **options&#46;to**: Storage adapter (localStorage or sessionStorage)
- **options.key** (optional): Storage key. Default: `'doit-state'`

**Features:**
- Auto-saves state and history on every change
- Auto-restores state and history on initialization
- Handles serialization errors gracefully

#### `unpersist(): void`
Disables persistence (does not clear existing stored data).

```typescript
store.unpersist();
```

---

### Types

```typescript
type PathToken =
    | { type: 'key'; value: string }
    | { type: 'index'; value: number }
    | { type: 'filter'; key: string; value: any };

type Operation =
    | { op: 'set'; path: string; value: any }
    | { op: 'delete'; path: string }
    | { op: 'batch'; ops: Operation[] };

interface StorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
```


## Framework Integration

### React Example

You can create a simple hook to connect the store to your components.

```tsx
import { useEffect, useState } from 'react';
import { DoIt } from 'doit-lib';

const store = new DoIt({ count: 0 });

export function useDoIt(store) {
    const [state, setState] = useState(store.getState());

    useEffect(() => {
        return store.subscribe((newState) => {
            setState({ ...newState }); // Trigger re-render
        });
    }, [store]);

    return state;
}

// Component
export const Counter = () => {
    const state = useDoIt(store);
    
    return (
        <div>
            <h1>{state.count}</h1>
            <button onClick={() => store.set('count', state.count + 1)}>Increment</button>
            <button onClick={() => store.undo()}>Undo</button>
        </div>
    );
};
```

### Vue Example

Using Vue's Composition API.

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { DoIt } from 'doit-lib';

const store = new DoIt({ count: 0 });
const state = ref(store.getState());

let unsubscribe;

onMounted(() => {
    unsubscribe = store.subscribe((newState) => {
        state.value = { ...newState }; // Update reactive ref
    });
});

onUnmounted(() => {
    if (unsubscribe) unsubscribe();
});

const inc = () => store.set('count', state.value.count + 1);
const undo = () => store.undo();
</script>

<template>
  <div>
    <h1>{{ state.count }}</h1>
    <button @click="inc">Increment</button>
    <button @click="undo">Undo</button>
  </div>
</template>
```

## Running the Demo

This repository is set up as a monorepo. To run the included Svelte-based demo:

1. Navigate to the demo package:
   ```bash
   cd packages/demo
   ```
2. Install dependencies (if not done at root):
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Limitations

1. **JSON-serializable State**: The library is best suited for serializable data structures (objects, arrays, primitives). Complex class instances or cyclic references may not work as expected or preserve their prototype chain during history traversal.
2. **Filter Performance**: Using filter selectors (e.g., `list[id:123]`) involves a linear search over the array. For very large arrays, this might impact performance.

## TODO

*   [x] Publish to NPM
*   [x] Add support for persistent history (e.g., localStorage)
*   [x] Add support for batch operations

