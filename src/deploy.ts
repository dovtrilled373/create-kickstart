import * as p from "@clack/prompts";
import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import { DeployProvider } from "./types.js";
import { PRIMARY_BACKEND_NAME } from "./enhancers/utils.js";
import { writeTerraform } from "./deploy-terraform.js";

// ---------------------------------------------------------------------------
// CLI parsing for "deploy" subcommand
// ---------------------------------------------------------------------------

export function parseDeployArgs(argv: string[]): { provider?: DeployProvider; interactive: boolean } {
  let provider: DeployProvider | undefined;
  let interactive = true;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--provider" && argv[i + 1]) {
      provider = argv[++i] as DeployProvider;
    } else if (argv[i] === "--no-interactive") {
      interactive = false;
    }
  }
  return { provider, interactive };
}

// ---------------------------------------------------------------------------
// Provider metadata
// ---------------------------------------------------------------------------

interface ProviderMeta {
  name: string;
  tier: "paas" | "cloud-native" | "kubernetes";
  hint: string;
}

const PROVIDERS: Record<DeployProvider, ProviderMeta> = {
  railway: { name: "Railway", tier: "paas", hint: "Zero-config deploy, great for POCs" },
  render: { name: "Render", tier: "paas", hint: "Free tier, auto-deploy from GitHub" },
  "fly-io": { name: "Fly.io", tier: "paas", hint: "Edge deploys, great latency" },
  vercel: { name: "Vercel", tier: "paas", hint: "Frontend optimized, serverless backend" },
  "aws-ecs": { name: "AWS ECS (Fargate)", tier: "cloud-native", hint: "Production-grade, auto-scaling" },
  "gcp-cloud-run": { name: "GCP Cloud Run", tier: "cloud-native", hint: "Serverless containers, pay-per-use" },
  "azure-container-apps": { name: "Azure Container Apps", tier: "cloud-native", hint: "Managed containers on Azure" },
  kubernetes: { name: "Kubernetes", tier: "kubernetes", hint: "Helm charts + K8s manifests" },
};

// ---------------------------------------------------------------------------
// PaaS configs
// ---------------------------------------------------------------------------

function railwayConfig(projectName: string): string {
  return `{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
`;
}

function railwayWorkflow(projectName: string): string {
  return `name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy API
        run: railway up --service ${PRIMARY_BACKEND_NAME} -d
        env:
          RAILWAY_TOKEN: \${{ secrets.RAILWAY_TOKEN }}
`;
}

function renderConfig(projectName: string): string {
  return `services:
  - type: web
    name: ${projectName}-api
    runtime: docker
    dockerfilePath: ./backend/${PRIMARY_BACKEND_NAME}/Dockerfile
    dockerContext: ./backend/${PRIMARY_BACKEND_NAME}
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: ${projectName}-db
          property: connectionString

  - type: web
    name: ${projectName}-frontend
    runtime: static
    buildCommand: cd frontend && npm ci && npm run build
    staticPublishPath: ./frontend/dist
    headers:
      - path: /*
        name: Cache-Control
        value: public, max-age=0, must-revalidate

databases:
  - name: ${projectName}-db
    plan: free
    databaseName: app
`;
}

function renderWorkflow(projectName: string): string {
  return `name: Deploy to Render

on:
  push:
    branches: [main]

# Render auto-deploys from GitHub — this workflow runs tests first
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run backend tests
        run: |
          cd backend/${PRIMARY_BACKEND_NAME}
          # Add your test commands here

      - name: Build frontend
        run: |
          cd frontend
          npm ci
          npm run build

      - name: Trigger Render deploy
        run: |
          curl -X POST "\${{ secrets.RENDER_DEPLOY_HOOK_URL }}"
`;
}

function flyIoConfig(projectName: string): string {
  return `app = "${projectName}-api"
primary_region = "iad"

[build]
  dockerfile = "backend/${PRIMARY_BACKEND_NAME}/Dockerfile"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  path = "/health"
  timeout = "5s"

[env]
  NODE_ENV = "production"
`;
}

function flyIoWorkflow(projectName: string): string {
  return `name: Deploy to Fly.io

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy API
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: \${{ secrets.FLY_API_TOKEN }}
`;
}

function vercelConfig(projectName: string): string {
  return `{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm ci",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "${`$\{BACKEND_URL\}`}/api/:path*"
    }
  ]
}
`;
}

// ---------------------------------------------------------------------------
// Cloud-native configs
// ---------------------------------------------------------------------------

function awsEcsTaskDef(projectName: string): string {
  return `{
  "family": "${projectName}-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "\${ECS_EXECUTION_ROLE_ARN}",
  "taskRoleArn": "\${ECS_TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "${PRIMARY_BACKEND_NAME}",
      "image": "\${ECR_REGISTRY}/${projectName}-api:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      },
      "environment": [
        { "name": "NODE_ENV", "value": "production" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${projectName}",
          "awslogs-region": "\${AWS_REGION}",
          "awslogs-stream-prefix": "api"
        }
      }
    }
  ]
}
`;
}

function awsEcsWorkflow(projectName: string): string {
  return `name: Deploy to AWS ECS

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: ${projectName}-api
  ECS_CLUSTER: ${projectName}-cluster
  ECS_SERVICE: ${projectName}-api-service
  ECS_TASK_DEFINITION: deploy/aws/task-definition.json

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: \${{ secrets.AWS_ROLE_ARN }}
          aws-region: \${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        id: build-image
        env:
          ECR_REGISTRY: \${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: \${{ github.sha }}
        run: |
          docker build -t \$ECR_REGISTRY/\$ECR_REPOSITORY:\$IMAGE_TAG -f backend/${PRIMARY_BACKEND_NAME}/Dockerfile backend/${PRIMARY_BACKEND_NAME}
          docker push \$ECR_REGISTRY/\$ECR_REPOSITORY:\$IMAGE_TAG
          echo "image=\$ECR_REGISTRY/\$ECR_REPOSITORY:\$IMAGE_TAG" >> \$GITHUB_OUTPUT

      - name: Render ECS task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: \${{ env.ECS_TASK_DEFINITION }}
          container-name: ${PRIMARY_BACKEND_NAME}
          image: \${{ steps.build-image.outputs.image }}

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: \${{ steps.task-def.outputs.task-definition }}
          service: \${{ env.ECS_SERVICE }}
          cluster: \${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
`;
}

function gcpCloudRunConfig(projectName: string): string {
  return `# Cloud Run service configuration
# Deploy: gcloud run deploy ${projectName}-api --source backend/${PRIMARY_BACKEND_NAME}

apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: ${projectName}-api
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
        - image: gcr.io/\${GCP_PROJECT_ID}/${projectName}-api:latest
          ports:
            - containerPort: 8080
          resources:
            limits:
              cpu: "1"
              memory: "512Mi"
          startupProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          env:
            - name: NODE_ENV
              value: "production"
`;
}

function gcpCloudRunWorkflow(projectName: string): string {
  return `name: Deploy to GCP Cloud Run

on:
  push:
    branches: [main]

env:
  GCP_PROJECT_ID: \${{ secrets.GCP_PROJECT_ID }}
  GCP_REGION: us-central1
  SERVICE_NAME: ${projectName}-api

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: \${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: \${{ secrets.GCP_SERVICE_ACCOUNT }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for GCR
        run: gcloud auth configure-docker

      - name: Build and push
        run: |
          docker build -t gcr.io/\$GCP_PROJECT_ID/\$SERVICE_NAME:\${{ github.sha }} -f backend/${PRIMARY_BACKEND_NAME}/Dockerfile backend/${PRIMARY_BACKEND_NAME}
          docker push gcr.io/\$GCP_PROJECT_ID/\$SERVICE_NAME:\${{ github.sha }}

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: \${{ env.SERVICE_NAME }}
          region: \${{ env.GCP_REGION }}
          image: gcr.io/\${{ env.GCP_PROJECT_ID }}/\${{ env.SERVICE_NAME }}:\${{ github.sha }}
`;
}

function azureContainerAppsConfig(projectName: string): string {
  return `# Azure Container Apps configuration
# Deploy: az containerapp up --name ${projectName}-api --source backend/${PRIMARY_BACKEND_NAME}

location: eastus
resourceGroup: ${projectName}-rg
containerApp:
  name: ${projectName}-api
  configuration:
    ingress:
      external: true
      targetPort: 8080
    secrets:
      - name: database-url
        value: "\${DATABASE_URL}"
  template:
    containers:
      - name: ${PRIMARY_BACKEND_NAME}
        image: \${ACR_REGISTRY}/${projectName}-api:latest
        resources:
          cpu: 0.25
          memory: 0.5Gi
        probes:
          - type: liveness
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 30
    scale:
      minReplicas: 0
      maxReplicas: 5
      rules:
        - name: http-scaling
          http:
            metadata:
              concurrentRequests: "50"
`;
}

function azureWorkflow(projectName: string): string {
  return `name: Deploy to Azure Container Apps

on:
  push:
    branches: [main]

env:
  AZURE_CONTAINER_APP: ${projectName}-api
  AZURE_RESOURCE_GROUP: ${projectName}-rg
  ACR_NAME: \${{ secrets.ACR_NAME }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login to Azure
        uses: azure/login@v2
        with:
          creds: \${{ secrets.AZURE_CREDENTIALS }}

      - name: Login to ACR
        run: az acr login --name \$ACR_NAME

      - name: Build and push
        run: |
          docker build -t \$ACR_NAME.azurecr.io/\$AZURE_CONTAINER_APP:\${{ github.sha }} -f backend/${PRIMARY_BACKEND_NAME}/Dockerfile backend/${PRIMARY_BACKEND_NAME}
          docker push \$ACR_NAME.azurecr.io/\$AZURE_CONTAINER_APP:\${{ github.sha }}

      - name: Deploy to Container Apps
        run: |
          az containerapp update \\
            --name \$AZURE_CONTAINER_APP \\
            --resource-group \$AZURE_RESOURCE_GROUP \\
            --image \$ACR_NAME.azurecr.io/\$AZURE_CONTAINER_APP:\${{ github.sha }}
`;
}

// ---------------------------------------------------------------------------
// Kubernetes configs
// ---------------------------------------------------------------------------

function k8sDeployment(projectName: string): string {
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${projectName}-api
  labels:
    app: ${projectName}-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${projectName}-api
  template:
    metadata:
      labels:
        app: ${projectName}-api
    spec:
      containers:
        - name: ${PRIMARY_BACKEND_NAME}
          image: \${REGISTRY}/${projectName}-api:latest
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 20
          envFrom:
            - configMapRef:
                name: ${projectName}-config
            - secretRef:
                name: ${projectName}-secrets
`;
}

function k8sService(projectName: string): string {
  return `apiVersion: v1
kind: Service
metadata:
  name: ${projectName}-api
spec:
  type: ClusterIP
  selector:
    app: ${projectName}-api
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
`;
}

function k8sIngress(projectName: string): string {
  return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${projectName}-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - host: ${projectName}.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: ${projectName}-api
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${projectName}-frontend
                port:
                  number: 80
`;
}

function helmChart(projectName: string): string {
  return `apiVersion: v2
name: ${projectName}
description: Helm chart for ${projectName}
type: application
version: 0.1.0
appVersion: "1.0.0"
`;
}

function helmValues(projectName: string): string {
  return `# Default values for ${projectName}

replicaCount: 2

image:
  repository: \${REGISTRY}/${projectName}-api
  tag: latest
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: ${projectName}.example.com
      paths:
        - path: /api
          pathType: Prefix

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

env:
  NODE_ENV: production
`;
}

// ---------------------------------------------------------------------------
// Deploy script (helper for all providers)
// ---------------------------------------------------------------------------

function deployScript(provider: DeployProvider, projectName: string): string {
  const header = `#!/usr/bin/env bash
set -euo pipefail

echo "Deploying ${projectName} to ${PROVIDERS[provider].name}..."
echo ""
`;

  switch (provider) {
    case "railway":
      return `${header}
# Prerequisites: npm install -g @railway/cli && railway login
railway up --service ${PRIMARY_BACKEND_NAME}
echo ""
echo "Deploy complete! Run 'railway open' to view your app."
`;
    case "render":
      return `${header}
echo "Render auto-deploys from GitHub."
echo "Push to main branch to trigger deploy."
echo ""
echo "Dashboard: https://dashboard.render.com"
`;
    case "fly-io":
      return `${header}
# Prerequisites: curl -L https://fly.io/install.sh | sh && fly auth login
fly deploy
echo ""
echo "Deploy complete! Run 'fly open' to view your app."
`;
    case "vercel":
      return `${header}
# Prerequisites: npm install -g vercel && vercel login
cd frontend && vercel --prod
echo ""
echo "Frontend deployed! Configure BACKEND_URL env var in Vercel dashboard."
`;
    case "aws-ecs":
      return `${header}
# Prerequisites: aws configure
echo "Build and push Docker image to ECR..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="\${AWS_ACCOUNT_ID}.dkr.ecr.\${AWS_REGION:-us-east-1}.amazonaws.com"

aws ecr get-login-password --region \${AWS_REGION:-us-east-1} | docker login --username AWS --password-stdin \$ECR_REGISTRY

docker build -t \$ECR_REGISTRY/${projectName}-api:latest -f backend/${PRIMARY_BACKEND_NAME}/Dockerfile backend/${PRIMARY_BACKEND_NAME}
docker push \$ECR_REGISTRY/${projectName}-api:latest

echo "Updating ECS service..."
aws ecs update-service --cluster ${projectName}-cluster --service ${projectName}-api-service --force-new-deployment

echo ""
echo "Deploy initiated. Check AWS Console for status."
`;
    case "gcp-cloud-run":
      return `${header}
# Prerequisites: gcloud auth login && gcloud config set project YOUR_PROJECT
gcloud run deploy ${projectName}-api \\
  --source backend/${PRIMARY_BACKEND_NAME} \\
  --region \${GCP_REGION:-us-central1} \\
  --allow-unauthenticated

echo ""
echo "Deploy complete!"
`;
    case "azure-container-apps":
      return `${header}
# Prerequisites: az login
az containerapp up \\
  --name ${projectName}-api \\
  --resource-group ${projectName}-rg \\
  --source backend/${PRIMARY_BACKEND_NAME}

echo ""
echo "Deploy complete!"
`;
    case "kubernetes":
      return `${header}
# Prerequisites: kubectl configured, image pushed to registry
echo "Applying Kubernetes manifests..."
kubectl apply -f deploy/k8s/

echo ""
echo "Deploy complete! Run 'kubectl get pods' to check status."
`;
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown deploy provider: ${_exhaustive}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runDeploy(argv: string[]): Promise<void> {
  p.intro(chalk.bgCyan(chalk.black(" create-kickstart deploy ")));

  const args = parseDeployArgs(argv);

  let provider: DeployProvider;
  if (args.provider) {
    if (!(args.provider in PROVIDERS)) {
      p.cancel(`Unknown provider: ${args.provider}. Valid: ${Object.keys(PROVIDERS).join(", ")}`);
      process.exit(1);
    }
    provider = args.provider;
  } else if (args.interactive) {
    const result = await p.select({
      message: "Pick your deployment platform:",
      options: [
        { value: "railway", label: "Railway", hint: "── PaaS ── " + PROVIDERS.railway.hint },
        { value: "render", label: "Render", hint: PROVIDERS.render.hint },
        { value: "fly-io", label: "Fly.io", hint: PROVIDERS["fly-io"].hint },
        { value: "vercel", label: "Vercel", hint: PROVIDERS.vercel.hint },
        { value: "aws-ecs", label: "AWS ECS (Fargate)", hint: "── Cloud ── " + PROVIDERS["aws-ecs"].hint },
        { value: "gcp-cloud-run", label: "GCP Cloud Run", hint: PROVIDERS["gcp-cloud-run"].hint },
        { value: "azure-container-apps", label: "Azure Container Apps", hint: PROVIDERS["azure-container-apps"].hint },
        { value: "kubernetes", label: "Kubernetes", hint: "── K8s ── " + PROVIDERS.kubernetes.hint },
      ],
    });
    if (p.isCancel(result)) process.exit(0);
    provider = result as DeployProvider;
  } else {
    p.cancel("--provider is required in non-interactive mode");
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const projectName = path.basename(projectRoot);
  const meta = PROVIDERS[provider];

  p.log.step(`Setting up ${chalk.bold(meta.name)} deployment for ${chalk.bold(projectName)}`);

  // Clean up existing deploy configs
  const deployDir = path.join(projectRoot, "deploy");
  if (await fs.pathExists(deployDir)) {
    await fs.remove(deployDir);
    p.log.info("  Removed existing deploy/ configs");
  }

  // Generate configs based on provider
  switch (provider) {
    case "railway": {
      await fs.ensureDir(path.join(deployDir, "railway"));
      await fs.writeFile(path.join(deployDir, "railway", "railway.json"), railwayConfig(projectName));
      await writeWorkflow(projectRoot, "deploy.yml", railwayWorkflow(projectName));
      break;
    }
    case "render": {
      await fs.ensureDir(path.join(deployDir, "render"));
      await fs.writeFile(path.join(deployDir, "render", "render.yaml"), renderConfig(projectName));
      await writeWorkflow(projectRoot, "deploy.yml", renderWorkflow(projectName));
      break;
    }
    case "fly-io": {
      await fs.ensureDir(path.join(deployDir, "fly"));
      await fs.writeFile(path.join(projectRoot, "fly.toml"), flyIoConfig(projectName));
      await writeWorkflow(projectRoot, "deploy.yml", flyIoWorkflow(projectName));
      break;
    }
    case "vercel": {
      await fs.ensureDir(path.join(deployDir, "vercel"));
      await fs.writeFile(path.join(projectRoot, "frontend", "vercel.json"), vercelConfig(projectName));
      break;
    }
    case "aws-ecs": {
      await fs.ensureDir(path.join(deployDir, "aws"));
      await fs.writeFile(path.join(deployDir, "aws", "task-definition.json"), awsEcsTaskDef(projectName));
      await writeWorkflow(projectRoot, "deploy.yml", awsEcsWorkflow(projectName));
      break;
    }
    case "gcp-cloud-run": {
      await fs.ensureDir(path.join(deployDir, "gcp"));
      await fs.writeFile(path.join(deployDir, "gcp", "service.yaml"), gcpCloudRunConfig(projectName));
      await writeWorkflow(projectRoot, "deploy.yml", gcpCloudRunWorkflow(projectName));
      break;
    }
    case "azure-container-apps": {
      await fs.ensureDir(path.join(deployDir, "azure"));
      await fs.writeFile(path.join(deployDir, "azure", "containerapp.yaml"), azureContainerAppsConfig(projectName));
      await writeWorkflow(projectRoot, "deploy.yml", azureWorkflow(projectName));
      break;
    }
    case "kubernetes": {
      const k8sDir = path.join(deployDir, "k8s");
      const helmDir = path.join(deployDir, "helm", projectName);
      const helmTemplatesDir = path.join(helmDir, "templates");
      await Promise.all([fs.ensureDir(k8sDir), fs.ensureDir(helmTemplatesDir)]);

      // Write manifests to both k8s/ and helm/templates/ directly (avoid fs.copy read-back)
      const manifests: [string, string][] = [
        ["deployment.yaml", k8sDeployment(projectName)],
        ["service.yaml", k8sService(projectName)],
        ["ingress.yaml", k8sIngress(projectName)],
      ];
      await Promise.all([
        ...manifests.map(([name, content]) => fs.writeFile(path.join(k8sDir, name), content)),
        ...manifests.map(([name, content]) => fs.writeFile(path.join(helmTemplatesDir, name), content)),
        fs.writeFile(path.join(helmDir, "Chart.yaml"), helmChart(projectName)),
        fs.writeFile(path.join(helmDir, "values.yaml"), helmValues(projectName)),
      ]);
      break;
    }
  }

  // Generate Terraform for cloud-native providers
  const tfFiles = await writeTerraform(projectRoot, projectName, provider);
  if (tfFiles.length > 0) {
    p.log.info(`  Generated Terraform (${tfFiles.length} files)`);
  }

  // Write deploy script
  const scriptContent = deployScript(provider, projectName);
  const scriptsDir = path.join(projectRoot, "scripts");
  await fs.ensureDir(scriptsDir);
  await fs.writeFile(path.join(scriptsDir, "deploy.sh"), scriptContent);
  await fs.chmod(path.join(scriptsDir, "deploy.sh"), 0o755);

  // Summary
  p.outro(chalk.green(`${meta.name} deployment configured!`));

  console.log();
  console.log(chalk.bold("  Generated:"));
  const generated = await listGeneratedFiles(deployDir, projectRoot);
  for (const f of generated) {
    console.log(`    ${chalk.cyan(f)}`);
  }
  console.log(`    ${chalk.cyan("scripts/deploy.sh")}`);
  if (tfFiles.length > 0) {
    console.log();
    console.log(chalk.bold("  Provision infra:"));
    console.log(`    ${chalk.cyan("cd deploy/terraform && terraform init && terraform apply")}`);
  }
  console.log();
  console.log(`  ${chalk.bold("Deploy:")} ${chalk.cyan("bash scripts/deploy.sh")}`);
  console.log();
  console.log(chalk.gray(`  Switch providers anytime: npx create-kickstart deploy --provider <name>`));
  console.log();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeWorkflow(projectRoot: string, name: string, content: string): Promise<void> {
  const workflowDir = path.join(projectRoot, ".github", "workflows");
  await fs.ensureDir(workflowDir);
  await fs.writeFile(path.join(workflowDir, name), content);
}

async function listGeneratedFiles(deployDir: string, projectRoot: string): Promise<string[]> {
  const files: string[] = [];
  if (await fs.pathExists(deployDir)) {
    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          files.push(path.relative(projectRoot, fullPath));
        }
      }
    };
    await walk(deployDir);
  }
  return files.sort();
}
