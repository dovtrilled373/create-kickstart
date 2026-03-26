import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { resolveProjectDirs, autoRegisterFastapiRoute } from "./utils.js";

// ---------------------------------------------------------------------------
// Backend WebSocket handlers per stack
// ---------------------------------------------------------------------------

function fastapiWs(): string {
  return `"""WebSocket endpoint.

Usage: pip install websockets

Add to your FastAPI app:
  from app.ws import router as ws_router
  app.include_router(ws_router)
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List

router = APIRouter()

# Simple connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
`;
}

function expressWs(): string {
  return `/**
 * WebSocket server for Express.
 *
 * Usage: npm install ws
 *
 * Import and call setupWebSocket(server) after creating the HTTP server.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

const clients = new Set<WebSocket>();

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);

    ws.on("message", (data) => {
      // Broadcast to all connected clients
      const message = data.toString();
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  return wss;
}
`;
}

function djangoWs(): string {
  return `"""Django Channels WebSocket consumer.

Usage: pip install channels channels-redis

Add to your routing.py:
  from app.consumers import ChatConsumer
  websocket_urlpatterns = [
      re_path(r"ws/$", ChatConsumer.as_asgi()),
  ]
"""

import json
from channels.generic.websocket import AsyncWebSocketConsumer


class ChatConsumer(AsyncWebSocketConsumer):
    connected_clients = set()

    async def connect(self):
        self.connected_clients.add(self)
        await self.accept()

    async def disconnect(self, close_code):
        self.connected_clients.discard(self)

    async def receive(self, text_data=None, bytes_data=None):
        # Broadcast to all connected clients
        for client in self.connected_clients:
            await client.send(text_data=text_data)
`;
}

function goChiWs(): string {
  return `package handlers

// WebSocket handler using gorilla/websocket.
//
// Usage: go get github.com/gorilla/websocket
//
// Register in your router:
//   r.Get("/ws", HandleWebSocket)

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

var (
	clients   = make(map[*websocket.Conn]bool)
	clientsMu sync.Mutex
)

func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	clientsMu.Lock()
	clients[conn] = true
	clientsMu.Unlock()

	defer func() {
		clientsMu.Lock()
		delete(clients, conn)
		clientsMu.Unlock()
	}()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}
		broadcast(message)
	}
}

func broadcast(message []byte) {
	clientsMu.Lock()
	defer clientsMu.Unlock()
	for client := range clients {
		if err := client.WriteMessage(websocket.TextMessage, message); err != nil {
			client.Close()
			delete(clients, client)
		}
	}
}
`;
}

function axumWs(): string {
  return `//! WebSocket handler for Axum.
//!
//! Add to Cargo.toml:
//!   axum = { version = "0.7", features = ["ws"] }
//!   tokio = { version = "1", features = ["full"] }
//!   futures = "0.3"
//!
//! Register in your router:
//!   .route("/ws", get(ws_handler))

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::broadcast;

pub type Tx = broadcast::Sender<String>;

pub fn create_broadcast() -> Tx {
    let (tx, _) = broadcast::channel(100);
    tx
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    tx: axum::extract::State<Arc<Tx>>,
) -> impl IntoResponse {
    let tx = tx.0.clone();
    ws.on_upgrade(move |socket| handle_socket(socket, tx))
}

async fn handle_socket(socket: WebSocket, tx: Arc<Tx>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = tx.subscribe();

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    let tx_clone = tx.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            let _ = tx_clone.send(text.to_string());
        }
    });

    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }
}
`;
}

function aspnetWs(): string {
  return `// WebSocket middleware for ASP.NET.
//
// Register in Program.cs:
//   app.UseWebSockets();
//   app.Map("/ws", WebSocketHandler.Handle);

using System.Net.WebSockets;
using System.Text;
using System.Collections.Concurrent;

namespace App.Handlers;

public static class WebSocketHandler
{
    private static readonly ConcurrentBag<WebSocket> _clients = new();

    public static async Task Handle(HttpContext context)
    {
        if (!context.WebSockets.IsWebSocketRequest)
        {
            context.Response.StatusCode = 400;
            return;
        }

        var ws = await context.WebSockets.AcceptWebSocketAsync();
        _clients.Add(ws);

        var buffer = new byte[4096];

        try
        {
            while (ws.State == WebSocketState.Open)
            {
                var result = await ws.ReceiveAsync(buffer, CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close) break;

                var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                await Broadcast(message);
            }
        }
        finally
        {
            // Client will be garbage collected from the bag
        }
    }

    private static async Task Broadcast(string message)
    {
        var bytes = Encoding.UTF8.GetBytes(message);
        foreach (var client in _clients)
        {
            if (client.State == WebSocketState.Open)
            {
                await client.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }
    }
}
`;
}

function phoenixWs(): string {
  return `defmodule AppWeb.RoomChannel do
  @moduledoc """
  Phoenix Channel for real-time WebSocket communication.

  Add to your socket configuration in endpoint.ex:
    socket "/socket", AppWeb.UserSocket, websocket: true

  Add to your UserSocket:
    channel "room:*", AppWeb.RoomChannel
  """

  use Phoenix.Channel

  @impl true
  def join("room:" <> _room_id, _payload, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_in("message", payload, socket) do
    broadcast!(socket, "message", payload)
    {:noreply, socket}
  end
end
`;
}

function springBootWs(): string {
  return `package com.app.config;

// WebSocket configuration for Spring Boot.
//
// Add to pom.xml: spring-boot-starter-websocket

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.concurrent.CopyOnWriteArraySet;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private static final CopyOnWriteArraySet<WebSocketSession> sessions = new CopyOnWriteArraySet<>();

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(new ChatHandler(), "/ws").setAllowedOrigins("*");
    }

    static class ChatHandler extends TextWebSocketHandler {
        @Override
        public void afterConnectionEstablished(WebSocketSession session) {
            sessions.add(session);
        }

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    s.sendMessage(message);
                }
            }
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus status) {
            sessions.remove(session);
        }
    }
}
`;
}

// ---------------------------------------------------------------------------
// Frontend WebSocket hooks
// ---------------------------------------------------------------------------

function reactUseWebSocket(): string {
  return `import { useEffect, useRef, useState, useCallback } from "react";

interface UseWebSocketOptions {
  url?: string;
  onMessage?: (data: string) => void;
  reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = \`ws://\${window.location.host}/ws\`,
    onMessage,
    reconnectInterval = 3000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimer = setTimeout(connect, reconnectInterval);
      };
      ws.onmessage = (event) => {
        setLastMessage(event.data);
        onMessage?.(event.data);
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [url, reconnectInterval, onMessage]);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { isConnected, lastMessage, send };
}
`;
}

function vueUseWebSocket(): string {
  return `import { ref, onMounted, onUnmounted } from "vue";

interface UseWebSocketOptions {
  url?: string;
  reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = \`ws://\${window.location.host}/ws\`,
    reconnectInterval = 3000,
  } = options;

  const isConnected = ref(false);
  const lastMessage = ref<string | null>(null);
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout>;

  function connect() {
    ws = new WebSocket(url);
    ws.onopen = () => { isConnected.value = true; };
    ws.onclose = () => {
      isConnected.value = false;
      reconnectTimer = setTimeout(connect, reconnectInterval);
    };
    ws.onmessage = (event) => {
      lastMessage.value = event.data;
    };
  }

  function send(data: string) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }

  onMounted(() => connect());
  onUnmounted(() => {
    clearTimeout(reconnectTimer);
    ws?.close();
  });

  return { isConnected, lastMessage, send };
}
`;
}

function svelteWebSocketStore(): string {
  return `import { writable } from "svelte/store";

interface WebSocketStoreOptions {
  url?: string;
  reconnectInterval?: number;
}

export function createWebSocketStore(options: WebSocketStoreOptions = {}) {
  const {
    url = \`ws://\${window.location.host}/ws\`,
    reconnectInterval = 3000,
  } = options;

  const isConnected = writable(false);
  const lastMessage = writable<string | null>(null);
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout>;

  function connect() {
    ws = new WebSocket(url);
    ws.onopen = () => isConnected.set(true);
    ws.onclose = () => {
      isConnected.set(false);
      reconnectTimer = setTimeout(connect, reconnectInterval);
    };
    ws.onmessage = (event) => {
      lastMessage.set(event.data);
    };
  }

  function send(data: string) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }

  function destroy() {
    clearTimeout(reconnectTimer);
    ws?.close();
  }

  connect();

  return { isConnected, lastMessage, send, destroy };
}
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceWebSocket(config: ProjectConfig, registry: Registry): Promise<void> {
  const { beDir, feDir } = resolveProjectDirs(config);

  // --- Backend WebSocket handler ---
  if (config.backend) {
    const beStack = config.backend;

    switch (beStack) {
      case "fastapi": {
        const appDir = path.join(beDir, "app");
        await fs.ensureDir(appDir);
        await fs.writeFile(path.join(appDir, "ws.py"), fastapiWs());
        await autoRegisterFastapiRoute(
          beDir,
          "from app.ws import router as ws_router",
          "app.include_router(ws_router)",
        );
        break;
      }
      case "express":
      case "hono": {
        const srcDir = path.join(beDir, "src");
        await fs.ensureDir(srcDir);
        await fs.writeFile(path.join(srcDir, "ws.ts"), expressWs());
        break;
      }
      case "django": {
        const appDir = path.join(beDir, "app");
        await fs.ensureDir(appDir);
        await fs.writeFile(path.join(appDir, "consumers.py"), djangoWs());
        break;
      }
      case "go-chi": {
        const handlersDir = path.join(beDir, "internal", "handlers");
        await fs.ensureDir(handlersDir);
        await fs.writeFile(path.join(handlersDir, "ws.go"), goChiWs());
        break;
      }
      case "axum": {
        const srcDir = path.join(beDir, "src");
        await fs.ensureDir(srcDir);
        await fs.writeFile(path.join(srcDir, "ws.rs"), axumWs());
        break;
      }
      case "aspnet": {
        const handlersDir = path.join(beDir, "Handlers");
        await fs.ensureDir(handlersDir);
        await fs.writeFile(path.join(handlersDir, "WebSocketHandler.cs"), aspnetWs());
        break;
      }
      case "phoenix": {
        const channelsDir = path.join(beDir, "lib", "app_web", "channels");
        await fs.ensureDir(channelsDir);
        await fs.writeFile(path.join(channelsDir, "room_channel.ex"), phoenixWs());
        break;
      }
      case "spring-boot": {
        const configDir = path.join(beDir, "src", "main", "java", "com", "app", "config");
        await fs.ensureDir(configDir);
        await fs.writeFile(path.join(configDir, "WebSocketConfig.java"), springBootWs());
        break;
      }
    }
  }

  // --- Frontend WebSocket hook ---
  if (config.frontend) {
    const feStack = config.frontend;

    if (feStack === "react-vite" || feStack === "nextjs") {
      const hooksDir = path.join(feDir, "src", "hooks");
      await fs.ensureDir(hooksDir);
      await fs.writeFile(path.join(hooksDir, "useWebSocket.ts"), reactUseWebSocket());
    } else if (feStack === "vue") {
      const composablesDir = path.join(feDir, "src", "composables");
      await fs.ensureDir(composablesDir);
      await fs.writeFile(path.join(composablesDir, "useWebSocket.ts"), vueUseWebSocket());
    } else if (feStack === "svelte") {
      const storesDir = path.join(feDir, "src", "stores");
      await fs.ensureDir(storesDir);
      await fs.writeFile(path.join(storesDir, "websocket.ts"), svelteWebSocketStore());
    }
  }
}
