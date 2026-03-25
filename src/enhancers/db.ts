import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// Database connection config for Python backends
// ---------------------------------------------------------------------------

const pythonDatabasePy = `"""Database connection configuration."""

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/app",
)


# --- SQLAlchemy (async) example ---
# Uncomment below if using SQLAlchemy:
#
# from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
#
# engine = create_async_engine(DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"))
# async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
#
# @asynccontextmanager
# async def get_db() -> AsyncGenerator[AsyncSession, None]:
#     async with async_session() as session:
#         yield session


# --- Simple psycopg example ---
# Uncomment below if using psycopg directly:
#
# import psycopg
#
# def get_connection():
#     return psycopg.connect(DATABASE_URL)
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceDb(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir, type } = config;

  // Add database.py to Python backends
  if (config.backend) {
    const beEntry = getRegistryEntry(registry, "backend", config.backend);
    if (beEntry.lang === "python") {
      const beDir = type === "fullstack" ? path.join(targetDir, "backend") : targetDir;
      const appDir = path.join(beDir, "app");
      await fs.ensureDir(appDir);
      await fs.writeFile(path.join(appDir, "database.py"), pythonDatabasePy);
    }
  }

  // For standalone Python projects
  if (config.standalone) {
    const saEntry = getRegistryEntry(registry, "standalone", config.standalone);
    if (saEntry.lang === "python") {
      const appDir = path.join(targetDir, "app");
      await fs.ensureDir(appDir);
      await fs.writeFile(path.join(appDir, "database.py"), pythonDatabasePy);
    }
  }

  // Note: The Postgres docker-compose service is handled by docker.ts
  // when both "docker" and "db" enhancements are selected.
}
