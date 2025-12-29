<script lang="ts">
  import { Redo2, Undo2 } from "@lucide/svelte";
  import { DoIt } from "doit-js";
  import { onMount } from "svelte";

  let engine: DoIt;
  let currentState = $state({});
  let undoCount = $state(0);
  let redoCount = $state(0);
  let canUndo = $state(false);
  let canRedo = $state(false);

  let pathInput = $state("user.name");
  let valueInput = $state("Budi makan sate");
  let logs: Array<{ time: string; action: string; details: string }> = $state(
    [],
  );

  const initialState = {
    user: {
      name: "Anonymous",
      age: 0,
      email: "",
    },
    items: ["Item 1", "Item 2"],
    settings: {
      theme: "light",
      notifications: true,
    },
  };

  onMount(() => {
    engine = new DoIt(JSON.parse(JSON.stringify(initialState)));
    syncState();
    return engine.subscribe((state, history) => {
      currentState = { ...state };

      undoCount = history.undo;
      redoCount = history.redo;
      canUndo = history.canUndo;
      canRedo = history.canRedo;
    });
  });

  function syncState() {
    if (!engine) return;
    currentState = { ...engine.getState() };
    const hist = engine.getHistory();
    undoCount = hist.undo;
    redoCount = hist.redo;
    canUndo = hist.canUndo;
    canRedo = hist.canRedo;
  }

  function addLog(action: string, details: string = "") {
    logs = [
      ...logs,
      {
        time: new Date().toLocaleTimeString(),
        action,
        details,
      },
    ].slice(-10);
  }

  function applyChange() {
    if (!pathInput) return alert("Path required");

    let parsedValue: any = valueInput;
    try {
      parsedValue = JSON.parse(valueInput);
    } catch (e) {}

    try {
      engine.set(pathInput, parsedValue);
      addLog("Set Value", `${pathInput} = ${JSON.stringify(parsedValue)}`);
    } catch (e: any) {
      alert(e.message);
    }
  }

  function doUndo() {
    if (engine.undo()) addLog("Undo", "Reverted last change");
  }

  function doRedo() {
    if (engine.redo()) addLog("Redo", "Reapplied change");
  }

  function batchDemo() {
    engine.set("user.name", "Batch User");
    engine.set("user.age", 30);
    engine.set("user.email", "batch@example.com");
    addLog("Batch Update", "Multiple fields updated (separate steps)");
  }

  function clearHistory() {
    engine.clearHistory();
    addLog("Clear History");
  }

  function resetState() {
    location.reload();
  }

  function quickSet(p: string, v: any) {
    pathInput = p;
    valueInput = typeof v === "string" ? v : JSON.stringify(v);
    applyChange();
  }

  function handleKeydown(event: KeyboardEvent) {
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);

    const isUndo =
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "z" &&
      !event.shiftKey;

    const isRedo =
      (!isMac &&
        event.ctrlKey &&
        (event.key.toLowerCase() === "y" ||
          (event.key.toLowerCase() === "z" && event.shiftKey))) ||
      (isMac &&
        event.metaKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "z");

    if (isUndo && canUndo) {
      event.preventDefault();
      doUndo();
    } else if (isRedo && canRedo) {
      event.preventDefault();
      doRedo();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />
<div class="app-container">
  <div class="main-content">
    <div class="header">
      <h1>doit</h1>

      <div style=" display: flex; align-items: center; gap: 10px; ">
        <p class="subtitle">
          Undo/Redo State Management
          
        </p>
        <iframe
            src="https://ghbtns.com/github-btn.html?user=khalifmv&repo=doit&type=star&size=large&text=false"
            frameborder="0"
            scrolling="0"
            width="170"
            height="30"
            title="GitHub"
          ></iframe>
      </div>
    </div>

    <div class="card">
      <div class="history-badges">
        <div class="badge">
          <span class="badge-label">Undo</span>
          <span class="badge-value">{undoCount}</span>
        </div>
        <div class="badge">
          <span class="badge-label">Redo</span>
          <span class="badge-value">{redoCount}</span>
        </div>
      </div>

      <div class="input-section">
        <div class="input-row">
          <input
            type="text"
            bind:value={pathInput}
            placeholder="Path (e.g. user.name)"
            class="input-field"
          />
          <input
            type="text"
            bind:value={valueInput}
            placeholder="Value"
            class="input-field"
          />
        </div>
        <button class="btn-primary" onclick={applyChange}> Set Value </button>
      </div>

      <div class="button-group">
        <button class="btn-secondary" disabled={!canUndo} onclick={doUndo}>
          <Undo2 size="16" />
          Undo
        </button>
        <button class="btn-secondary" disabled={!canRedo} onclick={doRedo}>
          <Redo2 size="16" />
          Redo
        </button>
        <button class="btn-secondary" onclick={batchDemo}> Batch Demo </button>
        <button class="btn-outline" onclick={clearHistory}>
          Clear History
        </button>
        <button class="btn-outline" onclick={resetState}> Reset All </button>
      </div>

      <div class="examples-section">
        <h3>Quick Examples</h3>
        <div class="examples-grid">
          <button
            class="example-btn"
            onclick={() => quickSet("user.email", "budi@mail.com")}
          >
            Set user.email
          </button>
          <button class="example-btn" onclick={() => quickSet("user.age", 25)}>
            Set user.age = 25
          </button>
          <button
            class="example-btn"
            onclick={() => quickSet("items[0]", "Apple")}
          >
            Set items[0]
          </button>
          <button
            class="example-btn"
            onclick={() => quickSet("items[id:1].name", "New Item")}
          >
            Set items[id:1].name
          </button>
          <button
            class="example-btn"
            onclick={() => quickSet("profile.active", true)}
          >
            Set profile.active = true
          </button>
        </div>
      </div>
    </div>

    <div class="panels">
      <div class="panel">
        <h2>Action Log</h2>
        <div class="log-list">
          {#each [...logs].reverse() as log}
            <div class="log-entry">
              <div class="log-time">{log.time}</div>
              <div class="log-content">
                <div class="log-action">{log.action}</div>
                {#if log.details}
                  <div class="log-details">{log.details}</div>
                {/if}
              </div>
            </div>
          {/each}
          {#if logs.length === 0}
            <div class="empty-state">No actions yet</div>
          {/if}
        </div>
      </div>

      <div class="panel">
        <h2>Current State</h2>
        <div class="code-block">
          <pre>{JSON.stringify(currentState, null, 2)}</pre>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto",
      "Oxygen", "Ubuntu", "Cantarell", sans-serif;
    background: #f5f5f5;
    color: #2d2d2d;
  }

  .app-container {
    min-height: 100vh;
    padding: 24px;
  }

  .main-content {
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    margin-bottom: 32px;
  }

  .header h1 {
    margin: 0;
    font-size: 32px;
    font-weight: 500;
    color: #191919;
    letter-spacing: -0.5px;
  }

  .subtitle {
    margin: 0;
    color: #6b6b6b;
    font-size: 15px;
  }

  .card {
    background: white;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
    border: 1px solid #e5e5e5;
  }

  .history-badges {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  .badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: #f9f9f9;
    border-radius: 8px;
    border: 1px solid #e5e5e5;
  }

  .badge-label {
    font-size: 14px;
    color: #6b6b6b;
  }

  .badge-value {
    font-size: 16px;
    font-weight: 600;
    color: #191919;
  }

  .input-section {
    margin-bottom: 20px;
  }

  .input-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }

  .input-field {
    padding: 12px 16px;
    border: 1px solid #d4d4d4;
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    transition: all 0.2s;
    background: white;
  }

  .input-field:focus {
    outline: none;
    border-color: #9b9b9b;
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.05);
  }

  .input-field::placeholder {
    color: #9b9b9b;
  }

  .button-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 24px;
  }

  button {
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .btn-primary {
    background: #191919;
    color: white;
  }

  .btn-primary:hover {
    background: #2d2d2d;
  }

  .btn-secondary {
    background: #f0f0f0;
    color: #191919;
    border: 1px solid #e5e5e5;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e5e5;
  }

  .btn-secondary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-outline {
    background: white;
    color: #6b6b6b;
    border: 1px solid #d4d4d4;
  }

  .btn-outline:hover {
    background: #f9f9f9;
    border-color: #9b9b9b;
  }

  .examples-section {
    padding-top: 24px;
    border-top: 1px solid #e5e5e5;
  }

  .examples-section h3 {
    margin: 0 0 16px 0;
    font-size: 15px;
    font-weight: 500;
    color: #191919;
  }

  .examples-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
  }

  .example-btn {
    padding: 10px 14px;
    background: #f9f9f9;
    color: #2d2d2d;
    border: 1px solid #e5e5e5;
    text-align: left;
    font-size: 13px;
  }

  .example-btn:hover {
    background: #f0f0f0;
    border-color: #d4d4d4;
  }

  .panels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 20px;
  }

  .panel {
    background: white;
    border-radius: 12px;
    padding: 24px;
    border: 1px solid #e5e5e5;
  }

  .panel h2 {
    margin: 0 0 20px 0;
    font-size: 17px;
    font-weight: 500;
    color: #191919;
  }

  .log-list {
    max-height: 400px;
    overflow-y: auto;
  }

  .log-entry {
    display: flex;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 8px;
    background: #f9f9f9;
    border: 1px solid #f0f0f0;
  }

  .log-time {
    font-size: 12px;
    color: #9b9b9b;
    white-space: nowrap;
    font-family: "SF Mono", Monaco, "Courier New", monospace;
  }

  .log-content {
    flex: 1;
    min-width: 0;
  }

  .log-action {
    font-size: 14px;
    font-weight: 500;
    color: #191919;
    margin-bottom: 2px;
  }

  .log-details {
    font-size: 13px;
    color: #6b6b6b;
    font-family: "SF Mono", Monaco, "Courier New", monospace;
    word-break: break-all;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #9b9b9b;
    font-size: 14px;
  }

  .code-block {
    background: #f9f9f9;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 16px;
    max-height: 400px;
    overflow: auto;
  }

  .code-block pre {
    margin: 0;
    font-family: "SF Mono", Monaco, "Courier New", monospace;
    font-size: 13px;
    line-height: 1.6;
    color: #2d2d2d;
  }

  .log-list::-webkit-scrollbar,
  .code-block::-webkit-scrollbar {
    width: 8px;
  }

  .log-list::-webkit-scrollbar-track,
  .code-block::-webkit-scrollbar-track {
    background: transparent;
  }

  .log-list::-webkit-scrollbar-thumb,
  .code-block::-webkit-scrollbar-thumb {
    background: #d4d4d4;
    border-radius: 4px;
  }

  .log-list::-webkit-scrollbar-thumb:hover,
  .code-block::-webkit-scrollbar-thumb:hover {
    background: #9b9b9b;
  }

  @media (max-width: 768px) {
    .app-container {
      padding: 16px;
    }

    .input-row {
      grid-template-columns: 1fr;
    }

    .panels {
      grid-template-columns: 1fr;
    }

    .examples-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
