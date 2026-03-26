import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";
import { resolveProjectDirs, appendEnvVars, autoRegisterFastapiRoute } from "./utils.js";

// ---------------------------------------------------------------------------
// Backend: FastAPI
// ---------------------------------------------------------------------------

function fastapiAuthModels(): string {
  return `from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: str
    password: str
    name: str = ""

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
`;
}

function fastapiAuthRouter(): string {
  return `from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import hashlib
import secrets
import jwt
import os
from datetime import datetime, timedelta
from .models import UserCreate, UserLogin, UserResponse, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# In-memory user store (replace with database in production)
_users: dict[str, dict] = {}

def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def _create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id not in _users:
            raise HTTPException(status_code=401, detail="User not found")
        return _users[user_id]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(payload: UserCreate):
    for user in _users.values():
        if user["email"] == payload.email:
            raise HTTPException(status_code=409, detail="Email already registered")
    user_id = secrets.token_hex(16)
    _users[user_id] = {
        "id": user_id,
        "email": payload.email,
        "name": payload.name,
        "password_hash": _hash_password(payload.password),
    }
    return TokenResponse(access_token=_create_token(user_id, payload.email))

@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    for user in _users.values():
        if user["email"] == payload.email and user["password_hash"] == _hash_password(payload.password):
            return TokenResponse(access_token=_create_token(user["id"], user["email"]))
    raise HTTPException(status_code=401, detail="Invalid email or password")

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(id=current_user["id"], email=current_user["email"], name=current_user["name"])
`;
}

// ---------------------------------------------------------------------------
// Backend: Express
// ---------------------------------------------------------------------------

function expressAuthRouter(): string {
  return `import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

const users = new Map<string, User>();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function createToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: "24h" });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ detail: "Missing token" });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as any;
    (req as any).user = users.get(payload.sub);
    if (!(req as any).user) return res.status(401).json({ detail: "User not found" });
    next();
  } catch {
    return res.status(401).json({ detail: "Invalid token" });
  }
}

router.post("/register", (req: Request, res: Response) => {
  const { email, password, name = "" } = req.body;
  for (const u of users.values()) {
    if (u.email === email) return res.status(409).json({ detail: "Email already registered" });
  }
  const id = crypto.randomUUID();
  users.set(id, { id, email, name, passwordHash: hashPassword(password) });
  res.status(201).json({ access_token: createToken(id, email), token_type: "bearer" });
});

router.post("/login", (req: Request, res: Response) => {
  const { email, password } = req.body;
  for (const u of users.values()) {
    if (u.email === email && u.passwordHash === hashPassword(password)) {
      return res.json({ access_token: createToken(u.id, u.email), token_type: "bearer" });
    }
  }
  res.status(401).json({ detail: "Invalid email or password" });
});

router.get("/me", authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({ id: user.id, email: user.email, name: user.name });
});

export default router;
`;
}

// ---------------------------------------------------------------------------
// Backend: Go Chi
// ---------------------------------------------------------------------------

function goChiAuthHandler(): string {
  return `package auth

import (
\t"crypto/rand"
\t"crypto/sha256"
\t"encoding/hex"
\t"encoding/json"
\t"fmt"
\t"net/http"
\t"os"
\t"strings"
\t"time"

\t"github.com/go-chi/chi/v5"
\t"github.com/golang-jwt/jwt/v5"
)

var jwtSecret = []byte(getEnv("JWT_SECRET", "change-me-in-production"))

func getEnv(key, fallback string) string {
\tif v := os.Getenv(key); v != "" {
\t\treturn v
\t}
\treturn fallback
}

type User struct {
\tID           string \`json:"id"\`
\tEmail        string \`json:"email"\`
\tName         string \`json:"name"\`
\tPasswordHash string \`json:"-"\`
}

type UserCreate struct {
\tEmail    string \`json:"email"\`
\tPassword string \`json:"password"\`
\tName     string \`json:"name"\`
}

type UserLogin struct {
\tEmail    string \`json:"email"\`
\tPassword string \`json:"password"\`
}

type TokenResponse struct {
\tAccessToken string \`json:"access_token"\`
\tTokenType   string \`json:"token_type"\`
}

type UserResponse struct {
\tID    string \`json:"id"\`
\tEmail string \`json:"email"\`
\tName  string \`json:"name"\`
}

var users = map[string]*User{}

func hashPassword(password string) string {
\th := sha256.Sum256([]byte(password))
\treturn hex.EncodeToString(h[:])
}

func randomHex(n int) string {
\tb := make([]byte, n)
\trand.Read(b)
\treturn hex.EncodeToString(b)
}

func createToken(userID, email string) (string, error) {
\tclaims := jwt.MapClaims{
\t\t"sub":   userID,
\t\t"email": email,
\t\t"exp":   time.Now().Add(24 * time.Hour).Unix(),
\t}
\ttoken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
\treturn token.SignedString(jwtSecret)
}

// AuthMiddleware validates the JWT token and sets the user in context.
func AuthMiddleware(next http.Handler) http.Handler {
\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
\t\theader := r.Header.Get("Authorization")
\t\tif !strings.HasPrefix(header, "Bearer ") {
\t\t\thttp.Error(w, \`{"detail":"Missing token"}\`, http.StatusUnauthorized)
\t\t\treturn
\t\t}
\t\ttokenStr := strings.TrimPrefix(header, "Bearer ")
\t\ttoken, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
\t\t\tif _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
\t\t\t\treturn nil, fmt.Errorf("unexpected signing method")
\t\t\t}
\t\t\treturn jwtSecret, nil
\t\t})
\t\tif err != nil || !token.Valid {
\t\t\thttp.Error(w, \`{"detail":"Invalid token"}\`, http.StatusUnauthorized)
\t\t\treturn
\t\t}
\t\tclaims, ok := token.Claims.(jwt.MapClaims)
\t\tif !ok {
\t\t\thttp.Error(w, \`{"detail":"Invalid token"}\`, http.StatusUnauthorized)
\t\t\treturn
\t\t}
\t\tuserID, _ := claims["sub"].(string)
\t\tif _, exists := users[userID]; !exists {
\t\t\thttp.Error(w, \`{"detail":"User not found"}\`, http.StatusUnauthorized)
\t\t\treturn
\t\t}
\t\t// Store user ID in header for downstream handlers
\t\tr.Header.Set("X-User-ID", userID)
\t\tnext.ServeHTTP(w, r)
\t})
}

// Router returns a chi router with auth routes for /api/auth.
func Router() chi.Router {
\tr := chi.NewRouter()
\tr.Post("/register", register)
\tr.Post("/login", login)
\tr.With(AuthMiddleware).Get("/me", getMe)
\treturn r
}

func register(w http.ResponseWriter, r *http.Request) {
\tvar payload UserCreate
\tif err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
\t\thttp.Error(w, err.Error(), http.StatusBadRequest)
\t\treturn
\t}
\tfor _, u := range users {
\t\tif u.Email == payload.Email {
\t\t\tw.WriteHeader(http.StatusConflict)
\t\t\tjson.NewEncoder(w).Encode(map[string]string{"detail": "Email already registered"})
\t\t\treturn
\t\t}
\t}
\tid := randomHex(16)
\tusers[id] = &User{
\t\tID:           id,
\t\tEmail:        payload.Email,
\t\tName:         payload.Name,
\t\tPasswordHash: hashPassword(payload.Password),
\t}
\ttoken, _ := createToken(id, payload.Email)
\tw.WriteHeader(http.StatusCreated)
\tjson.NewEncoder(w).Encode(TokenResponse{AccessToken: token, TokenType: "bearer"})
}

func login(w http.ResponseWriter, r *http.Request) {
\tvar payload UserLogin
\tif err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
\t\thttp.Error(w, err.Error(), http.StatusBadRequest)
\t\treturn
\t}
\tfor _, u := range users {
\t\tif u.Email == payload.Email && u.PasswordHash == hashPassword(payload.Password) {
\t\t\ttoken, _ := createToken(u.ID, u.Email)
\t\t\tjson.NewEncoder(w).Encode(TokenResponse{AccessToken: token, TokenType: "bearer"})
\t\t\treturn
\t\t}
\t}
\tw.WriteHeader(http.StatusUnauthorized)
\tjson.NewEncoder(w).Encode(map[string]string{"detail": "Invalid email or password"})
}

func getMe(w http.ResponseWriter, r *http.Request) {
\tuserID := r.Header.Get("X-User-ID")
\tu := users[userID]
\tjson.NewEncoder(w).Encode(UserResponse{ID: u.ID, Email: u.Email, Name: u.Name})
}
`;
}

// ---------------------------------------------------------------------------
// Backend: Axum (Rust)
// ---------------------------------------------------------------------------

function axumAuthHandler(): string {
  return `use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    email: String,
    exp: usize,
}

#[derive(Debug, Clone, Serialize)]
struct User {
    id: String,
    email: String,
    name: String,
    #[serde(skip_serializing)]
    password_hash: String,
}

#[derive(Debug, Deserialize)]
pub struct UserCreate {
    pub email: String,
    pub password: String,
    #[serde(default)]
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct UserLogin {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
struct TokenResponse {
    access_token: String,
    token_type: String,
}

#[derive(Debug, Serialize)]
struct UserResponse {
    id: String,
    email: String,
    name: String,
}

type UserStore = Arc<Mutex<HashMap<String, User>>>;

fn jwt_secret() -> String {
    std::env::var("JWT_SECRET").unwrap_or_else(|_| "change-me-in-production".to_string())
}

fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn create_token(user_id: &str, email: &str) -> Result<String, StatusCode> {
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(24))
        .unwrap()
        .timestamp() as usize;
    let claims = Claims { sub: user_id.to_string(), email: email.to_string(), exp: expiration };
    encode(&Header::default(), &claims, &EncodingKey::from_secret(jwt_secret().as_bytes()))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

pub fn auth_router() -> Router {
    let store: UserStore = Arc::new(Mutex::new(HashMap::new()));
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/me", get(get_me))
        .with_state(store)
}

async fn register(
    State(store): State<UserStore>,
    Json(payload): Json<UserCreate>,
) -> Result<(StatusCode, Json<TokenResponse>), StatusCode> {
    let mut users = store.lock().unwrap();
    if users.values().any(|u| u.email == payload.email) {
        return Err(StatusCode::CONFLICT);
    }
    let id = Uuid::new_v4().to_string();
    let user = User {
        id: id.clone(),
        email: payload.email.clone(),
        name: payload.name,
        password_hash: hash_password(&payload.password),
    };
    users.insert(id.clone(), user);
    let token = create_token(&id, &payload.email)?;
    Ok((StatusCode::CREATED, Json(TokenResponse { access_token: token, token_type: "bearer".into() })))
}

async fn login(
    State(store): State<UserStore>,
    Json(payload): Json<UserLogin>,
) -> Result<Json<TokenResponse>, StatusCode> {
    let users = store.lock().unwrap();
    let hash = hash_password(&payload.password);
    for user in users.values() {
        if user.email == payload.email && user.password_hash == hash {
            let token = create_token(&user.id, &user.email)?;
            return Ok(Json(TokenResponse { access_token: token, token_type: "bearer".into() }));
        }
    }
    Err(StatusCode::UNAUTHORIZED)
}

async fn get_me(
    State(store): State<UserStore>,
    headers: HeaderMap,
) -> Result<Json<UserResponse>, StatusCode> {
    let auth_header = headers.get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;
    if !auth_header.starts_with("Bearer ") {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let token = &auth_header[7..];
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret().as_bytes()),
        &Validation::default(),
    ).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let users = store.lock().unwrap();
    let user = users.get(&data.claims.sub).ok_or(StatusCode::UNAUTHORIZED)?;
    Ok(Json(UserResponse { id: user.id.clone(), email: user.email.clone(), name: user.name.clone() }))
}
`;
}

// ---------------------------------------------------------------------------
// Backend: ASP.NET (C#)
// ---------------------------------------------------------------------------

function aspnetAuthEndpoints(): string {
  return `using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.IdentityModel.Tokens;

public record AuthUserCreate(string Email, string Password, string Name = "");
public record AuthUserLogin(string Email, string Password);
public record AuthTokenResponse(string AccessToken, string TokenType = "bearer");
public record AuthUserResponse(string Id, string Email, string Name);

public static class AuthEndpoints
{
    private static readonly Dictionary<string, (string Id, string Email, string Name, string PasswordHash)> _users = new();
    private static string JwtSecret => Environment.GetEnvironmentVariable("JWT_SECRET") ?? "change-me-in-production";

    private static string HashPassword(string password)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        return Convert.ToHexString(bytes).ToLower();
    }

    private static string CreateToken(string userId, string email)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[] { new Claim("sub", userId), new Claim("email", email) };
        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddHours(24),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static void MapAuthEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/register", (AuthUserCreate payload) =>
        {
            if (_users.Values.Any(u => u.Email == payload.Email))
                return Results.Conflict(new { detail = "Email already registered" });
            var id = Guid.NewGuid().ToString();
            _users[id] = (id, payload.Email, payload.Name, HashPassword(payload.Password));
            return Results.Created($"/api/auth/me", new AuthTokenResponse(CreateToken(id, payload.Email)));
        });

        group.MapPost("/login", (AuthUserLogin payload) =>
        {
            var hash = HashPassword(payload.Password);
            var user = _users.Values.FirstOrDefault(u => u.Email == payload.Email && u.PasswordHash == hash);
            if (user == default) return Results.Unauthorized();
            return Results.Ok(new AuthTokenResponse(CreateToken(user.Id, user.Email)));
        });

        group.MapGet("/me", (HttpContext ctx) =>
        {
            var auth = ctx.Request.Headers.Authorization.ToString();
            if (!auth.StartsWith("Bearer ")) return Results.Unauthorized();
            try
            {
                var handler = new JwtSecurityTokenHandler();
                var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
                var principal = handler.ValidateToken(auth[7..], new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    IssuerSigningKey = key,
                }, out _);
                var userId = principal.FindFirst("sub")?.Value;
                if (userId == null || !_users.ContainsKey(userId)) return Results.Unauthorized();
                var user = _users[userId];
                return Results.Ok(new AuthUserResponse(user.Id, user.Email, user.Name));
            }
            catch { return Results.Unauthorized(); }
        });
    }
}
`;
}

// ---------------------------------------------------------------------------
// Backend: Phoenix (Elixir — Guardian)
// ---------------------------------------------------------------------------

function phoenixAuthController(): string {
  return `defmodule AppWeb.AuthController do
  use AppWeb, :controller

  @jwt_secret System.get_env("JWT_SECRET", "change-me-in-production")

  def start_link(_opts) do
    Agent.start_link(fn -> %{} end, name: __MODULE__)
  end

  def init(_) do
    unless Process.whereis(__MODULE__) do
      Agent.start_link(fn -> %{} end, name: __MODULE__)
    end
    :ok
  end

  defp hash_password(password) do
    :crypto.hash(:sha256, password) |> Base.encode16(case: :lower)
  end

  defp create_token(user_id, email) do
    header = Base.url_encode64(Jason.encode!(%{alg: "HS256", typ: "JWT"}), padding: false)
    payload = Base.url_encode64(Jason.encode!(%{
      sub: user_id,
      email: email,
      exp: System.system_time(:second) + 86400
    }), padding: false)
    signature = :crypto.mac(:hmac, :sha256, @jwt_secret, header <> "." <> payload)
                |> Base.url_encode64(padding: false)
    header <> "." <> payload <> "." <> signature
  end

  defp verify_token(token) do
    case String.split(token, ".") do
      [header, payload, signature] ->
        expected = :crypto.mac(:hmac, :sha256, @jwt_secret, header <> "." <> payload)
                   |> Base.url_encode64(padding: false)
        if expected == signature do
          {:ok, Jason.decode!(Base.url_decode64!(payload, padding: false))}
        else
          {:error, :invalid}
        end
      _ -> {:error, :invalid}
    end
  end

  def register(conn, %{"email" => email, "password" => password} = params) do
    users = Agent.get(__MODULE__, & &1)
    if Enum.any?(Map.values(users), fn u -> u.email == email end) do
      conn |> put_status(:conflict) |> json(%{detail: "Email already registered"})
    else
      id = Ecto.UUID.generate()
      user = %{id: id, email: email, name: params["name"] || "", password_hash: hash_password(password)}
      Agent.update(__MODULE__, fn users -> Map.put(users, id, user) end)
      token = create_token(id, email)
      conn |> put_status(:created) |> json(%{access_token: token, token_type: "bearer"})
    end
  end

  def login(conn, %{"email" => email, "password" => password}) do
    users = Agent.get(__MODULE__, & &1)
    hash = hash_password(password)
    case Enum.find(Map.values(users), fn u -> u.email == email and u.password_hash == hash end) do
      nil -> conn |> put_status(:unauthorized) |> json(%{detail: "Invalid email or password"})
      user ->
        token = create_token(user.id, user.email)
        json(conn, %{access_token: token, token_type: "bearer"})
    end
  end

  def me(conn, _params) do
    with ["Bearer " <> token] <- get_req_header(conn, "authorization"),
         {:ok, claims} <- verify_token(token),
         users <- Agent.get(__MODULE__, & &1),
         user when not is_nil(user) <- Map.get(users, claims["sub"]) do
      json(conn, %{id: user.id, email: user.email, name: user.name})
    else
      _ -> conn |> put_status(:unauthorized) |> json(%{detail: "Invalid token"})
    end
  end
end
`;
}

// ---------------------------------------------------------------------------
// Frontend: auth lib
// ---------------------------------------------------------------------------

function frontendAuthLib(): string {
  return `import { api } from "./api";

interface AuthResponse {
  access_token: string;
  token_type: string;
}

interface User {
  id: string;
  email: string;
  name: string;
}

const TOKEN_KEY = "kickstart_token";

export const auth = {
  getToken(): string | null {
    return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  isLoggedIn(): boolean {
    return !!this.getToken();
  },

  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>("/auth/register", { email, password, name });
    this.setToken(res.access_token);
    return res;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>("/auth/login", { email, password });
    this.setToken(res.access_token);
    return res;
  },

  async getMe(): Promise<User> {
    const token = this.getToken();
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: \`Bearer \${token}\` },
    });
    if (!res.ok) throw new Error("Not authenticated");
    return res.json();
  },

  logout() {
    this.clearToken();
  },
};
`;
}

// ---------------------------------------------------------------------------
// Frontend: React AuthForm
// ---------------------------------------------------------------------------

function reactAuthForm(): string {
  return `"use client";

import { useState } from "react";
import { auth } from "../lib/auth";

export function AuthForm({ onAuth }: { onAuth: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isLogin) {
        await auth.login(email, password);
      } else {
        await auth.register(email, password, name);
      }
      onAuth();
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "2rem auto", padding: "2rem" }}>
      <h2>{isLogin ? "Login" : "Register"}</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ display: "block", width: "100%", marginBottom: "0.5rem", padding: "0.5rem" }} />
        )}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ display: "block", width: "100%", marginBottom: "0.5rem", padding: "0.5rem" }} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ display: "block", width: "100%", marginBottom: "0.5rem", padding: "0.5rem" }} />
        <button type="submit" style={{ width: "100%", padding: "0.5rem", cursor: "pointer" }}>{isLogin ? "Login" : "Register"}</button>
      </form>
      <p style={{ textAlign: "center", marginTop: "1rem" }}>
        <button onClick={() => setIsLogin(!isLogin)} style={{ background: "none", border: "none", color: "blue", cursor: "pointer" }}>
          {isLogin ? "Need an account? Register" : "Have an account? Login"}
        </button>
      </p>
    </div>
  );
}
`;
}

// ---------------------------------------------------------------------------
// Frontend: Vue AuthForm
// ---------------------------------------------------------------------------

function vueAuthForm(): string {
  return `<script setup lang="ts">
import { ref } from "vue";
import { auth } from "../lib/auth";

const emit = defineEmits<{ auth: [] }>();

const isLogin = ref(true);
const email = ref("");
const password = ref("");
const name = ref("");
const error = ref("");

async function handleSubmit() {
  error.value = "";
  try {
    if (isLogin.value) {
      await auth.login(email.value, password.value);
    } else {
      await auth.register(email.value, password.value, name.value);
    }
    emit("auth");
  } catch (err: any) {
    error.value = err.message || "Authentication failed";
  }
}
</script>

<template>
  <div style="max-width: 400px; margin: 2rem auto; padding: 2rem">
    <h2>{{ isLogin ? "Login" : "Register" }}</h2>
    <p v-if="error" style="color: red">{{ error }}</p>
    <form @submit.prevent="handleSubmit">
      <input v-if="!isLogin" type="text" placeholder="Name" v-model="name" style="display: block; width: 100%; margin-bottom: 0.5rem; padding: 0.5rem" />
      <input type="email" placeholder="Email" v-model="email" required style="display: block; width: 100%; margin-bottom: 0.5rem; padding: 0.5rem" />
      <input type="password" placeholder="Password" v-model="password" required style="display: block; width: 100%; margin-bottom: 0.5rem; padding: 0.5rem" />
      <button type="submit" style="width: 100%; padding: 0.5rem; cursor: pointer">{{ isLogin ? "Login" : "Register" }}</button>
    </form>
    <p style="text-align: center; margin-top: 1rem">
      <button @click="isLogin = !isLogin" style="background: none; border: none; color: blue; cursor: pointer">
        {{ isLogin ? "Need an account? Register" : "Have an account? Login" }}
      </button>
    </p>
  </div>
</template>
`;
}

// ---------------------------------------------------------------------------
// Frontend: Svelte AuthForm
// ---------------------------------------------------------------------------

function svelteAuthForm(): string {
  return `<script lang="ts">
  import { auth } from "../lib/auth";

  export let onAuth: () => void;

  let isLogin = true;
  let email = "";
  let password = "";
  let name = "";
  let error = "";

  async function handleSubmit() {
    error = "";
    try {
      if (isLogin) {
        await auth.login(email, password);
      } else {
        await auth.register(email, password, name);
      }
      onAuth();
    } catch (err: any) {
      error = err.message || "Authentication failed";
    }
  }
</script>

<div style="max-width: 400px; margin: 2rem auto; padding: 2rem">
  <h2>{isLogin ? "Login" : "Register"}</h2>
  {#if error}
    <p style="color: red">{error}</p>
  {/if}
  <form on:submit|preventDefault={handleSubmit}>
    {#if !isLogin}
      <input type="text" placeholder="Name" bind:value={name} style="display: block; width: 100%; margin-bottom: 0.5rem; padding: 0.5rem" />
    {/if}
    <input type="email" placeholder="Email" bind:value={email} required style="display: block; width: 100%; margin-bottom: 0.5rem; padding: 0.5rem" />
    <input type="password" placeholder="Password" bind:value={password} required style="display: block; width: 100%; margin-bottom: 0.5rem; padding: 0.5rem" />
    <button type="submit" style="width: 100%; padding: 0.5rem; cursor: pointer">{isLogin ? "Login" : "Register"}</button>
  </form>
  <p style="text-align: center; margin-top: 1rem">
    <button on:click={() => (isLogin = !isLogin)} style="background: none; border: none; color: blue; cursor: pointer">
      {isLogin ? "Need an account? Register" : "Have an account? Login"}
    </button>
  </p>
</div>
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceAuth(
  config: ProjectConfig,
  registry: Registry,
): Promise<void> {
  const feStack = config.frontend;
  const beStack = config.backend;
  const { feDir, beDir } = resolveProjectDirs(config);

  // --- A) Backend auth endpoints ---
  if (beStack) {
    const beEntry = getRegistryEntry(registry, "backend", beStack);

    switch (beStack) {
      case "fastapi": {
        const authDir = path.join(beDir, "app", "auth");
        await fs.ensureDir(authDir);
        await fs.writeFile(path.join(authDir, "__init__.py"), "");
        await fs.writeFile(path.join(authDir, "models.py"), fastapiAuthModels());
        await fs.writeFile(path.join(authDir, "router.py"), fastapiAuthRouter());

        // Add pyjwt to requirements.txt
        const reqFile = path.join(beDir, "requirements.txt");
        if (await fs.pathExists(reqFile)) {
          const contents = await fs.readFile(reqFile, "utf-8");
          if (!contents.includes("pyjwt")) {
            await fs.appendFile(reqFile, "\npyjwt\n");
          }
        }
        // Auto-register auth router in main.py
        await autoRegisterFastapiRoute(beDir, "from app.auth.router import router as auth_router", "app.include_router(auth_router)");
        break;
      }
      case "express":
      case "hono": {
        const authDir = path.join(beDir, "src", "auth");
        await fs.ensureDir(authDir);
        await fs.writeFile(path.join(authDir, "router.ts"), expressAuthRouter());

        // Add jsonwebtoken to package.json dependencies
        const pkgFile = path.join(beDir, "package.json");
        if (await fs.pathExists(pkgFile)) {
          const pkg = await fs.readJson(pkgFile);
          if (!pkg.dependencies) pkg.dependencies = {};
          if (!pkg.dependencies.jsonwebtoken) {
            pkg.dependencies.jsonwebtoken = "^9.0.0";
          }
          if (!pkg.devDependencies) pkg.devDependencies = {};
          if (!pkg.devDependencies["@types/jsonwebtoken"]) {
            pkg.devDependencies["@types/jsonwebtoken"] = "^9.0.0";
          }
          await fs.writeJson(pkgFile, pkg, { spaces: 2 });
        }
        break;
      }
      case "go-chi": {
        const authDir = path.join(beDir, "internal", "auth");
        await fs.ensureDir(authDir);
        await fs.writeFile(path.join(authDir, "handler.go"), goChiAuthHandler());
        break;
      }
      case "axum": {
        await fs.ensureDir(path.join(beDir, "src", "auth"));
        await fs.writeFile(path.join(beDir, "src", "auth", "mod.rs"), axumAuthHandler());

        // Add dependencies to Cargo.toml if it exists
        const cargoFile = path.join(beDir, "Cargo.toml");
        if (await fs.pathExists(cargoFile)) {
          const contents = await fs.readFile(cargoFile, "utf-8");
          if (!contents.includes("jsonwebtoken")) {
            await fs.appendFile(cargoFile, `\njsonwebtoken = "9"\nsha2 = "0.10"\nchrono = { version = "0.4", features = ["serde"] }\n`);
          }
        }
        break;
      }
      case "aspnet": {
        await fs.ensureDir(path.join(beDir, "Auth"));
        await fs.writeFile(path.join(beDir, "Auth", "AuthEndpoints.cs"), aspnetAuthEndpoints());
        break;
      }
      case "phoenix": {
        await fs.ensureDir(path.join(beDir, "lib", "app_web", "controllers"));
        await fs.writeFile(
          path.join(beDir, "lib", "app_web", "controllers", "auth_controller.ex"),
          phoenixAuthController(),
        );
        break;
      }
    }
  }

  // --- B) Frontend auth components ---
  if (feStack) {
    const libDir = path.join(feDir, "src", "lib");
    const compDir = path.join(feDir, "src", "components");
    await fs.ensureDir(libDir);
    await fs.ensureDir(compDir);

    // Auth lib (shared across all React-like frontends)
    await fs.writeFile(path.join(libDir, "auth.ts"), frontendAuthLib());

    switch (feStack) {
      case "nextjs":
      case "react-vite":
        await fs.writeFile(path.join(compDir, "AuthForm.tsx"), reactAuthForm());
        break;
      case "vue":
        await fs.writeFile(path.join(compDir, "AuthForm.vue"), vueAuthForm());
        break;
      case "svelte":
        await fs.writeFile(path.join(compDir, "AuthForm.svelte"), svelteAuthForm());
        break;
    }
  }

  // --- C) Append JWT_SECRET to .env.example ---
  await appendEnvVars(config.targetDir, "JWT_SECRET", "\nJWT_SECRET=change-me-in-production\n");
}
