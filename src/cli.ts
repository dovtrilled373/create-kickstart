import { Command } from "commander";
import { ProjectConfig, Enhancement, ProjectType, MobileStack, DatabaseChoice, AnalyticsProvider, ApiProtocol, QueueProvider } from "./types.js";

type ParseResult = Partial<ProjectConfig> & { interactive: boolean; subcommand?: string; subcommandArgs?: string[] };

function trySubcommand(argv: string[], name: string): ParseResult | null {
  const idx = argv.indexOf(name);
  if (idx !== -1 && idx >= 2) {
    return { interactive: true, subcommand: name, subcommandArgs: argv.slice(idx + 1), enhancements: [] };
  }
  return null;
}

export function parseArgs(argv: string[]): ParseResult {
  // Check for subcommands before commander parsing
  for (const cmd of ["add", "deploy", "ai"]) {
    const result = trySubcommand(argv, cmd);
    if (result) return result;
  }

  const program = new Command();

  program
    .name("create-kickstart")
    .description("Scaffold production-ready projects with composable stacks")
    .version("0.1.0")
    .argument("[name]", "Project name")
    .option("--type <type>", "Project type: fullstack, frontend, backend, mobile, cli-lib")
    .option("--frontend <stack>", "Frontend stack: nextjs, react-vite, vue, svelte, angular")
    .option("--backend <stack>", "Backend: fastapi, express, hono, django, go-chi, spring-boot, axum, aspnet, phoenix")
    .option("--mobile <stack>", "Mobile stack: react-native, flutter, swift, kotlin")
    .option("--standalone <stack>", "Standalone stack: python-cli, python-lib, node-cli")
    .option("--with <enhancements>", "Comma-separated enhancements")
    .option("--database <db>", "Database: postgres, mysql, sqlite, mongodb")
    .option("--analytics-provider <provider>", "Analytics: posthog, clevertap, moengage, mixpanel, segment")
    .option("--api-protocol <protocol>", "API protocol: graphql, grpc, graphql+grpc")
    .option("--queue-provider <provider>", "Queue: rabbitmq, kafka")
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
    queueProvider: opts.queueProvider as QueueProvider | undefined,
    interactive: isInteractive,
  };
}
