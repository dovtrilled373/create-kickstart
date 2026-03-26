import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry, AnalyticsProvider } from "../types.js";
import { getRegistryEntry } from "../registry.js";
import { resolveProjectDirs, appendEnvVars } from "./utils.js";

// ---------------------------------------------------------------------------
// SDK init snippets per provider × platform
// ---------------------------------------------------------------------------

// --- PostHog ---
function posthogNodeInit(): string {
  return `/**
 * PostHog Analytics — Node.js / Backend
 *
 * Install: npm i posthog-node
 * Docs: https://posthog.com/docs/libraries/node
 */
import { PostHog } from "posthog-node";

const posthog = new PostHog(process.env.POSTHOG_API_KEY ?? "", {
  host: process.env.POSTHOG_HOST ?? "https://app.posthog.com",
});

export function trackEvent(distinctId: string, event: string, properties?: Record<string, unknown>) {
  posthog.capture({ distinctId, event, properties });
}

export function identifyUser(distinctId: string, properties?: Record<string, unknown>) {
  posthog.identify({ distinctId, properties });
}

// Call on server shutdown
export async function shutdownAnalytics() {
  await posthog.shutdown();
}

export default posthog;
`;
}

function posthogPythonInit(): string {
  return `"""
PostHog Analytics — Python / Backend

Install: pip install posthog
Docs: https://posthog.com/docs/libraries/python
"""

import os
import posthog

posthog.project_api_key = os.getenv("POSTHOG_API_KEY", "")
posthog.host = os.getenv("POSTHOG_HOST", "https://app.posthog.com")


def track_event(distinct_id: str, event: str, properties: dict | None = None):
    posthog.capture(distinct_id, event, properties or {})


def identify_user(distinct_id: str, properties: dict | None = None):
    posthog.identify(distinct_id, properties or {})
`;
}

function posthogReactInit(): string {
  return `/**
 * PostHog Analytics — React / Frontend
 *
 * Install: npm i posthog-js
 * Docs: https://posthog.com/docs/libraries/js
 *
 * Wrap your app:
 *   import { PostHogProvider } from "./lib/analytics";
 *   <PostHogProvider><App /></PostHogProvider>
 */
import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_API_KEY ?? "";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST ?? "https://app.posthog.com";

if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
  });
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  posthog.identify(userId, properties);
}

export { posthog };
export default posthog;
`;
}

function posthogMobileInit(): string {
  return `/**
 * PostHog Analytics — React Native / Mobile
 *
 * Install: npm i posthog-react-native
 * Docs: https://posthog.com/docs/libraries/react-native
 */
import PostHog from "posthog-react-native";

const posthog = new PostHog(process.env.POSTHOG_API_KEY ?? "", {
  host: process.env.POSTHOG_HOST ?? "https://app.posthog.com",
});

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  posthog.identify(userId, properties);
}

export default posthog;
`;
}

// --- CleverTap ---
function clevertapNodeInit(): string {
  return `/**
 * CleverTap Analytics — Node.js / Backend
 *
 * Install: npm i clevertap
 * Docs: https://developer.clevertap.com/docs/node
 */
const CleverTap = require("clevertap");

const clevertap = CleverTap.init(
  process.env.CLEVERTAP_ACCOUNT_ID ?? "",
  process.env.CLEVERTAP_PASSCODE ?? "",
);

export function trackEvent(identity: string, event: string, properties?: Record<string, unknown>) {
  clevertap.upload([{
    type: "event",
    identity,
    evtName: event,
    evtData: properties ?? {},
  }]);
}

export function identifyUser(identity: string, profileData: Record<string, unknown>) {
  clevertap.upload([{
    type: "profile",
    identity,
    profileData,
  }]);
}

export default clevertap;
`;
}

function clevertapPythonInit(): string {
  return `"""
CleverTap Analytics — Python / Backend

Install: pip install clevertap-server-api
Docs: https://developer.clevertap.com/docs/python
"""

import os
from clevertap import CleverTap

clevertap = CleverTap(
    account_id=os.getenv("CLEVERTAP_ACCOUNT_ID", ""),
    passcode=os.getenv("CLEVERTAP_PASSCODE", ""),
)


def track_event(identity: str, event: str, properties: dict | None = None):
    clevertap.up([{
        "type": "event",
        "identity": identity,
        "evtName": event,
        "evtData": properties or {},
    }])


def identify_user(identity: str, profile_data: dict):
    clevertap.up([{
        "type": "profile",
        "identity": identity,
        "profileData": profile_data,
    }])
`;
}

function clevertapReactInit(): string {
  return `/**
 * CleverTap Analytics — React / Frontend (Web SDK)
 *
 * Install: npm i clevertap-web-sdk
 * Docs: https://developer.clevertap.com/docs/web
 */
import clevertap from "clevertap-web-sdk";

const CLEVERTAP_ACCOUNT_ID = import.meta.env.VITE_CLEVERTAP_ACCOUNT_ID ?? "";

if (CLEVERTAP_ACCOUNT_ID) {
  clevertap.init(CLEVERTAP_ACCOUNT_ID);
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  clevertap.event.push(event, properties);
}

export function identifyUser(profileData: Record<string, unknown>) {
  clevertap.onUserLogin.push({ Site: profileData });
}

export default clevertap;
`;
}

// --- MoEngage ---
function moengageNodeInit(): string {
  return `/**
 * MoEngage Analytics — Node.js / Backend
 *
 * MoEngage doesn't have an official Node.js SDK.
 * Use their REST API for server-side events.
 * Docs: https://developers.moengage.com/hc/en-us/articles/4414882810132
 */

const MOENGAGE_APP_ID = process.env.MOENGAGE_APP_ID ?? "";
const MOENGAGE_API_KEY = process.env.MOENGAGE_API_KEY ?? "";
const MOENGAGE_API_URL = process.env.MOENGAGE_API_URL ?? "https://api-01.moengage.com";

export async function trackEvent(userId: string, event: string, properties?: Record<string, unknown>) {
  await fetch(\`\${MOENGAGE_API_URL}/v1/event\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "MOE-APPKEY": MOENGAGE_APP_ID,
      Authorization: \`Basic \${Buffer.from(\`\${MOENGAGE_APP_ID}:\${MOENGAGE_API_KEY}\`).toString("base64")}\`,
    },
    body: JSON.stringify({
      type: "event",
      customer_id: userId,
      actions: [{ action: event, attributes: properties ?? {} }],
    }),
  });
}
`;
}

function moengagePythonInit(): string {
  return `"""
MoEngage Analytics — Python / Backend

MoEngage doesn't have an official Python SDK.
Use their REST API for server-side events.
Docs: https://developers.moengage.com/hc/en-us/articles/4414882810132
"""

import os
import base64
import httpx

MOENGAGE_APP_ID = os.getenv("MOENGAGE_APP_ID", "")
MOENGAGE_API_KEY = os.getenv("MOENGAGE_API_KEY", "")
MOENGAGE_API_URL = os.getenv("MOENGAGE_API_URL", "https://api-01.moengage.com")


def _auth_header() -> str:
    token = base64.b64encode(f"{MOENGAGE_APP_ID}:{MOENGAGE_API_KEY}".encode()).decode()
    return f"Basic {token}"


async def track_event(user_id: str, event: str, properties: dict | None = None):
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{MOENGAGE_API_URL}/v1/event",
            headers={
                "Content-Type": "application/json",
                "MOE-APPKEY": MOENGAGE_APP_ID,
                "Authorization": _auth_header(),
            },
            json={
                "type": "event",
                "customer_id": user_id,
                "actions": [{"action": event, "attributes": properties or {}}],
            },
        )
`;
}

function moengageReactInit(): string {
  return `/**
 * MoEngage Analytics — React / Frontend (Web SDK)
 *
 * Add to index.html: <script src="https://cdn.moengage.com/webpush/releases/sdk_loader.js"></script>
 * Docs: https://developers.moengage.com/hc/en-us/categories/4414482016916-Web
 */

const MOENGAGE_APP_ID = import.meta.env.VITE_MOENGAGE_APP_ID ?? "";

// Initialize in your app entry point
export function initMoEngage() {
  if (typeof window !== "undefined" && (window as any).Moengage) {
    (window as any).Moengage.initialize({ app_id: MOENGAGE_APP_ID });
  }
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window !== "undefined" && (window as any).Moengage) {
    (window as any).Moengage.track_event(event, properties);
  }
}

export function identifyUser(userId: string) {
  if (typeof window !== "undefined" && (window as any).Moengage) {
    (window as any).Moengage.add_unique_user_id(userId);
  }
}
`;
}

// --- Mixpanel ---
function mixpanelNodeInit(): string {
  return `/**
 * Mixpanel Analytics — Node.js / Backend
 *
 * Install: npm i mixpanel
 * Docs: https://developer.mixpanel.com/docs/nodejs
 */
import Mixpanel from "mixpanel";

const mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN ?? "");

export function trackEvent(distinctId: string, event: string, properties?: Record<string, unknown>) {
  mixpanel.track(event, { distinct_id: distinctId, ...properties });
}

export function identifyUser(distinctId: string, properties?: Record<string, unknown>) {
  mixpanel.people.set(distinctId, properties ?? {});
}

export default mixpanel;
`;
}

function mixpanelPythonInit(): string {
  return `"""
Mixpanel Analytics — Python / Backend

Install: pip install mixpanel
Docs: https://developer.mixpanel.com/docs/python
"""

import os
from mixpanel import Mixpanel

mp = Mixpanel(os.getenv("MIXPANEL_TOKEN", ""))


def track_event(distinct_id: str, event: str, properties: dict | None = None):
    mp.track(distinct_id, event, properties or {})


def identify_user(distinct_id: str, properties: dict | None = None):
    mp.people_set(distinct_id, properties or {})
`;
}

function mixpanelReactInit(): string {
  return `/**
 * Mixpanel Analytics — React / Frontend
 *
 * Install: npm i mixpanel-browser
 * Docs: https://developer.mixpanel.com/docs/javascript-quickstart
 */
import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN ?? "";

if (MIXPANEL_TOKEN) {
  mixpanel.init(MIXPANEL_TOKEN, { track_pageview: true });
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  mixpanel.track(event, properties);
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  mixpanel.identify(userId);
  if (properties) mixpanel.people.set(properties);
}

export default mixpanel;
`;
}

// --- Segment ---
function segmentNodeInit(): string {
  return `/**
 * Segment Analytics — Node.js / Backend
 *
 * Install: npm i @segment/analytics-node
 * Docs: https://segment.com/docs/connections/sources/catalog/libraries/server/node/
 */
import { Analytics } from "@segment/analytics-node";

const analytics = new Analytics({ writeKey: process.env.SEGMENT_WRITE_KEY ?? "" });

export function trackEvent(userId: string, event: string, properties?: Record<string, unknown>) {
  analytics.track({ userId, event, properties });
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  analytics.identify({ userId, traits });
}

// Call on server shutdown
export async function shutdownAnalytics() {
  await analytics.closeAndFlush();
}

export default analytics;
`;
}

function segmentPythonInit(): string {
  return `"""
Segment Analytics — Python / Backend

Install: pip install analytics-python
Docs: https://segment.com/docs/connections/sources/catalog/libraries/server/python/
"""

import os
import analytics

analytics.write_key = os.getenv("SEGMENT_WRITE_KEY", "")


def track_event(user_id: str, event: str, properties: dict | None = None):
    analytics.track(user_id, event, properties or {})


def identify_user(user_id: str, traits: dict | None = None):
    analytics.identify(user_id, traits or {})
`;
}

function segmentReactInit(): string {
  return `/**
 * Segment Analytics — React / Frontend
 *
 * Install: npm i @segment/analytics-next
 * Docs: https://segment.com/docs/connections/sources/catalog/libraries/website/javascript/
 */
import { AnalyticsBrowser } from "@segment/analytics-next";

const SEGMENT_WRITE_KEY = import.meta.env.VITE_SEGMENT_WRITE_KEY ?? "";

export const analytics = AnalyticsBrowser.load(
  SEGMENT_WRITE_KEY ? { writeKey: SEGMENT_WRITE_KEY } : { writeKey: "" },
);

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  analytics.track(event, properties);
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  analytics.identify(userId, traits);
}

export default analytics;
`;
}

// --- Go backend (generic wrapper for any provider via HTTP) ---
function goAnalyticsInit(provider: AnalyticsProvider): string {
  const envVar = getEnvVarName(provider);
  return `package analytics

// ${provider} Analytics — Go / Backend
//
// Most analytics providers don't have official Go SDKs.
// This provides a generic HTTP-based event tracking client.
// Replace with the provider's SDK if one becomes available.

import (
\t"bytes"
\t"encoding/json"
\t"net/http"
\t"os"
)

var apiKey = os.Getenv("${envVar}")

type Event struct {
\tUserID     string                 \`json:"user_id"\`
\tEvent      string                 \`json:"event"\`
\tProperties map[string]interface{} \`json:"properties"\`
}

// TrackEvent sends an event to ${provider}.
// Replace this with the provider's SDK or API when available.
func TrackEvent(userID, event string, properties map[string]interface{}) error {
\tpayload := Event{UserID: userID, Event: event, Properties: properties}
\tdata, err := json.Marshal(payload)
\tif err != nil {
\t\treturn err
\t}

\t// TODO: Replace with actual ${provider} API endpoint
\treq, err := http.NewRequest("POST", "https://api.example.com/track", bytes.NewBuffer(data))
\tif err != nil {
\t\treturn err
\t}
\treq.Header.Set("Content-Type", "application/json")
\treq.Header.Set("Authorization", "Bearer "+apiKey)

\t_, err = http.DefaultClient.Do(req)
\treturn err
}
`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type InitFnMap = {
  node: () => string;
  python: () => string;
  react: () => string;
  mobile?: () => string;
};

function getProviderInits(provider: AnalyticsProvider): InitFnMap {
  switch (provider) {
    case "posthog":
      return { node: posthogNodeInit, python: posthogPythonInit, react: posthogReactInit, mobile: posthogMobileInit };
    case "clevertap":
      return { node: clevertapNodeInit, python: clevertapPythonInit, react: clevertapReactInit };
    case "moengage":
      return { node: moengageNodeInit, python: moengagePythonInit, react: moengageReactInit };
    case "mixpanel":
      return { node: mixpanelNodeInit, python: mixpanelPythonInit, react: mixpanelReactInit };
    case "segment":
      return { node: segmentNodeInit, python: segmentPythonInit, react: segmentReactInit };
  }
}

function getEnvVarName(provider: AnalyticsProvider): string {
  switch (provider) {
    case "posthog": return "POSTHOG_API_KEY";
    case "clevertap": return "CLEVERTAP_ACCOUNT_ID";
    case "moengage": return "MOENGAGE_APP_ID";
    case "mixpanel": return "MIXPANEL_TOKEN";
    case "segment": return "SEGMENT_WRITE_KEY";
  }
}

function getEnvVars(provider: AnalyticsProvider): string {
  switch (provider) {
    case "posthog":
      return `POSTHOG_API_KEY=phc_your_key_here\nPOSTHOG_HOST=https://app.posthog.com`;
    case "clevertap":
      return `CLEVERTAP_ACCOUNT_ID=your_account_id\nCLEVERTAP_PASSCODE=your_passcode`;
    case "moengage":
      return `MOENGAGE_APP_ID=your_app_id\nMOENGAGE_API_KEY=your_api_key\nMOENGAGE_API_URL=https://api-01.moengage.com`;
    case "mixpanel":
      return `MIXPANEL_TOKEN=your_token_here`;
    case "segment":
      return `SEGMENT_WRITE_KEY=your_write_key_here`;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceAnalytics(config: ProjectConfig, registry: Registry): Promise<void> {
  const provider = config.analyticsProvider ?? "posthog";
  const inits = getProviderInits(provider);
  const { beDir, feDir, mobileDir } = resolveProjectDirs(config);

  // Backend
  if (config.backend) {
    const beEntry = getRegistryEntry(registry, "backend", config.backend);

    if (beEntry.lang === "python") {
      const libDir = path.join(beDir, "app", "lib");
      await fs.ensureDir(libDir);
      await fs.writeFile(path.join(libDir, "analytics.py"), inits.python());
    } else if (beEntry.lang === "typescript") {
      const libDir = path.join(beDir, "src", "lib");
      await fs.ensureDir(libDir);
      await fs.writeFile(path.join(libDir, "analytics.ts"), inits.node());
    } else if (beEntry.lang === "go") {
      const analyticsDir = path.join(beDir, "internal", "analytics");
      await fs.ensureDir(analyticsDir);
      await fs.writeFile(path.join(analyticsDir, "analytics.go"), goAnalyticsInit(provider));
    }
  }

  // Frontend
  if (config.frontend) {
    const libDir = path.join(feDir, "src", "lib");
    await fs.ensureDir(libDir);
    await fs.writeFile(path.join(libDir, "analytics.ts"), inits.react());
  }

  // Mobile
  if (config.mobile && inits.mobile) {
    const libDir = path.join(mobileDir, "src", "lib");
    await fs.ensureDir(libDir);
    await fs.writeFile(path.join(libDir, "analytics.ts"), inits.mobile());
  }

  // .env vars — single read, build all vars at once
  const viteVar = config.frontend ? `\nVITE_${getEnvVarName(provider)}=your_key_here` : "";
  await appendEnvVars(
    config.targetDir,
    getEnvVarName(provider),
    `\n# Analytics (${provider})\n${getEnvVars(provider)}${viteVar}\n`,
  );
}
