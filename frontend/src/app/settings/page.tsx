"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";

interface Setting {
  id: string;
  name: string;
  data: any;
}

interface Model { id: string }

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [models, setModels] = useState<Model[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  const [name, setName] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("gpt-3.5-turbo")
  const [prompt, setPrompt] = useState("")
  const [theme, setTheme] = useState("system")
  const [autoReply, setAutoReply] = useState(false)

  async function load() {
    const res = await fetch("/api/settings")
    const data = await res.json()
    setSettings(data.settings || [])
  }

  useEffect(() => {
    load()
    const active = localStorage.getItem("activeSettingId")
    if (active) setSelected(active)
  }, [])

  useEffect(() => {
    if (!selected) {
      setName("");
      setApiKey("");
      setModel("gpt-3.5-turbo");
      setPrompt("");
      setTheme("system");
      setAutoReply(false);
      return;
    }
    const s = settings.find((s) => s.id === selected)
    if (s) {
      setName(s.name)
      setApiKey(s.data.apiKey || "")
      setModel(s.data.model || "gpt-3.5-turbo")
      setPrompt(s.data.prompt || "")
      setTheme(s.data.theme || "system")
      setAutoReply(!!s.data.autoReply)
    }
  }, [selected, settings])

  useEffect(() => {
    if (!apiKey) return
    setLoadingModels(true)
    fetch("/api/openai/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    })
      .then((res) => res.json())
      .then((data) => Array.isArray(data.data) && setModels(data.data))
      .finally(() => setLoadingModels(false))
  }, [apiKey])

  async function save() {
    const payload = { apiKey, model, prompt, theme, autoReply }
    if (selected) {
      await fetch(`/api/settings/${selected}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, data: payload }),
      })
      localStorage.setItem("activeSettingId", selected)
    } else {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || "Default", data: payload }),
      })
      const data = await res.json()
      const newId = data.setting.id
      setSelected(newId)
      localStorage.setItem("activeSettingId", newId)
    }
    await load()
    alert("Saved")
  }

  async function remove() {
    if (!selected) return
    await fetch(`/api/settings/${selected}`, { method: "DELETE" })
    setSelected(null)
    await load()
  }

  function applyTheme(val: string) {
    if (val === "dark" || (val === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <main className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex justify-between border-b pb-2 mb-2">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Link href="/" className="text-blue-600 underline">Back</Link>
      </div>
      <div className="flex space-x-4">
        <div className="w-48 space-y-2">
          {settings.map((s) => (
            <Button
              key={s.id}
              variant={selected === s.id ? "default" : "secondary"}
              className="w-full"
              onClick={() => setSelected(s.id)}
            >
              {s.name}
            </Button>
          ))}
          <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>
            New
          </Button>
        </div>
        <div className="flex-1 space-y-2">
          <label className="block">
            <span className="font-medium">Name</span>
            <Input className="mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="font-medium">OpenAI API Key</span>
            <Input type="password" className="mt-1 w-full" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="font-medium">Model</span>
            <Select value={model} onValueChange={(val) => setModel(val)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {loadingModels && (
                  <SelectItem value="loading" disabled>
                    Loading...
                  </SelectItem>
                )}
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block">
            <span className="font-medium">System Prompt</span>
            <Textarea className="mt-1 w-full" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </label>
          <div className="flex items-center space-x-2">
            <Toggle
              pressed={autoReply}
              onPressedChange={(val) => setAutoReply(val)}
              aria-label="Auto generate reply"
            >
              Auto generate reply
            </Toggle>
          </div>
          <label className="block space-y-1">
            <span className="font-medium">Theme</span>
            <Select value={theme} onValueChange={(val) => setTheme(val)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <div className="space-x-2">
            <Button onClick={save}>Save</Button>
            {selected && <Button variant="destructive" onClick={remove}>Delete</Button>}
          </div>
        </div>
      </div>
    </main>
  )
}
