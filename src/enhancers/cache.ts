import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";
import { resolveProjectDirs, appendEnvVars } from "./utils.js";

// ---------------------------------------------------------------------------
// Redis client helpers per language
// ---------------------------------------------------------------------------

function pythonCache(): string {
  return `"""Redis cache helper.

Usage: pip install redis

Provides simple get / set / delete wrappers around a Redis connection.
REDIS_URL is read from .env — see .env.example for the format.
"""

import os
import json
from typing import Any, Optional

import redis

_client: Optional[redis.Redis] = None


def _get_client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379"),
            decode_responses=True,
        )
    return _client


def cache_get(key: str) -> Optional[Any]:
    """Return the cached value for *key*, or None if missing."""
    val = _get_client().get(key)
    if val is None:
        return None
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return val


def cache_set(key: str, value: Any, ttl: int = 3600) -> None:
    """Store *value* under *key* with a TTL (seconds)."""
    _get_client().set(key, json.dumps(value), ex=ttl)


def cache_del(key: str) -> None:
    """Delete *key* from the cache."""
    _get_client().delete(key)
`;
}

function tsCache(): string {
  return `/**
 * Redis cache helper.
 *
 * Usage: npm install ioredis
 *
 * Provides simple get / set / delete wrappers around an ioredis connection.
 * REDIS_URL is read from .env — see .env.example for the format.
 */

import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const val = await redis.get(key);
  if (val === null) return null;
  try {
    return JSON.parse(val) as T;
  } catch {
    return val as unknown as T;
  }
}

export async function cacheSet(key: string, value: unknown, ttl = 3600): Promise<void> {
  await redis.set(key, JSON.stringify(value), "EX", ttl);
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

export { redis };
`;
}

function goCache(): string {
  return `package cache

// Redis cache helper.
//
// Usage: go get github.com/redis/go-redis/v9
//
// REDIS_URL is read from the environment — see .env.example.

import (
	"context"
	"encoding/json"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

var ctx = context.Background()

func newClient() *redis.Client {
	url := os.Getenv("REDIS_URL")
	if url == "" {
		url = "redis://localhost:6379"
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		panic(err)
	}
	return redis.NewClient(opts)
}

var Client = newClient()

func CacheGet(key string, dest interface{}) error {
	val, err := Client.Get(ctx, key).Result()
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(val), dest)
}

func CacheSet(key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return Client.Set(ctx, key, data, ttl).Err()
}

func CacheDel(key string) error {
	return Client.Del(ctx, key).Err()
}
`;
}

function rustCache(): string {
  return `//! Redis cache helper.
//!
//! Add to Cargo.toml:
//!   redis = { version = "0.25", features = ["tokio-comp"] }
//!   serde_json = "1"

use redis::{AsyncCommands, Client};
use std::env;

pub fn get_client() -> Client {
    let url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());
    Client::open(url).expect("Invalid REDIS_URL")
}

pub async fn cache_get(key: &str) -> redis::RedisResult<Option<String>> {
    let client = get_client();
    let mut conn = client.get_multiplexed_async_connection().await?;
    conn.get(key).await
}

pub async fn cache_set(key: &str, value: &str, ttl_secs: u64) -> redis::RedisResult<()> {
    let client = get_client();
    let mut conn = client.get_multiplexed_async_connection().await?;
    conn.set_ex(key, value, ttl_secs).await
}

pub async fn cache_del(key: &str) -> redis::RedisResult<()> {
    let client = get_client();
    let mut conn = client.get_multiplexed_async_connection().await?;
    conn.del(key).await
}
`;
}

function csharpCache(): string {
  return `// Redis cache helper.
//
// Add NuGet package: StackExchange.Redis
// REDIS_URL is read from environment — see .env.example.

using System;
using System.Text.Json;
using StackExchange.Redis;

namespace App.Services;

public class CacheService
{
    private readonly IDatabase _db;

    public CacheService()
    {
        var url = Environment.GetEnvironmentVariable("REDIS_URL") ?? "localhost:6379";
        var connection = ConnectionMultiplexer.Connect(url);
        _db = connection.GetDatabase();
    }

    public T? CacheGet<T>(string key)
    {
        var val = _db.StringGet(key);
        if (val.IsNullOrEmpty) return default;
        return JsonSerializer.Deserialize<T>(val!);
    }

    public void CacheSet<T>(string key, T value, int ttlSeconds = 3600)
    {
        var json = JsonSerializer.Serialize(value);
        _db.StringSet(key, json, TimeSpan.FromSeconds(ttlSeconds));
    }

    public void CacheDel(string key)
    {
        _db.KeyDelete(key);
    }
}
`;
}

function elixirCache(): string {
  return `defmodule App.Cache do
  @moduledoc """
  Redis cache helper using Redix.

  Add to mix.exs deps: {:redix, "~> 1.3"}

  REDIS_URL is read from environment — see .env.example.
  """

  @default_url "redis://localhost:6379"

  def start_link(opts \\\\ []) do
    url = System.get_env("REDIS_URL", @default_url)
    Redix.start_link(url, Keyword.merge([name: __MODULE__], opts))
  end

  def cache_get(key) do
    case Redix.command(__MODULE__, ["GET", key]) do
      {:ok, nil} -> nil
      {:ok, val} -> Jason.decode!(val)
      {:error, _} = err -> err
    end
  end

  def cache_set(key, value, ttl \\\\ 3600) do
    Redix.command(__MODULE__, ["SET", key, Jason.encode!(value), "EX", to_string(ttl)])
  end

  def cache_del(key) do
    Redix.command(__MODULE__, ["DEL", key])
  end
end
`;
}

function javaCache(): string {
  return `package com.app.services;

// Redis cache helper using Jedis.
//
// Add to pom.xml: redis.clients:jedis
// REDIS_URL is read from environment — see .env.example.

import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;
import com.fasterxml.jackson.databind.ObjectMapper;

public class CacheService {
    private static final String REDIS_URL = System.getenv("REDIS_URL") != null
            ? System.getenv("REDIS_URL")
            : "redis://localhost:6379";
    private static final JedisPool pool = new JedisPool(REDIS_URL);
    private static final ObjectMapper mapper = new ObjectMapper();

    public static <T> T cacheGet(String key, Class<T> clazz) {
        try (Jedis jedis = pool.getResource()) {
            String val = jedis.get(key);
            if (val == null) return null;
            return mapper.readValue(val, clazz);
        } catch (Exception e) {
            return null;
        }
    }

    public static void cacheSet(String key, Object value, int ttl) {
        try (Jedis jedis = pool.getResource()) {
            jedis.setex(key, ttl, mapper.writeValueAsString(value));
        } catch (Exception e) {
            throw new RuntimeException("Cache set failed", e);
        }
    }

    public static void cacheDel(String key) {
        try (Jedis jedis = pool.getResource()) {
            jedis.del(key);
        }
    }
}
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceCache(config: ProjectConfig, registry: Registry): Promise<void> {
  const { beDir } = resolveProjectDirs(config);

  if (config.backend) {
    const beEntry = getRegistryEntry(registry, "backend", config.backend);
    const lang = beEntry.lang;

    if (lang === "python") {
      const appDir = path.join(beDir, "app");
      await fs.ensureDir(appDir);
      await fs.writeFile(path.join(appDir, "cache.py"), pythonCache());
    } else if (lang === "typescript") {
      const libDir = path.join(beDir, "src", "lib");
      await fs.ensureDir(libDir);
      await fs.writeFile(path.join(libDir, "cache.ts"), tsCache());
    } else if (lang === "go") {
      const cacheDir = path.join(beDir, "internal", "cache");
      await fs.ensureDir(cacheDir);
      await fs.writeFile(path.join(cacheDir, "cache.go"), goCache());
    } else if (lang === "rust") {
      const srcDir = path.join(beDir, "src");
      await fs.ensureDir(srcDir);
      await fs.writeFile(path.join(srcDir, "cache.rs"), rustCache());
    } else if (lang === "csharp") {
      const svcDir = path.join(beDir, "Services");
      await fs.ensureDir(svcDir);
      await fs.writeFile(path.join(svcDir, "CacheService.cs"), csharpCache());
    } else if (lang === "elixir") {
      const libDir = path.join(beDir, "lib", "app");
      await fs.ensureDir(libDir);
      await fs.writeFile(path.join(libDir, "cache.ex"), elixirCache());
    } else if (lang === "java") {
      const svcDir = path.join(beDir, "src", "main", "java", "com", "app", "services");
      await fs.ensureDir(svcDir);
      await fs.writeFile(path.join(svcDir, "CacheService.java"), javaCache());
    }
  }

  // Append REDIS_URL to .env.example
  await appendEnvVars(
    config.targetDir,
    "REDIS_URL",
    "\n# Redis cache\nREDIS_URL=redis://localhost:6379\n",
  );
}
