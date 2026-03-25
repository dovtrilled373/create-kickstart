import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// Seed data JSON (shared across stacks)
// ---------------------------------------------------------------------------

const SEED_ITEMS_JSON = `[
  { "id": "1", "title": "Set up project", "description": "Initialize the repository and install dependencies", "completed": true },
  { "id": "2", "title": "Design API", "description": "Define REST endpoints and data models", "completed": true },
  { "id": "3", "title": "Build frontend", "description": "Create the user interface components", "completed": false },
  { "id": "4", "title": "Write tests", "description": "Add unit and integration tests", "completed": false },
  { "id": "5", "title": "Deploy to production", "description": "Set up CI/CD and deploy", "completed": false }
]`;

// ---------------------------------------------------------------------------
// Backend: FastAPI
// ---------------------------------------------------------------------------

function fastapiItemModel(): string {
  return `from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class Item(BaseModel):
    id: str
    title: str
    description: str = ""
    completed: bool = False
    created_at: datetime = datetime.now()


class ItemCreate(BaseModel):
    title: str
    description: str = ""
    completed: bool = False
`;
}

function fastapiItemsRouter(): string {
  return `from fastapi import APIRouter, HTTPException
from datetime import datetime
from uuid import uuid4

from app.models.item import Item, ItemCreate

router = APIRouter(prefix="/api/items", tags=["items"])

# In-memory store with seed data
_items: list[Item] = [
    Item(id="1", title="Set up project", description="Initialize the repository and install dependencies", completed=True, created_at=datetime.now()),
    Item(id="2", title="Design API", description="Define REST endpoints and data models", completed=True, created_at=datetime.now()),
    Item(id="3", title="Build frontend", description="Create the user interface components", completed=False, created_at=datetime.now()),
    Item(id="4", title="Write tests", description="Add unit and integration tests", completed=False, created_at=datetime.now()),
    Item(id="5", title="Deploy to production", description="Set up CI/CD and deploy", completed=False, created_at=datetime.now()),
]


@router.get("/", response_model=list[Item])
async def list_items():
    return _items


@router.post("/", response_model=Item, status_code=201)
async def create_item(payload: ItemCreate):
    item = Item(
        id=str(uuid4()),
        title=payload.title,
        description=payload.description,
        completed=payload.completed,
        created_at=datetime.now(),
    )
    _items.append(item)
    return item


@router.get("/{item_id}", response_model=Item)
async def get_item(item_id: str):
    for item in _items:
        if item.id == item_id:
            return item
    raise HTTPException(status_code=404, detail="Item not found")


@router.put("/{item_id}", response_model=Item)
async def update_item(item_id: str, payload: ItemCreate):
    for i, item in enumerate(_items):
        if item.id == item_id:
            updated = item.model_copy(update=payload.model_dump())
            _items[i] = updated
            return updated
    raise HTTPException(status_code=404, detail="Item not found")


@router.delete("/{item_id}", status_code=204)
async def delete_item(item_id: str):
    for i, item in enumerate(_items):
        if item.id == item_id:
            _items.pop(i)
            return
    raise HTTPException(status_code=404, detail="Item not found")
`;
}

function fastapiRoutesNote(): string {
  return `# Registering the Items Router

Add the following to your \`app/main.py\` to register the items CRUD router:

\`\`\`python
from app.routes.items import router as items_router

app.include_router(items_router)
\`\`\`

Place it after the app is created (e.g. after \`app = FastAPI()\`).
`;
}

// ---------------------------------------------------------------------------
// Backend: Express
// ---------------------------------------------------------------------------

function expressItemType(): string {
  return `export interface Item {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
}
`;
}

function expressItemsRouter(): string {
  return `import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { Item } from "../types/item.js";

const router = Router();

const items: Item[] = [
  { id: "1", title: "Set up project", description: "Initialize the repository and install dependencies", completed: true, createdAt: new Date().toISOString() },
  { id: "2", title: "Design API", description: "Define REST endpoints and data models", completed: true, createdAt: new Date().toISOString() },
  { id: "3", title: "Build frontend", description: "Create the user interface components", completed: false, createdAt: new Date().toISOString() },
  { id: "4", title: "Write tests", description: "Add unit and integration tests", completed: false, createdAt: new Date().toISOString() },
  { id: "5", title: "Deploy to production", description: "Set up CI/CD and deploy", completed: false, createdAt: new Date().toISOString() },
];

router.get("/", (_req: Request, res: Response) => {
  res.json(items);
});

router.post("/", (req: Request, res: Response) => {
  const item: Item = {
    id: randomUUID(),
    title: req.body.title,
    description: req.body.description ?? "",
    completed: req.body.completed ?? false,
    createdAt: new Date().toISOString(),
  };
  items.push(item);
  res.status(201).json(item);
});

router.get("/:id", (req: Request, res: Response) => {
  const item = items.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json(item);
});

router.put("/:id", (req: Request, res: Response) => {
  const idx = items.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Item not found" });
  items[idx] = {
    ...items[idx],
    title: req.body.title ?? items[idx].title,
    description: req.body.description ?? items[idx].description,
    completed: req.body.completed ?? items[idx].completed,
  };
  res.json(items[idx]);
});

router.delete("/:id", (req: Request, res: Response) => {
  const idx = items.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Item not found" });
  items.splice(idx, 1);
  res.status(204).send();
});

export default router;
`;
}

// ---------------------------------------------------------------------------
// Backend: Go Chi
// ---------------------------------------------------------------------------

function goChiItemModel(): string {
  return `package items

import "time"

// Item represents a task/todo item.
type Item struct {
\tID          string    \`json:"id"\`
\tTitle       string    \`json:"title"\`
\tDescription string    \`json:"description"\`
\tCompleted   bool      \`json:"completed"\`
\tCreatedAt   time.Time \`json:"created_at"\`
}

// ItemCreate is the payload for creating/updating an item.
type ItemCreate struct {
\tTitle       string \`json:"title"\`
\tDescription string \`json:"description"\`
\tCompleted   bool   \`json:"completed"\`
}
`;
}

function goChiItemHandler(): string {
  return `package items

import (
\t"encoding/json"
\t"net/http"
\t"time"

\t"github.com/go-chi/chi/v5"
\t"github.com/google/uuid"
)

var store = []Item{
\t{ID: "1", Title: "Set up project", Description: "Initialize the repository and install dependencies", Completed: true, CreatedAt: time.Now()},
\t{ID: "2", Title: "Design API", Description: "Define REST endpoints and data models", Completed: true, CreatedAt: time.Now()},
\t{ID: "3", Title: "Build frontend", Description: "Create the user interface components", Completed: false, CreatedAt: time.Now()},
\t{ID: "4", Title: "Write tests", Description: "Add unit and integration tests", Completed: false, CreatedAt: time.Now()},
\t{ID: "5", Title: "Deploy to production", Description: "Set up CI/CD and deploy", Completed: false, CreatedAt: time.Now()},
}

// Router returns a chi router with CRUD routes for /api/items.
func Router() chi.Router {
\tr := chi.NewRouter()
\tr.Get("/", listItems)
\tr.Post("/", createItem)
\tr.Get("/{id}", getItem)
\tr.Put("/{id}", updateItem)
\tr.Delete("/{id}", deleteItem)
\treturn r
}

func listItems(w http.ResponseWriter, _ *http.Request) {
\tjson.NewEncoder(w).Encode(store)
}

func createItem(w http.ResponseWriter, r *http.Request) {
\tvar payload ItemCreate
\tif err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
\t\thttp.Error(w, err.Error(), http.StatusBadRequest)
\t\treturn
\t}
\titem := Item{
\t\tID:          uuid.New().String(),
\t\tTitle:       payload.Title,
\t\tDescription: payload.Description,
\t\tCompleted:   payload.Completed,
\t\tCreatedAt:   time.Now(),
\t}
\tstore = append(store, item)
\tw.WriteHeader(http.StatusCreated)
\tjson.NewEncoder(w).Encode(item)
}

func getItem(w http.ResponseWriter, r *http.Request) {
\tid := chi.URLParam(r, "id")
\tfor _, item := range store {
\t\tif item.ID == id {
\t\t\tjson.NewEncoder(w).Encode(item)
\t\t\treturn
\t\t}
\t}
\thttp.Error(w, "Item not found", http.StatusNotFound)
}

func updateItem(w http.ResponseWriter, r *http.Request) {
\tid := chi.URLParam(r, "id")
\tvar payload ItemCreate
\tif err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
\t\thttp.Error(w, err.Error(), http.StatusBadRequest)
\t\treturn
\t}
\tfor i, item := range store {
\t\tif item.ID == id {
\t\t\tstore[i].Title = payload.Title
\t\t\tstore[i].Description = payload.Description
\t\t\tstore[i].Completed = payload.Completed
\t\t\tjson.NewEncoder(w).Encode(store[i])
\t\t\treturn
\t\t}
\t}
\thttp.Error(w, "Item not found", http.StatusNotFound)
}

func deleteItem(w http.ResponseWriter, r *http.Request) {
\tid := chi.URLParam(r, "id")
\tfor i, item := range store {
\t\tif item.ID == id {
\t\t\tstore = append(store[:i], store[i+1:]...)
\t\t\tw.WriteHeader(http.StatusNoContent)
\t\t\treturn
\t\t}
\t}
\thttp.Error(w, "Item not found", http.StatusNotFound)
}
`;
}

// ---------------------------------------------------------------------------
// Frontend components
// ---------------------------------------------------------------------------

function reactItemList(): string {
  return `"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Item {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export default function ItemList() {
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    api.get<Item[]>("/items").then(setItems).catch(console.error);
  }, []);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const item = await api.post<Item>("/items", { title, description });
    setItems((prev) => [...prev, item]);
    setTitle("");
    setDescription("");
  };

  const toggleComplete = async (item: Item) => {
    const updated = await api.put<Item>(\`/items/\${item.id}\`, {
      ...item,
      completed: !item.completed,
    });
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  const removeItem = async (id: string) => {
    await api.del(\`/items/\${id}\`);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h2>Items</h2>
      <form onSubmit={addItem} style={{ marginBottom: "1rem" }}>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <input
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button type="submit">Add Item</button>
      </form>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {items.map((item) => (
          <li key={item.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #eee" }}>
            <label style={{ textDecoration: item.completed ? "line-through" : "none" }}>
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => toggleComplete(item)}
                style={{ marginRight: 8 }}
              />
              <strong>{item.title}</strong> &mdash; {item.description}
            </label>
            <button onClick={() => removeItem(item.id)} style={{ marginLeft: 8, color: "red" }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
`;
}

function vueItemList(): string {
  return `<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "../lib/api";

interface Item {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

const items = ref<Item[]>([]);
const title = ref("");
const description = ref("");

onMounted(async () => {
  items.value = await api.get<Item[]>("/items");
});

async function addItem() {
  if (!title.value.trim()) return;
  const item = await api.post<Item>("/items", {
    title: title.value,
    description: description.value,
  });
  items.value.push(item);
  title.value = "";
  description.value = "";
}

async function toggleComplete(item: Item) {
  const updated = await api.put<Item>(\`/items/\${item.id}\`, {
    ...item,
    completed: !item.completed,
  });
  const idx = items.value.findIndex((i) => i.id === updated.id);
  if (idx !== -1) items.value[idx] = updated;
}

async function removeItem(id: string) {
  await api.del(\`/items/\${id}\`);
  items.value = items.value.filter((i) => i.id !== id);
}
</script>

<template>
  <div style="max-width: 600px; margin: 2rem auto; font-family: sans-serif">
    <h2>Items</h2>
    <form @submit.prevent="addItem" style="margin-bottom: 1rem">
      <input v-model="title" placeholder="Title" style="margin-right: 8px" />
      <input v-model="description" placeholder="Description" style="margin-right: 8px" />
      <button type="submit">Add Item</button>
    </form>
    <ul style="list-style: none; padding: 0">
      <li
        v-for="item in items"
        :key="item.id"
        style="padding: 0.5rem 0; border-bottom: 1px solid #eee"
      >
        <label :style="{ textDecoration: item.completed ? 'line-through' : 'none' }">
          <input
            type="checkbox"
            :checked="item.completed"
            @change="toggleComplete(item)"
            style="margin-right: 8px"
          />
          <strong>{{ item.title }}</strong> &mdash; {{ item.description }}
        </label>
        <button @click="removeItem(item.id)" style="margin-left: 8px; color: red">Delete</button>
      </li>
    </ul>
  </div>
</template>
`;
}

function svelteItemList(): string {
  return `<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "../lib/api";

  interface Item {
    id: string;
    title: string;
    description: string;
    completed: boolean;
  }

  let items: Item[] = [];
  let title = "";
  let description = "";

  onMount(async () => {
    items = await api.get<Item[]>("/items");
  });

  async function addItem() {
    if (!title.trim()) return;
    const item = await api.post<Item>("/items", { title, description });
    items = [...items, item];
    title = "";
    description = "";
  }

  async function toggleComplete(item: Item) {
    const updated = await api.put<Item>(\`/items/\${item.id}\`, {
      ...item,
      completed: !item.completed,
    });
    items = items.map((i) => (i.id === updated.id ? updated : i));
  }

  async function removeItem(id: string) {
    await api.del(\`/items/\${id}\`);
    items = items.filter((i) => i.id !== id);
  }
</script>

<div style="max-width: 600px; margin: 2rem auto; font-family: sans-serif">
  <h2>Items</h2>
  <form on:submit|preventDefault={addItem} style="margin-bottom: 1rem">
    <input bind:value={title} placeholder="Title" style="margin-right: 8px" />
    <input bind:value={description} placeholder="Description" style="margin-right: 8px" />
    <button type="submit">Add Item</button>
  </form>
  <ul style="list-style: none; padding: 0">
    {#each items as item (item.id)}
      <li style="padding: 0.5rem 0; border-bottom: 1px solid #eee">
        <label style:text-decoration={item.completed ? "line-through" : "none"}>
          <input
            type="checkbox"
            checked={item.completed}
            on:change={() => toggleComplete(item)}
            style="margin-right: 8px"
          />
          <strong>{item.title}</strong> &mdash; {item.description}
        </label>
        <button on:click={() => removeItem(item.id)} style="margin-left: 8px; color: red">
          Delete
        </button>
      </li>
    {/each}
  </ul>
</div>
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceSampleCrud(
  config: ProjectConfig,
  registry: Registry,
): Promise<void> {
  const feStack = config.frontend;
  const beStack = config.backend;
  const isFullstack = config.type === "fullstack";
  const feDir = isFullstack ? path.join(config.targetDir, "frontend") : config.targetDir;
  const beDir = isFullstack ? path.join(config.targetDir, "backend") : config.targetDir;

  // --- A) Backend CRUD endpoints ---
  if (beStack) {
    switch (beStack) {
      case "fastapi": {
        await fs.ensureDir(path.join(beDir, "app", "models"));
        await fs.ensureDir(path.join(beDir, "app", "routes"));
        await fs.writeFile(path.join(beDir, "app", "models", "__init__.py"), "");
        await fs.writeFile(path.join(beDir, "app", "models", "item.py"), fastapiItemModel());
        await fs.writeFile(path.join(beDir, "app", "routes", "__init__.py"), "");
        await fs.writeFile(path.join(beDir, "app", "routes", "items.py"), fastapiItemsRouter());
        // Auto-register router in main.py
        await autoRegisterFastapiRouter(beDir);
        break;
      }
      case "express": {
        await fs.ensureDir(path.join(beDir, "src", "routes"));
        await fs.ensureDir(path.join(beDir, "src", "types"));
        await fs.writeFile(path.join(beDir, "src", "types", "item.ts"), expressItemType());
        await fs.writeFile(path.join(beDir, "src", "routes", "items.ts"), expressItemsRouter());
        // Auto-register router in index.ts
        await autoRegisterExpressRouter(beDir);
        break;
      }
      case "go-chi": {
        await fs.ensureDir(path.join(beDir, "internal", "items"));
        await fs.writeFile(path.join(beDir, "internal", "items", "model.go"), goChiItemModel());
        await fs.writeFile(path.join(beDir, "internal", "items", "handler.go"), goChiItemHandler());
        break;
      }
    }
  }

  // --- B) Frontend list view ---
  if (feStack) {
    const compDir = path.join(feDir, "src", "components");
    await fs.ensureDir(compDir);

    switch (feStack) {
      case "nextjs":
      case "react-vite":
        await fs.writeFile(path.join(compDir, "ItemList.tsx"), reactItemList());
        break;
      case "vue":
        await fs.writeFile(path.join(compDir, "ItemList.vue"), vueItemList());
        break;
      case "svelte":
        await fs.writeFile(path.join(compDir, "ItemList.svelte"), svelteItemList());
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Auto-register routers into the main app file
// ---------------------------------------------------------------------------

async function autoRegisterFastapiRouter(beDir: string): Promise<void> {
  const mainPath = path.join(beDir, "app", "main.py");
  if (!(await fs.pathExists(mainPath))) return;

  let content = await fs.readFile(mainPath, "utf-8");

  // Add import if not already there
  if (!content.includes("from app.routes.items")) {
    // Insert import after existing imports
    const importLine = "from app.routes.items import router as items_router\n";
    const registerLine = "app.include_router(items_router)\n";

    // Add import at top after last import
    const lines = content.split("\n");
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("from ") || lines[i].startsWith("import ")) {
        lastImportIdx = i;
      }
    }
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, importLine);
    } else {
      lines.unshift(importLine);
    }

    // Add include_router after app = FastAPI(...)
    content = lines.join("\n");
    content = content.replace(
      /(app\s*=\s*FastAPI\([^)]*\))/,
      `$1\n\n${registerLine}`,
    );

    await fs.writeFile(mainPath, content);
  }
}

async function autoRegisterExpressRouter(beDir: string): Promise<void> {
  const indexPath = path.join(beDir, "src", "index.ts");
  if (!(await fs.pathExists(indexPath))) return;

  let content = await fs.readFile(indexPath, "utf-8");

  if (!content.includes("routes/items")) {
    // Add import at top
    const importLine = 'import itemsRouter from "./routes/items.js";\n';

    // Add import after last import
    const lines = content.split("\n");
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) {
        lastImportIdx = i;
      }
    }
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, importLine);
    }

    content = lines.join("\n");

    // Mount router before app.listen
    content = content.replace(
      /(app\.listen)/,
      'app.use("/api/items", itemsRouter);\n\n$1',
    );

    await fs.writeFile(indexPath, content);
  }
}
