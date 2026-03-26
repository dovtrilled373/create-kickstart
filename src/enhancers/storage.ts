import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";
import { resolveProjectDirs, appendEnvVars } from "./utils.js";

// ---------------------------------------------------------------------------
// Backend upload endpoint per language
// ---------------------------------------------------------------------------

function pythonUpload(): string {
  return `"""S3-compatible file upload with presigned URLs.

Usage: pip install boto3

Environment variables (see .env.example):
  S3_BUCKET, S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
"""

import os
import boto3
from botocore.config import Config

S3_BUCKET = os.getenv("S3_BUCKET", "uploads")
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")

s3 = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "minioadmin"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "minioadmin"),
    config=Config(signature_version="s3v4"),
)


def generate_presigned_upload(key: str, content_type: str = "application/octet-stream", expires_in: int = 3600) -> str:
    """Generate a presigned URL for uploading a file to S3."""
    return s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": S3_BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=expires_in,
    )


def generate_presigned_download(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned URL for downloading a file from S3."""
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )
`;
}

function tsUpload(): string {
  return `/**
 * S3-compatible file upload with presigned URLs.
 *
 * Usage: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 *
 * Environment variables (see .env.example):
 *   S3_BUCKET, S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const S3_BUCKET = process.env.S3_BUCKET ?? "uploads";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "minioadmin",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "minioadmin",
  },
  forcePathStyle: true,
});

export async function generatePresignedUpload(
  key: string,
  contentType = "application/octet-stream",
  expiresIn = 3600,
): Promise<string> {
  const command = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(s3, command, { expiresIn });
}

export async function generatePresignedDownload(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}

export { s3, S3_BUCKET };
`;
}

function goUpload(): string {
  return `package storage

// S3-compatible file upload with presigned URLs.
//
// Usage: go get github.com/aws/aws-sdk-go-v2/... (config, credentials, service/s3)
//
// Environment variables (see .env.example):
//   S3_BUCKET, S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

import (
	"context"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func NewS3Client() *s3.Client {
	return s3.New(s3.Options{
		BaseEndpoint: aws.String(getEnv("S3_ENDPOINT", "http://localhost:9000")),
		Region:       "us-east-1",
		Credentials:  credentials.NewStaticCredentialsProvider(
			getEnv("AWS_ACCESS_KEY_ID", "minioadmin"),
			getEnv("AWS_SECRET_ACCESS_KEY", "minioadmin"),
			"",
		),
		UsePathStyle: true,
	})
}

func GeneratePresignedUpload(ctx context.Context, key, contentType string, expiresIn time.Duration) (string, error) {
	client := NewS3Client()
	presigner := s3.NewPresignClient(client)
	bucket := getEnv("S3_BUCKET", "uploads")

	req, err := presigner.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      &bucket,
		Key:         &key,
		ContentType: &contentType,
	}, s3.WithPresignExpires(expiresIn))
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

func GeneratePresignedDownload(ctx context.Context, key string, expiresIn time.Duration) (string, error) {
	client := NewS3Client()
	presigner := s3.NewPresignClient(client)
	bucket := getEnv("S3_BUCKET", "uploads")

	req, err := presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: &bucket,
		Key:    &key,
	}, s3.WithPresignExpires(expiresIn))
	if err != nil {
		return "", err
	}
	return req.URL, nil
}
`;
}

function rustUpload(): string {
  return `//! S3-compatible file upload with presigned URLs.
//!
//! Add to Cargo.toml:
//!   aws-sdk-s3 = "1"
//!   aws-config = "1"
//!   aws-credential-types = "1"

use aws_sdk_s3::{Client, Config};
use aws_sdk_s3::config::{Credentials, Region};
use aws_sdk_s3::presigning::PresigningConfig;
use std::env;
use std::time::Duration;

fn get_env(key: &str, fallback: &str) -> String {
    env::var(key).unwrap_or_else(|_| fallback.into())
}

pub fn new_s3_client() -> Client {
    let creds = Credentials::new(
        get_env("AWS_ACCESS_KEY_ID", "minioadmin"),
        get_env("AWS_SECRET_ACCESS_KEY", "minioadmin"),
        None, None, "env",
    );
    let config = Config::builder()
        .endpoint_url(get_env("S3_ENDPOINT", "http://localhost:9000"))
        .region(Region::new("us-east-1"))
        .credentials_provider(creds)
        .force_path_style(true)
        .build();
    Client::from_conf(config)
}

pub async fn generate_presigned_upload(key: &str, content_type: &str, expires_in: Duration) -> Result<String, Box<dyn std::error::Error>> {
    let client = new_s3_client();
    let bucket = get_env("S3_BUCKET", "uploads");
    let presigning = PresigningConfig::expires_in(expires_in)?;
    let req = client.put_object().bucket(&bucket).key(key).content_type(content_type).presigned(presigning).await?;
    Ok(req.uri().to_string())
}

pub async fn generate_presigned_download(key: &str, expires_in: Duration) -> Result<String, Box<dyn std::error::Error>> {
    let client = new_s3_client();
    let bucket = get_env("S3_BUCKET", "uploads");
    let presigning = PresigningConfig::expires_in(expires_in)?;
    let req = client.get_object().bucket(&bucket).key(key).presigned(presigning).await?;
    Ok(req.uri().to_string())
}
`;
}

function csharpUpload(): string {
  return `// S3-compatible file upload with presigned URLs.
//
// Add NuGet package: AWSSDK.S3
// Environment variables (see .env.example):
//   S3_BUCKET, S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

using System;
using Amazon.S3;
using Amazon.S3.Model;

namespace App.Services;

public class UploadService
{
    private static readonly string Bucket = Environment.GetEnvironmentVariable("S3_BUCKET") ?? "uploads";

    private static AmazonS3Client CreateClient()
    {
        var config = new AmazonS3Config
        {
            ServiceURL = Environment.GetEnvironmentVariable("S3_ENDPOINT") ?? "http://localhost:9000",
            ForcePathStyle = true,
        };
        return new AmazonS3Client(
            Environment.GetEnvironmentVariable("AWS_ACCESS_KEY_ID") ?? "minioadmin",
            Environment.GetEnvironmentVariable("AWS_SECRET_ACCESS_KEY") ?? "minioadmin",
            config
        );
    }

    public static string GeneratePresignedUpload(string key, string contentType = "application/octet-stream", int expiresInSeconds = 3600)
    {
        using var client = CreateClient();
        var request = new GetPreSignedUrlRequest
        {
            BucketName = Bucket,
            Key = key,
            Verb = HttpVerb.PUT,
            ContentType = contentType,
            Expires = DateTime.UtcNow.AddSeconds(expiresInSeconds),
        };
        return client.GetPreSignedURL(request);
    }

    public static string GeneratePresignedDownload(string key, int expiresInSeconds = 3600)
    {
        using var client = CreateClient();
        var request = new GetPreSignedUrlRequest
        {
            BucketName = Bucket,
            Key = key,
            Verb = HttpVerb.GET,
            Expires = DateTime.UtcNow.AddSeconds(expiresInSeconds),
        };
        return client.GetPreSignedURL(request);
    }
}
`;
}

function elixirUpload(): string {
  return `defmodule App.Storage.Upload do
  @moduledoc """
  S3-compatible file upload with presigned URLs using ExAws.

  Add to mix.exs deps: {:ex_aws, "~> 2.5"}, {:ex_aws_s3, "~> 2.5"}

  Environment variables (see .env.example):
    S3_BUCKET, S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
  """

  def generate_presigned_upload(key, content_type \\\\ "application/octet-stream", expires_in \\\\ 3600) do
    bucket = System.get_env("S3_BUCKET", "uploads")

    {:ok, url} =
      ExAws.S3.presigned_url(ExAws.Config.new(:s3, s3_config()), :put, bucket, key,
        expires_in: expires_in,
        headers: [{"Content-Type", content_type}]
      )

    url
  end

  def generate_presigned_download(key, expires_in \\\\ 3600) do
    bucket = System.get_env("S3_BUCKET", "uploads")

    {:ok, url} =
      ExAws.S3.presigned_url(ExAws.Config.new(:s3, s3_config()), :get, bucket, key,
        expires_in: expires_in
      )

    url
  end

  defp s3_config do
    [
      access_key_id: System.get_env("AWS_ACCESS_KEY_ID", "minioadmin"),
      secret_access_key: System.get_env("AWS_SECRET_ACCESS_KEY", "minioadmin"),
      host: System.get_env("S3_ENDPOINT", "http://localhost:9000") |> URI.parse() |> Map.get(:host),
      scheme: "http://",
      region: "us-east-1"
    ]
  end
end
`;
}

// ---------------------------------------------------------------------------
// Frontend upload components
// ---------------------------------------------------------------------------

function reactFileUpload(): string {
  return `import { useState, useCallback, DragEvent, ChangeEvent } from "react";

interface FileUploadProps {
  uploadUrl?: string;
  onUploadComplete?: (key: string) => void;
}

export function FileUpload({ uploadUrl = "/api/upload", onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setProgress(\`Uploading \${file.name}...\`);

    try {
      // 1. Get presigned URL from backend
      const res = await fetch(\`\${uploadUrl}?filename=\${encodeURIComponent(file.name)}&contentType=\${encodeURIComponent(file.type)}\`);
      const { url, key } = await res.json();

      // 2. Upload directly to S3
      await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      setProgress(\`Uploaded \${file.name}\`);
      onUploadComplete?.(key);
    } catch (err) {
      setProgress(\`Failed to upload \${file.name}\`);
    } finally {
      setUploading(false);
    }
  }, [uploadUrl, onUploadComplete]);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      style={{
        border: \`2px dashed \${isDragging ? "#4f46e5" : "#d1d5db"}\`,
        borderRadius: "8px",
        padding: "2rem",
        textAlign: "center",
        cursor: "pointer",
        transition: "border-color 0.2s",
      }}
    >
      <input type="file" onChange={onFileChange} style={{ display: "none" }} id="file-upload" />
      <label htmlFor="file-upload" style={{ cursor: "pointer" }}>
        {uploading ? progress : "Drag & drop a file here, or click to select"}
      </label>
      {progress && !uploading && <p>{progress}</p>}
    </div>
  );
}
`;
}

function vueFileUpload(): string {
  return `<template>
  <div
    @dragover.prevent="isDragging = true"
    @dragleave="isDragging = false"
    @drop.prevent="onDrop"
    :style="{
      border: \`2px dashed \${isDragging ? '#4f46e5' : '#d1d5db'}\`,
      borderRadius: '8px',
      padding: '2rem',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'border-color 0.2s',
    }"
  >
    <input type="file" @change="onFileChange" style="display: none" ref="fileInput" />
    <span @click="($refs.fileInput as HTMLInputElement)?.click()">
      {{ uploading ? progress : 'Drag & drop a file here, or click to select' }}
    </span>
    <p v-if="progress && !uploading">{{ progress }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(defineProps<{
  uploadUrl?: string;
}>(), { uploadUrl: "/api/upload" });

const emit = defineEmits<{
  uploadComplete: [key: string];
}>();

const isDragging = ref(false);
const uploading = ref(false);
const progress = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

async function handleUpload(file: File) {
  uploading.value = true;
  progress.value = \`Uploading \${file.name}...\`;

  try {
    const res = await fetch(\`\${props.uploadUrl}?filename=\${encodeURIComponent(file.name)}&contentType=\${encodeURIComponent(file.type)}\`);
    const { url, key } = await res.json();

    await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

    progress.value = \`Uploaded \${file.name}\`;
    emit("uploadComplete", key);
  } catch {
    progress.value = \`Failed to upload \${file.name}\`;
  } finally {
    uploading.value = false;
  }
}

function onDrop(e: DragEvent) {
  isDragging.value = false;
  const file = e.dataTransfer?.files[0];
  if (file) handleUpload(file);
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) handleUpload(file);
}
</script>
`;
}

function svelteFileUpload(): string {
  return `<script lang="ts">
  export let uploadUrl = "/api/upload";
  export let onUploadComplete: ((key: string) => void) | undefined = undefined;

  let isDragging = false;
  let uploading = false;
  let progress: string | null = null;
  let fileInput: HTMLInputElement;

  async function handleUpload(file: File) {
    uploading = true;
    progress = \`Uploading \${file.name}...\`;

    try {
      const res = await fetch(\`\${uploadUrl}?filename=\${encodeURIComponent(file.name)}&contentType=\${encodeURIComponent(file.type)}\`);
      const { url, key } = await res.json();

      await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      progress = \`Uploaded \${file.name}\`;
      onUploadComplete?.(key);
    } catch {
      progress = \`Failed to upload \${file.name}\`;
    } finally {
      uploading = false;
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) handleUpload(file);
  }

  function onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) handleUpload(file);
  }
</script>

<div
  on:dragover|preventDefault={() => (isDragging = true)}
  on:dragleave={() => (isDragging = false)}
  on:drop={onDrop}
  style="border: 2px dashed {isDragging ? '#4f46e5' : '#d1d5db'}; border-radius: 8px; padding: 2rem; text-align: center; cursor: pointer; transition: border-color 0.2s;"
>
  <input type="file" on:change={onFileChange} style="display: none" bind:this={fileInput} />
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <span on:click={() => fileInput.click()}>
    {uploading ? progress : 'Drag & drop a file here, or click to select'}
  </span>
  {#if progress && !uploading}
    <p>{progress}</p>
  {/if}
</div>
`;
}

// ---------------------------------------------------------------------------
// Bucket creation script
// ---------------------------------------------------------------------------

function createBucketScript(): string {
  return `#!/usr/bin/env bash
# Create the default S3 bucket in MinIO.
#
# Prerequisites:
#   - MinIO running on localhost:9000 (docker-compose up)
#   - mc (MinIO Client) installed: https://min.io/docs/minio/linux/reference/minio-mc.html
#
# Usage: bash scripts/create-bucket.sh

set -euo pipefail

ENDPOINT="\${S3_ENDPOINT:-http://localhost:9000}"
ACCESS_KEY="\${AWS_ACCESS_KEY_ID:-minioadmin}"
SECRET_KEY="\${AWS_SECRET_ACCESS_KEY:-minioadmin}"
BUCKET="\${S3_BUCKET:-uploads}"

echo "Configuring MinIO client..."
mc alias set local "$ENDPOINT" "$ACCESS_KEY" "$SECRET_KEY"

if mc ls "local/$BUCKET" > /dev/null 2>&1; then
  echo "Bucket '$BUCKET' already exists."
else
  mc mb "local/$BUCKET"
  echo "Bucket '$BUCKET' created."
fi
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceStorage(config: ProjectConfig, registry: Registry): Promise<void> {
  const { beDir, feDir } = resolveProjectDirs(config);

  // --- Backend upload module ---
  if (config.backend) {
    const beEntry = getRegistryEntry(registry, "backend", config.backend);
    const lang = beEntry.lang;

    if (lang === "python") {
      const appDir = path.join(beDir, "app");
      await fs.ensureDir(appDir);
      await fs.writeFile(path.join(appDir, "upload.py"), pythonUpload());
    } else if (lang === "typescript") {
      const libDir = path.join(beDir, "src", "lib");
      await fs.ensureDir(libDir);
      await fs.writeFile(path.join(libDir, "upload.ts"), tsUpload());
    } else if (lang === "go") {
      const storageDir = path.join(beDir, "internal", "storage");
      await fs.ensureDir(storageDir);
      await fs.writeFile(path.join(storageDir, "upload.go"), goUpload());
    } else if (lang === "rust") {
      const srcDir = path.join(beDir, "src");
      await fs.ensureDir(srcDir);
      await fs.writeFile(path.join(srcDir, "upload.rs"), rustUpload());
    } else if (lang === "csharp") {
      const svcDir = path.join(beDir, "Services");
      await fs.ensureDir(svcDir);
      await fs.writeFile(path.join(svcDir, "UploadService.cs"), csharpUpload());
    } else if (lang === "elixir") {
      const libDir = path.join(beDir, "lib", "app", "storage");
      await fs.ensureDir(libDir);
      await fs.writeFile(path.join(libDir, "upload.ex"), elixirUpload());
    }
  }

  // --- Frontend upload component ---
  if (config.frontend) {
    const feStack = config.frontend;

    if (feStack === "react-vite" || feStack === "nextjs") {
      const compDir = path.join(feDir, "src", "components");
      await fs.ensureDir(compDir);
      await fs.writeFile(path.join(compDir, "FileUpload.tsx"), reactFileUpload());
    } else if (feStack === "vue") {
      const compDir = path.join(feDir, "src", "components");
      await fs.ensureDir(compDir);
      await fs.writeFile(path.join(compDir, "FileUpload.vue"), vueFileUpload());
    } else if (feStack === "svelte") {
      const compDir = path.join(feDir, "src", "components");
      await fs.ensureDir(compDir);
      await fs.writeFile(path.join(compDir, "FileUpload.svelte"), svelteFileUpload());
    }
  }

  // --- Bucket creation script ---
  const scriptsDir = path.join(config.targetDir, "scripts");
  await fs.ensureDir(scriptsDir);
  const scriptPath = path.join(scriptsDir, "create-bucket.sh");
  await fs.writeFile(scriptPath, createBucketScript());
  await fs.chmod(scriptPath, 0o755);

  // --- Append S3 env vars ---
  await appendEnvVars(
    config.targetDir,
    "S3_BUCKET",
    "\n# S3 / MinIO storage\nS3_BUCKET=uploads\nS3_ENDPOINT=http://localhost:9000\nAWS_ACCESS_KEY_ID=minioadmin\nAWS_SECRET_ACCESS_KEY=minioadmin\n",
  );
}
