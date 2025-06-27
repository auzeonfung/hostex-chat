"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Model {
  id: string;
}

export default function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-3.5-turbo");
  const [prompt, setPrompt] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [theme, setTheme] = useState("system");
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    const s = JSON.parse(localStorage.getItem("settings") || "{}");
    setApiKey(s.apiKey || "");
    setModel(s.model || "gpt-3.5-turbo");
    setPrompt(s.prompt || "");
    setTheme(s.theme || "system");
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    setLoadingModels(true);
    fetch("/api/openai/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.data)) {
          setModels(data.data);
        }
      })
      .finally(() => setLoadingModels(false));
  }, [apiKey]);

  function save() {
    localStorage.setItem(
      "settings",
      JSON.stringify({ apiKey, model, prompt, theme })
    );
    if (theme === "dark" || (theme === "system" && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    alert("Saved");
  }

  return (
    <main className="p-4 space-y-4 max-w-xl mx-auto">
      <div className="flex justify-between border-b pb-2 mb-2">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Link href="/" className="text-blue-600 underline">
          Back
        </Link>
      </div>
      <div className="space-y-2">
        <label className="block">
          <span className="font-medium">OpenAI API Key</span>
          <input
            type="password"
            className="mt-1 w-full rounded border p-2"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="font-medium">Model</span>
          <select
            className="mt-1 w-full rounded border p-2"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {loadingModels && <option>Loading...</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-medium">System Prompt</span>
          <textarea
            className="mt-1 w-full rounded border p-2"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="font-medium">Theme</span>
          <select
            className="mt-1 w-full rounded border p-2"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>
        <button
          onClick={save}
          className="rounded bg-blue-600 px-3 py-1 text-white"
        >
          Save
        </button>
      </div>
    </main>
  );
}
