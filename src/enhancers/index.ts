import { ProjectConfig, Registry, Enhancement } from "../types.js";
import { enhanceDocker } from "./docker.js";
import { enhanceCi } from "./ci.js";
import { enhanceLint } from "./lint.js";
import { enhanceTest } from "./test.js";
import { enhanceEnv } from "./env.js";
import { enhanceAiContext } from "./ai-context.js";
import { enhanceScripts } from "./scripts.js";
import { enhancePreCommit } from "./pre-commit.js";
import { enhanceDb } from "./db.js";
import * as p from "@clack/prompts";

type Enhancer = (config: ProjectConfig, registry: Registry) => Promise<void>;

const ENHANCER_MAP: Record<Enhancement, Enhancer> = {
  docker: enhanceDocker,
  ci: enhanceCi,
  lint: enhanceLint,
  test: enhanceTest,
  env: enhanceEnv,
  "ai-context": enhanceAiContext,
  "pre-commit": enhancePreCommit,
  db: enhanceDb,
};

export async function runEnhancers(config: ProjectConfig, registry: Registry): Promise<void> {
  // Scripts are always generated
  await enhanceScripts(config, registry);

  for (const enh of config.enhancements) {
    const enhancer = ENHANCER_MAP[enh];
    if (enhancer) {
      const spinner = p.spinner();
      spinner.start(`Applying ${enh} enhancement...`);
      await enhancer(config, registry);
      spinner.stop(`Applied ${enh}`);
    }
  }
}
