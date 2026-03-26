import fs from "fs-extra";
import path from "path";
import { DeployProvider } from "./types.js";
import { PRIMARY_BACKEND_NAME } from "./enhancers/utils.js";

// ---------------------------------------------------------------------------
// AWS ECS Terraform
// ---------------------------------------------------------------------------

function awsMain(projectName: string): string {
  return `terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment to use S3 backend for state
  # backend "s3" {
  #   bucket = "${projectName}-terraform-state"
  #   key    = "terraform.tfstate"
  #   region = var.aws_region
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "${projectName}"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}
`;
}

function awsVariables(projectName: string): string {
  let vars = `variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "${projectName}"
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 8080
}

variable "cpu" {
  description = "Fargate task CPU units (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Fargate task memory in MB (512, 1024, 2048, ...)"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Number of running tasks"
  type        = number
  default     = 1
}
`;

  return vars;
}

function awsVpc(projectName: string): string {
  return `# VPC with public + private subnets across 2 AZs

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "alb" {
  name   = "\${var.project_name}-alb-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name   = "\${var.project_name}-ecs-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
`;
}

function awsEcr(): string {
  return `resource "aws_ecr_repository" "api" {
  name                 = "\${var.project_name}-api"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}
`;
}

function awsEcs(): string {
  return `# ECS Cluster + Fargate Service

resource "aws_ecs_cluster" "main" {
  name = "\${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/\${var.project_name}"
  retention_in_days = 14
}

resource "aws_iam_role" "ecs_execution" {
  name = "\${var.project_name}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_ecs_task_definition" "api" {
  family                   = "\${var.project_name}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name  = "${PRIMARY_BACKEND_NAME}"
    image = "\${aws_ecr_repository.api.repository_url}:latest"
    portMappings = [{ containerPort = var.container_port }]

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:\${var.container_port}/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name            = "\${var.project_name}-api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "${PRIMARY_BACKEND_NAME}"
    container_port   = var.container_port
  }

  depends_on = [aws_lb_listener.http]
}
`;
}

function awsAlb(): string {
  return `# Application Load Balancer

resource "aws_lb" "main" {
  name               = "\${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "api" {
  name        = "\${var.project_name}-api-tg"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
`;
}

function awsOutputs(): string {
  return `output "alb_url" {
  description = "Application URL"
  value       = "http://\${aws_lb.main.dns_name}"
}

output "ecr_repository_url" {
  description = "ECR repository URL for docker push"
  value       = aws_ecr_repository.api.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.api.name
}
`;
}

function awsTfvars(projectName: string): string {
  return `# Customize these values for your deployment
project_name  = "${projectName}"
aws_region    = "us-east-1"
environment   = "dev"
container_port = 8080
cpu           = 256
memory        = 512
desired_count = 1
`;
}

// ---------------------------------------------------------------------------
// GCP Cloud Run Terraform
// ---------------------------------------------------------------------------

function gcpMain(projectName: string): string {
  return `terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "${projectName}"
}

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# Artifact Registry (container registry)
resource "google_artifact_registry_repository" "api" {
  location      = var.gcp_region
  repository_id = "\${var.project_name}-api"
  format        = "DOCKER"
  depends_on    = [google_project_service.apis]
}

# Cloud Run service
resource "google_cloud_run_v2_service" "api" {
  name     = "\${var.project_name}-api"
  location = var.gcp_region

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      image = "\${var.gcp_region}-docker.pkg.dev/\${var.gcp_project_id}/\${google_artifact_registry_repository.api.repository_id}/${PRIMARY_BACKEND_NAME}:latest"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 10
      }
    }
  }

  depends_on = [google_project_service.apis]
}

# Allow unauthenticated access
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = var.gcp_region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "api_url" {
  value = google_cloud_run_v2_service.api.uri
}

output "artifact_registry" {
  value = "\${var.gcp_region}-docker.pkg.dev/\${var.gcp_project_id}/\${google_artifact_registry_repository.api.repository_id}"
}
`;
}

// ---------------------------------------------------------------------------
// Azure Container Apps Terraform
// ---------------------------------------------------------------------------

function azureMain(projectName: string): string {
  return `terraform {
  required_version = ">= 1.5"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "${projectName}"
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "\${var.project_name}-rg"
  location = var.location
}

# Container Registry
resource "azurerm_container_registry" "acr" {
  name                = replace("\${var.project_name}acr", "-", "")
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true
}

# Log Analytics (required for Container Apps)
resource "azurerm_log_analytics_workspace" "main" {
  name                = "\${var.project_name}-logs"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

# Container Apps Environment
resource "azurerm_container_app_environment" "main" {
  name                       = "\${var.project_name}-env"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
}

# Container App
resource "azurerm_container_app" "api" {
  name                         = "\${var.project_name}-api"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  template {
    min_replicas = 0
    max_replicas = 5

    container {
      name   = "${PRIMARY_BACKEND_NAME}"
      image  = "\${azurerm_container_registry.acr.login_server}/\${var.project_name}-api:latest"
      cpu    = 0.25
      memory = "0.5Gi"

      liveness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 8080
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  registry {
    server               = azurerm_container_registry.acr.login_server
    username             = azurerm_container_registry.acr.admin_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.acr.admin_password
  }
}

output "api_url" {
  value = "https://\${azurerm_container_app.api.ingress[0].fqdn}"
}

output "acr_login_server" {
  value = azurerm_container_registry.acr.login_server
}
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const CLOUD_NATIVE_PROVIDERS = new Set<DeployProvider>(["aws-ecs", "gcp-cloud-run", "azure-container-apps"]);

export async function writeTerraform(
  projectRoot: string,
  projectName: string,
  provider: DeployProvider,
): Promise<string[]> {
  if (!CLOUD_NATIVE_PROVIDERS.has(provider)) return [];

  const files: string[] = [];
  const tfDir = path.join(projectRoot, "deploy", "terraform");
  await fs.ensureDir(tfDir);

  switch (provider) {
    case "aws-ecs": {
      const writes: [string, string][] = [
        ["main.tf", awsMain(projectName)],
        ["variables.tf", awsVariables(projectName)],
        ["vpc.tf", awsVpc(projectName)],
        ["ecr.tf", awsEcr()],
        ["ecs.tf", awsEcs()],
        ["alb.tf", awsAlb()],
        ["outputs.tf", awsOutputs()],
        ["terraform.tfvars", awsTfvars(projectName)],
      ];
      await Promise.all(writes.map(([name, content]) => {
        files.push(`deploy/terraform/${name}`);
        return fs.writeFile(path.join(tfDir, name), content);
      }));
      break;
    }
    case "gcp-cloud-run": {
      files.push("deploy/terraform/main.tf");
      await fs.writeFile(path.join(tfDir, "main.tf"), gcpMain(projectName));
      break;
    }
    case "azure-container-apps": {
      files.push("deploy/terraform/main.tf");
      await fs.writeFile(path.join(tfDir, "main.tf"), azureMain(projectName));
      break;
    }
  }

  return files;
}
