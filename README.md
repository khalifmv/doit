# doit

A lightweight & framework-agnostic, path-based undo-redo state management library for JavaScript/TypeScript applications.

## Concept

`doit-lib` provides a centralized store where every mutation is recorded as an operation (`set`, `delete`). It allows you to modify deeply nested state using a string-based path syntax, automatically generating the corresponding inverse operations for undo capabilities.

Key features:
- **Path-based mutations**: Modify deep state easily (e.g., `users[0].name`).
- **Array Filtering**: Target array items by properties (e.g., `todos[id:123].completed`).
- **Automatic History**: Every `set` generates an undo/redo stack.
- **Framework Agnostic**: Works with Vanilla JS, React, Vue, Svelte, etc.

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
*   [ ] Add support for persistent history (e.g., localStorage)
