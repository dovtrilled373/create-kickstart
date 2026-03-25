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
import { enhanceApiWiring } from "./api-wiring.js";
import { enhanceSampleCrud } from "./sample-crud.js";
import { enhanceDoctor } from "./doctor.js";
import { enhanceLogging } from "./logging.js";
import { enhanceDeploy } from "./deploy.js";
import { enhanceDepsAuto } from "./deps-auto.js";
import { enhanceApiTypes } from "./api-types.js";
import * as p from "@clack/prompts";

type Enhancer = (config: ProjectConfig, registry: Registry) => Promise<void>;

const ENHANCER_MAP: Partial<Record<Enhancement, Enhancer>> = {
  docker: enhanceDocker,
  ci: enhanceCi,
  lint: enhanceLint,
  test: enhanceTest,
  env: enhanceEnv,
  "ai-context": enhanceAiContext,
  "pre-commit": enhancePreCommit,
  db: enhanceDb,
  "api-wiring": enhanceApiWiring,
  "sample-crud": enhanceSampleCrud,
  doctor: enhanceDoctor,
  logging: enhanceLogging,
  deploy: enhanceDeploy,
  "deps-auto": enhanceDepsAuto,
  "api-types": enhanceApiTypes,
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
