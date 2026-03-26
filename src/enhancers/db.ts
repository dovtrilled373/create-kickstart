import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry, DatabaseChoice } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// Connection configs per database × language
// ---------------------------------------------------------------------------

function pythonPostgresConfig(): string {
  return `"""PostgreSQL connection configuration.

Usage:
  - SQLAlchemy:    pip install sqlalchemy asyncpg psycopg2-binary
  - Django:        pip install psycopg2-binary  (then use DATABASES setting)
  - Raw:           pip install psycopg2-binary

The DATABASE_URL is read from .env — see .env.example for the format.
"""

import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/app",
)

# --- SQLAlchemy (sync) ---
# from sqlalchemy import create_engine
# from sqlalchemy.orm import sessionmaker, DeclarativeBase
#
# engine = create_engine(DATABASE_URL)
# SessionLocal = sessionmaker(bind=engine)
#
# class Base(DeclarativeBase):
#     pass
#
# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()

# --- SQLAlchemy (async) ---
# from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
#
# async_engine = create_async_engine(DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"))
# async_session = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
#
# async def get_async_db():
#     async with async_session() as session:
#         yield session

# --- Raw psycopg ---
# import psycopg2
# conn = psycopg2.connect(DATABASE_URL)
`;
}

function pythonMysqlConfig(): string {
  return `"""MySQL connection configuration.

Usage:
  - SQLAlchemy:    pip install sqlalchemy pymysql
  - Django:        pip install mysqlclient  (then use DATABASES setting)
  - Raw:           pip install pymysql

The DATABASE_URL is read from .env — see .env.example for the format.
"""

import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql://root:root@localhost:3306/app",
)

# --- SQLAlchemy ---
# from sqlalchemy import create_engine
# from sqlalchemy.orm import sessionmaker, DeclarativeBase
#
# engine = create_engine(DATABASE_URL.replace("mysql://", "mysql+pymysql://"))
# SessionLocal = sessionmaker(bind=engine)
#
# class Base(DeclarativeBase):
#     pass
`;
}

function pythonSqliteConfig(): string {
  return `"""SQLite connection configuration.

Zero dependencies — sqlite3 is built into Python.
Great for prototypes and local development.

The DATABASE_URL is read from .env — see .env.example for the format.
"""

import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")

# --- SQLAlchemy ---
# from sqlalchemy import create_engine
# from sqlalchemy.orm import sessionmaker, DeclarativeBase
#
# engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
# SessionLocal = sessionmaker(bind=engine)
#
# class Base(DeclarativeBase):
#     pass

# --- Raw sqlite3 ---
# import sqlite3
# conn = sqlite3.connect("app.db")
`;
}

function pythonMongodbConfig(): string {
  return `"""MongoDB connection configuration.

Usage: pip install pymongo   (or motor for async)

The MONGODB_URI is read from .env — see .env.example for the format.
"""

import os

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "app")

# --- PyMongo (sync) ---
# from pymongo import MongoClient
#
# client = MongoClient(MONGODB_URI)
# db = client[MONGODB_DB]
# items_collection = db["items"]

# --- Motor (async) ---
# from motor.motor_asyncio import AsyncIOMotorClient
#
# client = AsyncIOMotorClient(MONGODB_URI)
# db = client[MONGODB_DB]
`;
}

// ---------------------------------------------------------------------------
// Node.js / TypeScript
// ---------------------------------------------------------------------------

function nodePostgresConfig(): string {
  return `/**
 * PostgreSQL connection configuration.
 *
 * Popular ORMs:
 *   - Prisma:    npx prisma init
 *   - Drizzle:   npm i drizzle-orm pg
 *   - TypeORM:   npm i typeorm pg
 *   - Knex:      npm i knex pg
 *   - Raw:       npm i pg
 *
 * DATABASE_URL is read from .env — see .env.example for the format.
 */

// --- pg (raw) ---
// import pg from "pg";
// const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// export default pool;

// --- Prisma ---
// import { PrismaClient } from "@prisma/client";
// export const prisma = new PrismaClient();

// --- Drizzle + pg ---
// import { drizzle } from "drizzle-orm/node-postgres";
// import pg from "pg";
// const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// export const db = drizzle(pool);

export const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/app";
`;
}

function nodeMysqlConfig(): string {
  return `/**
 * MySQL connection configuration.
 *
 * Popular ORMs:
 *   - Prisma:    npx prisma init --datasource-provider mysql
 *   - Drizzle:   npm i drizzle-orm mysql2
 *   - TypeORM:   npm i typeorm mysql2
 *   - Knex:      npm i knex mysql2
 *   - Raw:       npm i mysql2
 *
 * DATABASE_URL is read from .env — see .env.example for the format.
 */

// --- mysql2 (raw) ---
// import mysql from "mysql2/promise";
// export const pool = mysql.createPool(process.env.DATABASE_URL ?? "mysql://root:root@localhost:3306/app");

export const DATABASE_URL = process.env.DATABASE_URL ?? "mysql://root:root@localhost:3306/app";
`;
}

function nodeSqliteConfig(): string {
  return `/**
 * SQLite connection configuration.
 *
 * Popular ORMs:
 *   - Prisma:    npx prisma init --datasource-provider sqlite
 *   - Drizzle:   npm i drizzle-orm better-sqlite3
 *   - better-sqlite3: npm i better-sqlite3
 *
 * Zero external services — great for prototypes.
 */

// --- better-sqlite3 ---
// import Database from "better-sqlite3";
// export const db = new Database("app.db");

// --- Drizzle + better-sqlite3 ---
// import { drizzle } from "drizzle-orm/better-sqlite3";
// import Database from "better-sqlite3";
// const sqlite = new Database("app.db");
// export const db = drizzle(sqlite);

export const DATABASE_URL = process.env.DATABASE_URL ?? "file:./app.db";
`;
}

function nodeMongodbConfig(): string {
  return `/**
 * MongoDB connection configuration.
 *
 * Usage:
 *   - Mongoose:   npm i mongoose
 *   - MongoDB:    npm i mongodb
 *   - Prisma:     npx prisma init --datasource-provider mongodb
 *
 * MONGODB_URI is read from .env — see .env.example for the format.
 */

// --- Mongoose ---
// import mongoose from "mongoose";
// await mongoose.connect(process.env.MONGODB_URI ?? "mongodb://localhost:27017/app");

// --- Native driver ---
// import { MongoClient } from "mongodb";
// const client = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017");
// const db = client.db("app");

export const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/app";
`;
}

// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------

function goPostgresConfig(): string {
  return `package database

// PostgreSQL connection configuration.
//
// Popular drivers/ORMs:
//   - pgx:   go get github.com/jackc/pgx/v5
//   - sqlx:  go get github.com/jmoiron/sqlx
//   - GORM:  go get gorm.io/gorm gorm.io/driver/postgres
//   - Ent:   go get entgo.io/ent
//
// DATABASE_URL is read from .env — see .env.example for the format.

import "os"

func GetDatabaseURL() string {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return "postgresql://postgres:postgres@localhost:5432/app?sslmode=disable"
	}
	return url
}

// --- pgx ---
// import (
// 	"context"
// 	"github.com/jackc/pgx/v5/pgxpool"
// )
// pool, err := pgxpool.New(context.Background(), GetDatabaseURL())

// --- GORM ---
// import (
// 	"gorm.io/gorm"
// 	"gorm.io/driver/postgres"
// )
// db, err := gorm.Open(postgres.Open(GetDatabaseURL()), &gorm.Config{})
`;
}

function goMysqlConfig(): string {
  return `package database

import "os"

func GetDatabaseURL() string {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return "root:root@tcp(localhost:3306)/app"
	}
	return url
}

// --- GORM ---
// import (
// 	"gorm.io/gorm"
// 	"gorm.io/driver/mysql"
// )
// db, err := gorm.Open(mysql.Open(GetDatabaseURL()), &gorm.Config{})
`;
}

function goSqliteConfig(): string {
  return `package database

import "os"

func GetDatabaseURL() string {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return "app.db"
	}
	return url
}

// --- GORM ---
// import (
// 	"gorm.io/gorm"
// 	"gorm.io/driver/sqlite"
// )
// db, err := gorm.Open(sqlite.Open(GetDatabaseURL()), &gorm.Config{})
`;
}

function goMongodbConfig(): string {
  return `package database

import "os"

func GetMongoURI() string {
	uri := os.Getenv("MONGODB_URI")
	if uri == "" {
		return "mongodb://localhost:27017"
	}
	return uri
}

func GetMongoDBName() string {
	name := os.Getenv("MONGODB_DB")
	if name == "" {
		return "app"
	}
	return name
}

// --- Official driver ---
// import "go.mongodb.org/mongo-driver/mongo"
// import "go.mongodb.org/mongo-driver/mongo/options"
//
// client, err := mongo.Connect(context.TODO(), options.Client().ApplyURI(GetMongoURI()))
// db := client.Database(GetMongoDBName())
`;
}

// ---------------------------------------------------------------------------
// Java / Spring Boot
// ---------------------------------------------------------------------------

function springBootDbProperties(db: DatabaseChoice): string {
  switch (db) {
    case "postgres":
      return `# PostgreSQL
# Add to pom.xml: org.postgresql:postgresql
spring.datasource.url=\${DATABASE_URL:jdbc:postgresql://localhost:5432/app}
spring.datasource.username=\${POSTGRES_USER:postgres}
spring.datasource.password=\${POSTGRES_PASSWORD:postgres}
spring.datasource.driver-class-name=org.postgresql.Driver
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
`;
    case "mysql":
      return `# MySQL
# Add to pom.xml: com.mysql:mysql-connector-j
spring.datasource.url=\${DATABASE_URL:jdbc:mysql://localhost:3306/app}
spring.datasource.username=\${MYSQL_USER:root}
spring.datasource.password=\${MYSQL_PASSWORD:root}
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
spring.jpa.hibernate.ddl-auto=update
`;
    case "sqlite":
      return `# SQLite
# Add to pom.xml: org.xerial:sqlite-jdbc + org.hibernate.orm:hibernate-community-dialects
spring.datasource.url=jdbc:sqlite:app.db
spring.datasource.driver-class-name=org.sqlite.JDBC
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.dialect=org.hibernate.community.dialect.SQLiteDialect
`;
    case "mongodb":
      return `# MongoDB
# Add to pom.xml: spring-boot-starter-data-mongodb
spring.data.mongodb.uri=\${MONGODB_URI:mongodb://localhost:27017/app}
`;
  }
}

// ---------------------------------------------------------------------------
// Docker compose services
// ---------------------------------------------------------------------------

function dockerComposeService(db: DatabaseChoice): string {
  switch (db) {
    case "postgres":
      return `  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: \${POSTGRES_DB:-app}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
`;
    case "mysql":
      return `  mysql:
    image: mysql:8.0
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD:-root}
      MYSQL_DATABASE: \${MYSQL_DATABASE:-app}
    ports:
      - "3306:3306"
    volumes:
      - mysqldata:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 5
`;
    case "sqlite":
      return ""; // No service needed
    case "mongodb":
      return `  mongodb:
    image: mongo:7
    restart: unless-stopped
    environment:
      MONGO_INITDB_DATABASE: \${MONGODB_DB:-app}
    ports:
      - "27017:27017"
    volumes:
      - mongodata:/data/db
`;
  }
}

function dockerComposeVolume(db: DatabaseChoice): string {
  switch (db) {
    case "postgres":
      return "  pgdata:\n";
    case "mysql":
      return "  mysqldata:\n";
    case "mongodb":
      return "  mongodata:\n";
    case "sqlite":
      return "";
  }
}

// ---------------------------------------------------------------------------
// .env vars per database
// ---------------------------------------------------------------------------

function envVars(db: DatabaseChoice): string {
  switch (db) {
    case "postgres":
      return `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=app`;
    case "mysql":
      return `DATABASE_URL=mysql://root:root@localhost:3306/app
MYSQL_ROOT_PASSWORD=root
MYSQL_DATABASE=app`;
    case "sqlite":
      return `DATABASE_URL=sqlite:///./app.db`;
    case "mongodb":
      return `MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=app`;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceDb(config: ProjectConfig, registry: Registry): Promise<void> {
  const { targetDir, type } = config;
  const db = config.database ?? "postgres"; // Default to postgres for backwards compat
  const isFullstack = type === "fullstack";

  // --- Write connection config per backend language ---
  if (config.backend) {
    const beEntry = getRegistryEntry(registry, "backend", config.backend);
    const beDir = isFullstack ? path.join(targetDir, "backend") : targetDir;

    if (beEntry.lang === "python") {
      const appDir = path.join(beDir, "app");
      await fs.ensureDir(appDir);
      const configFn = { postgres: pythonPostgresConfig, mysql: pythonMysqlConfig, sqlite: pythonSqliteConfig, mongodb: pythonMongodbConfig }[db];
      await fs.writeFile(path.join(appDir, "database.py"), configFn());
    } else if (beEntry.lang === "typescript") {
      const libDir = path.join(beDir, "src", "lib");
      await fs.ensureDir(libDir);
      const configFn = { postgres: nodePostgresConfig, mysql: nodeMysqlConfig, sqlite: nodeSqliteConfig, mongodb: nodeMongodbConfig }[db];
      await fs.writeFile(path.join(libDir, "database.ts"), configFn());
    } else if (beEntry.lang === "go") {
      const dbDir = path.join(beDir, "internal", "database");
      await fs.ensureDir(dbDir);
      const configFn = { postgres: goPostgresConfig, mysql: goMysqlConfig, sqlite: goSqliteConfig, mongodb: goMongodbConfig }[db];
      await fs.writeFile(path.join(dbDir, "database.go"), configFn());
    } else if (beEntry.lang === "java") {
      // For Spring Boot, append to application.properties
      const propsPath = path.join(beDir, "src", "main", "resources", "application.properties");
      if (await fs.pathExists(propsPath)) {
        const existing = await fs.readFile(propsPath, "utf-8");
        if (!existing.includes("spring.datasource") && !existing.includes("spring.data.mongodb")) {
          await fs.appendFile(propsPath, "\n" + springBootDbProperties(db));
        }
      }
    }
  }

  // For standalone Python projects
  if (config.standalone) {
    const saEntry = getRegistryEntry(registry, "standalone", config.standalone);
    if (saEntry.lang === "python") {
      const appDir = path.join(targetDir, "app");
      await fs.ensureDir(appDir);
      const configFn = { postgres: pythonPostgresConfig, mysql: pythonMysqlConfig, sqlite: pythonSqliteConfig, mongodb: pythonMongodbConfig }[db];
      await fs.writeFile(path.join(appDir, "database.py"), configFn());
    }
  }

  // --- Append DB env vars to .env.example ---
  const envExample = path.join(targetDir, ".env.example");
  if (await fs.pathExists(envExample)) {
    const contents = await fs.readFile(envExample, "utf-8");
    const vars = envVars(db);
    // Only add if the primary var isn't already there
    const primaryVar = db === "mongodb" ? "MONGODB_URI" : "DATABASE_URL";
    if (!contents.includes(primaryVar)) {
      await fs.appendFile(envExample, `\n# Database (${db})\n${vars}\n`);
    }
  }

  // --- Export docker helpers for docker enhancer to use ---
  // Write a .db-meta.json so docker enhancer can pick it up
  await fs.writeJson(path.join(targetDir, ".db-meta.json"), {
    database: db,
    service: dockerComposeService(db),
    volume: dockerComposeVolume(db),
  });
}

// Re-export for docker enhancer
export { dockerComposeService, dockerComposeVolume };
export type { DatabaseChoice };
