import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry, ApiProtocol } from "../types.js";
import { getRegistryEntry } from "../registry.js";

// ---------------------------------------------------------------------------
// GraphQL — client-facing layer
// ---------------------------------------------------------------------------

function graphqlPythonSetup(): string {
  return `"""
GraphQL setup — FastAPI + Strawberry

Install: pip install strawberry-graphql[fastapi]
Docs: https://strawberry.rocks/docs/integrations/fastapi

Register in main.py:
  from app.graphql.schema import graphql_app
  app.include_router(graphql_app, prefix="/graphql")
"""

import strawberry
from strawberry.fastapi import GraphQLRouter
from typing import Optional


@strawberry.type
class Item:
    id: str
    title: str
    description: str
    completed: bool


# In-memory data (replace with DB queries)
_items = [
    Item(id="1", title="Example item", description="A sample item", completed=False),
]


@strawberry.type
class Query:
    @strawberry.field
    def items(self) -> list[Item]:
        return _items

    @strawberry.field
    def item(self, id: str) -> Optional[Item]:
        return next((i for i in _items if i.id == id), None)


@strawberry.input
class ItemInput:
    title: str
    description: str = ""
    completed: bool = False


@strawberry.type
class Mutation:
    @strawberry.mutation
    def create_item(self, input: ItemInput) -> Item:
        import uuid
        item = Item(
            id=str(uuid.uuid4()),
            title=input.title,
            description=input.description,
            completed=input.completed,
        )
        _items.append(item)
        return item


schema = strawberry.Schema(query=Query, mutation=Mutation)
graphql_app = GraphQLRouter(schema)
`;
}

function graphqlNodeSetup(): string {
  return `/**
 * GraphQL setup — Express + Apollo Server
 *
 * Install: npm i @apollo/server graphql
 * Docs: https://www.apollographql.com/docs/apollo-server/
 *
 * Register in index.ts:
 *   import { setupGraphQL } from "./graphql/schema.js";
 *   await setupGraphQL(app);
 */
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { Express } from "express";

const typeDefs = \`#graphql
  type Item {
    id: ID!
    title: String!
    description: String!
    completed: Boolean!
  }

  input ItemInput {
    title: String!
    description: String
    completed: Boolean
  }

  type Query {
    items: [Item!]!
    item(id: ID!): Item
  }

  type Mutation {
    createItem(input: ItemInput!): Item!
  }
\`;

// In-memory data (replace with DB queries)
const items = [
  { id: "1", title: "Example item", description: "A sample item", completed: false },
];

const resolvers = {
  Query: {
    items: () => items,
    item: (_: unknown, { id }: { id: string }) => items.find((i) => i.id === id),
  },
  Mutation: {
    createItem: (_: unknown, { input }: { input: { title: string; description?: string; completed?: boolean } }) => {
      const item = {
        id: String(Date.now()),
        title: input.title,
        description: input.description ?? "",
        completed: input.completed ?? false,
      };
      items.push(item);
      return item;
    },
  },
};

export async function setupGraphQL(app: Express) {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  app.use("/graphql", expressMiddleware(server));
}
`;
}

function graphqlGoSetup(): string {
  return `package graphql

// GraphQL setup — Go + gqlgen
//
// Install:
//   go get github.com/99designs/gqlgen
//   go run github.com/99designs/gqlgen init
//
// Docs: https://gqlgen.com/getting-started/
//
// This file is a placeholder. Run gqlgen init to generate
// the full schema, resolvers, and server setup.

// schema.graphqls:
//
//   type Item {
//     id: ID!
//     title: String!
//     description: String!
//     completed: Boolean!
//   }
//
//   input ItemInput {
//     title: String!
//     description: String
//     completed: Boolean
//   }
//
//   type Query {
//     items: [Item!]!
//     item(id: ID!): Item
//   }
//
//   type Mutation {
//     createItem(input: ItemInput!): Item!
//   }
`;
}

// ---------------------------------------------------------------------------
// gRPC — internal service-to-service layer
// ---------------------------------------------------------------------------

function grpcProtoFile(serviceName: string): string {
  return `syntax = "proto3";

package ${serviceName};

option go_package = "./${serviceName}pb";

// Item represents a task/todo item
message Item {
  string id = 1;
  string title = 2;
  string description = 3;
  bool completed = 4;
}

message CreateItemRequest {
  string title = 1;
  string description = 2;
  bool completed = 3;
}

message GetItemRequest {
  string id = 1;
}

message ListItemsRequest {}

message ListItemsResponse {
  repeated Item items = 1;
}

message Empty {}

// ItemService — internal gRPC service
service ItemService {
  rpc ListItems(ListItemsRequest) returns (ListItemsResponse);
  rpc GetItem(GetItemRequest) returns (Item);
  rpc CreateItem(CreateItemRequest) returns (Item);
}
`;
}

function grpcPythonServer(): string {
  return `"""
gRPC server — Python

Install: pip install grpcio grpcio-tools

Generate stubs:
  python -m grpc_tools.protoc -I./proto \\
    --python_out=./app/grpc_gen \\
    --grpc_python_out=./app/grpc_gen \\
    proto/items.proto

Docs: https://grpc.io/docs/languages/python/
"""

# After generating stubs, implement the service:
#
# import grpc
# from concurrent import futures
# from app.grpc_gen import items_pb2, items_pb2_grpc
#
# class ItemServiceServicer(items_pb2_grpc.ItemServiceServicer):
#     def ListItems(self, request, context):
#         # Return items from database
#         return items_pb2.ListItemsResponse(items=[])
#
#     def GetItem(self, request, context):
#         # Look up item by ID
#         return items_pb2.Item()
#
#     def CreateItem(self, request, context):
#         # Create item in database
#         return items_pb2.Item()
#
# def serve():
#     server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
#     items_pb2_grpc.add_ItemServiceServicer_to_server(ItemServiceServicer(), server)
#     server.add_insecure_port("[::]:50051")
#     server.start()
#     server.wait_for_termination()
`;
}

function grpcNodeServer(): string {
  return `/**
 * gRPC server — Node.js
 *
 * Install: npm i @grpc/grpc-js @grpc/proto-loader
 *
 * Docs: https://grpc.io/docs/languages/node/
 */
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";

const PROTO_PATH = path.join(__dirname, "../../proto/items.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;

// Implement service
const items: any[] = [];

function listItems(call: any, callback: any) {
  callback(null, { items });
}

function getItem(call: any, callback: any) {
  const item = items.find((i) => i.id === call.request.id);
  if (!item) {
    callback({ code: grpc.status.NOT_FOUND, message: "Item not found" });
    return;
  }
  callback(null, item);
}

function createItem(call: any, callback: any) {
  const item = {
    id: String(Date.now()),
    title: call.request.title,
    description: call.request.description,
    completed: call.request.completed,
  };
  items.push(item);
  callback(null, item);
}

export function startGrpcServer(port = 50051) {
  const server = new grpc.Server();
  server.addService(protoDescriptor.items.ItemService.service, {
    listItems,
    getItem,
    createItem,
  });
  server.bindAsync(
    \`0.0.0.0:\${port}\`,
    grpc.ServerCredentials.createInsecure(),
    (err) => {
      if (err) throw err;
      console.log(\`gRPC server running on port \${port}\`);
    },
  );
  return server;
}
`;
}

function grpcGoServer(): string {
  return `package grpcserver

// gRPC server — Go
//
// Install:
//   go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
//   go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
//   go get google.golang.org/grpc
//
// Generate stubs:
//   protoc --go_out=. --go-grpc_out=. proto/items.proto
//
// Docs: https://grpc.io/docs/languages/go/

// After generating stubs:
//
// import (
// 	"context"
// 	"net"
// 	"google.golang.org/grpc"
// 	pb "your-module/proto/itemspb"
// )
//
// type server struct {
// 	pb.UnimplementedItemServiceServer
// }
//
// func (s *server) ListItems(ctx context.Context, req *pb.ListItemsRequest) (*pb.ListItemsResponse, error) {
// 	return &pb.ListItemsResponse{Items: []*pb.Item{}}, nil
// }
//
// func StartGRPCServer(addr string) error {
// 	lis, err := net.Listen("tcp", addr)
// 	if err != nil {
// 		return err
// 	}
// 	s := grpc.NewServer()
// 	pb.RegisterItemServiceServer(s, &server{})
// 	return s.Serve(lis)
// }
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceApiProtocol(config: ProjectConfig, registry: Registry): Promise<void> {
  const protocol = config.apiProtocol ?? "graphql";
  const isFullstack = config.type === "fullstack";
  const beDir = isFullstack ? path.join(config.targetDir, "backend") : config.targetDir;

  const doGraphql = protocol === "graphql" || protocol === "graphql+grpc";
  const doGrpc = protocol === "grpc" || protocol === "graphql+grpc";

  if (!config.backend) return;
  const beEntry = getRegistryEntry(registry, "backend", config.backend);

  // --- GraphQL ---
  if (doGraphql) {
    if (beEntry.lang === "python") {
      const gqlDir = path.join(beDir, "app", "graphql");
      await fs.ensureDir(gqlDir);
      await fs.writeFile(path.join(gqlDir, "__init__.py"), "");
      await fs.writeFile(path.join(gqlDir, "schema.py"), graphqlPythonSetup());
    } else if (beEntry.lang === "typescript") {
      const gqlDir = path.join(beDir, "src", "graphql");
      await fs.ensureDir(gqlDir);
      await fs.writeFile(path.join(gqlDir, "schema.ts"), graphqlNodeSetup());
    } else if (beEntry.lang === "go") {
      const gqlDir = path.join(beDir, "internal", "graphql");
      await fs.ensureDir(gqlDir);
      await fs.writeFile(path.join(gqlDir, "setup.go"), graphqlGoSetup());
    }
  }

  // --- gRPC ---
  if (doGrpc) {
    // Proto file at project root (shared between services)
    const protoDir = path.join(config.targetDir, "proto");
    await fs.ensureDir(protoDir);
    await fs.writeFile(path.join(protoDir, "items.proto"), grpcProtoFile(config.name.replace(/-/g, "_")));

    if (beEntry.lang === "python") {
      const grpcDir = path.join(beDir, "app", "grpc_server");
      await fs.ensureDir(grpcDir);
      await fs.writeFile(path.join(grpcDir, "__init__.py"), "");
      await fs.writeFile(path.join(grpcDir, "server.py"), grpcPythonServer());
    } else if (beEntry.lang === "typescript") {
      const grpcDir = path.join(beDir, "src", "grpc");
      await fs.ensureDir(grpcDir);
      await fs.writeFile(path.join(grpcDir, "server.ts"), grpcNodeServer());
    } else if (beEntry.lang === "go") {
      const grpcDir = path.join(beDir, "internal", "grpcserver");
      await fs.ensureDir(grpcDir);
      await fs.writeFile(path.join(grpcDir, "server.go"), grpcGoServer());
    }

    // Add gRPC port to .env
    const envExample = path.join(config.targetDir, ".env.example");
    if (await fs.pathExists(envExample)) {
      const contents = await fs.readFile(envExample, "utf-8");
      if (!contents.includes("GRPC_PORT")) {
        await fs.appendFile(envExample, "\n# gRPC (internal)\nGRPC_PORT=50051\n");
      }
    }
  }
}
