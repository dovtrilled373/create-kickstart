import { Command } from "commander";
import { ProjectConfig, Enhancement, ProjectType } from "./types.js";

export function parseArgs(argv: string[]): Partial<ProjectConfig> & { interactive: boolean } {
  const program = new Command();

  program
    .name("create-kickstart")
    .description("Scaffold production-ready projects with composable stacks")
    .version("0.1.0")
    .argument("[name]", "Project name")
    .option("--type <type>", "Project type: fullstack, frontend, backend, cli-lib")
    .option("--frontend <stack>", "Frontend stack: nextjs, react-vite, vue, svelte, angular")
    .option("--backend <stack>", "Backend stack: fastapi, express, hono, django, go-chi, spring-boot")
    .option("--standalone <stack>", "Standalone stack: python-cli, python-lib, node-cli")
    .option("--with <enhancements>", "Comma-separated enhancements: docker,ci,lint,test,env,ai-context,pre-commit,db")
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
    standalone: opts.standalone,
    enhancements,
    interactive: isInteractive,
  };
}
