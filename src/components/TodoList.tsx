"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "3point0.commandTodos";

export type CommandTodoItem = {
  id: string;
  text: string;
  done: boolean;
};

export function TodoList() {
  const [items, setItems] = useState<CommandTodoItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const next = parsed.filter(
            (x): x is CommandTodoItem =>
              typeof x === "object" &&
              x !== null &&
              typeof (x as CommandTodoItem).id === "string" &&
              typeof (x as CommandTodoItem).text === "string" &&
              typeof (x as CommandTodoItem).done === "boolean"
          );
          setItems(next);
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const handleAdd = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setItems((prev) => [...prev, { id, text, done: false }]);
    setInput("");
  }, [input]);

  const handleToggle = useCallback((id: string) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <section className="mission-card flex flex-col p-4" aria-label="Command todos">
      <h2 className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--color-accent-eggshell)]">
        Todos
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Local to this browser — quick capture for the day.</p>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          className="min-h-11 min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-accent-eggshell)] placeholder:text-[var(--color-text-secondary)]"
          placeholder="Add a task…"
          value={input}
          aria-label="New todo"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="min-h-11 shrink-0 rounded border border-[rgba(var(--accent-rgb),0.45)] bg-[rgba(var(--accent-rgb),0.1)] px-3 font-mono text-[10px] uppercase tracking-wider text-[color:var(--accent)]"
        >
          Add
        </button>
      </div>

      <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto p-0.5" aria-live="polite">
        {items.length === 0 && (
          <li className="list-none text-center text-sm text-[var(--color-text-secondary)]">Nothing here yet.</li>
        )}
        {items.map((item) => (
          <li key={item.id} className="glass-card list-none rounded-lg p-2">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => handleToggle(item.id)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--color-border)]"
                aria-label={`Done: ${item.text}`}
              />
              <p
                className={`min-w-0 flex-1 text-sm ${
                  item.done
                    ? "text-[var(--color-text-secondary)] line-through"
                    : "text-[color-mix(in_srgb,var(--color-accent-eggshell)_88%,transparent)]"
                }`}
              >
                {item.text}
              </p>
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                className="shrink-0 rounded px-2 py-1 font-mono text-[10px] uppercase text-[var(--color-accent-coral)] hover:bg-[rgba(232,83,61,0.12)]"
                aria-label={`Remove ${item.text}`}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
