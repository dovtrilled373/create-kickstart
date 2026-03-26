import { Command } from "commander";
import { ProjectConfig, Enhancement, ProjectType, MobileStack, DatabaseChoice, AnalyticsProvider, ApiProtocol } from "./types.js";

export function parseArgs(argv: string[]): Partial<ProjectConfig> & { interactive: boolean; subcommand?: string; subcommandArgs?: string[] } {
  // Check for subcommands before commander parsing
  const addIdx = argv.indexOf("add");
  if (addIdx !== -1 && addIdx >= 2) {
    return {
      interactive: true,
      subcommand: "add",
      subcommandArgs: argv.slice(addIdx + 1),
      enhancements: [],
    };
  }

  const deployIdx = argv.indexOf("deploy");
  if (deployIdx !== -1 && deployIdx >= 2) {
    return {
      interactive: true,
      subcommand: "deploy",
      subcommandArgs: argv.slice(deployIdx + 1),
      enhancements: [],
    };
  }

  const program = new Command();

  program
    .name("create-kickstart")
    .description("Scaffold production-ready projects with composable stacks")
    .version("0.1.0")
    .argument("[name]", "Project name")
    .option("--type <type>", "Project type: fullstack, frontend, backend, mobile, cli-lib")
    .option("--frontend <stack>", "Frontend stack: nextjs, react-vite, vue, svelte, angular")
    .option("--backend <stack>", "Backend stack: fastapi, express, hono, django, go-chi, spring-boot")
    .option("--mobile <stack>", "Mobile stack: react-native, flutter, swift, kotlin")
    .option("--standalone <stack>", "Standalone stack: python-cli, python-lib, node-cli")
    .option("--with <enhancements>", "Comma-separated enhancements")
    .option("--database <db>", "Database: postgres, mysql, sqlite, mongodb")
    .option("--analytics-provider <provider>", "Analytics: posthog, clevertap, moengage, mixpanel, segment")
    .option("--api-protocol <protocol>", "API protocol: graphql, grpc, graphql+grpc")
    .option("--no-interactive", "Disable interactive prompts (for AI agents and scripts)")
    .parse(argv);

  const opts = program.opts();
  const args = program.args;

  const enhancements: Enhancement[] = opts.with
    ? opts.with.split(",").map((e: string) => e.trim() as Enhancement)
    : [];

  const isInteractive = opts.interactive !== false;

  return {
    name: args[0],
    type: opts.type as ProjectType | undefined,
    frontend: opts.frontend,
    backend: opts.backend,
    mobile: opts.mobile as MobileStack | undefined,
    standalone: opts.standalone,
    enhancements,
    database: opts.database as DatabaseChoice | undefined,
    analyticsProvider: opts.analyticsProvider as AnalyticsProvider | undefined,
    apiProtocol: opts.apiProtocol as ApiProtocol | undefined,
    interactive: isInteractive,
  };
}
