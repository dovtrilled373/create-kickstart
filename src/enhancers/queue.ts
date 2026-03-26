import fs from "fs-extra";
import path from "path";
import { ProjectConfig, Registry } from "../types.js";
import { getRegistryEntry } from "../registry.js";
import { resolveProjectDirs, appendEnvVars } from "./utils.js";

// ---------------------------------------------------------------------------
// RabbitMQ — publisher + consumer per language
// ---------------------------------------------------------------------------

function pythonRabbitPublisher(): string {
  return `"""RabbitMQ publisher.

Usage: pip install pika

RABBITMQ_URL is read from .env — see .env.example.
"""

import os
import json
import pika

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")


def publish(queue: str, message: dict) -> None:
    """Publish a JSON message to the given queue."""
    connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
    channel = connection.channel()
    channel.queue_declare(queue=queue, durable=True)
    channel.basic_publish(
        exchange="",
        routing_key=queue,
        body=json.dumps(message),
        properties=pika.BasicProperties(delivery_mode=2),
    )
    connection.close()
`;
}

function pythonRabbitConsumer(): string {
  return `"""RabbitMQ consumer.

Usage: pip install pika

RABBITMQ_URL is read from .env — see .env.example.
"""

import os
import json
import pika

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")


def consume(queue: str, callback) -> None:
    """Start consuming messages from the given queue.

    callback receives (channel, method, properties, body_dict).
    """
    connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
    channel = connection.channel()
    channel.queue_declare(queue=queue, durable=True)

    def _on_message(ch, method, properties, body):
        callback(ch, method, properties, json.loads(body))
        ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=queue, on_message_callback=_on_message)
    print(f" [*] Waiting for messages on '{queue}'. Press CTRL+C to exit")
    channel.start_consuming()
`;
}

function tsRabbitPublisher(): string {
  return `/**
 * RabbitMQ publisher.
 *
 * Usage: npm install amqplib @types/amqplib
 *
 * RABBITMQ_URL is read from .env — see .env.example.
 */

import amqp from "amqplib";

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672";

export async function publish(queue: string, message: Record<string, unknown>): Promise<void> {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue(queue, { durable: true });
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
  await channel.close();
  await connection.close();
}
`;
}

function tsRabbitConsumer(): string {
  return `/**
 * RabbitMQ consumer.
 *
 * Usage: npm install amqplib @types/amqplib
 *
 * RABBITMQ_URL is read from .env — see .env.example.
 */

import amqp from "amqplib";

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672";

export async function consume(
  queue: string,
  callback: (msg: Record<string, unknown>) => void | Promise<void>,
): Promise<void> {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue(queue, { durable: true });
  await channel.prefetch(1);

  console.log(\` [*] Waiting for messages on '\${queue}'. Press CTRL+C to exit\`);

  channel.consume(queue, async (msg) => {
    if (!msg) return;
    await callback(JSON.parse(msg.content.toString()));
    channel.ack(msg);
  });
}
`;
}

function goRabbitPublisher(): string {
  return `package queue

// RabbitMQ publisher.
//
// Usage: go get github.com/rabbitmq/amqp091-go
//
// RABBITMQ_URL is read from environment — see .env.example.

import (
	"context"
	"encoding/json"
	"os"

	amqp "github.com/rabbitmq/amqp091-go"
)

func getRabbitURL() string {
	url := os.Getenv("RABBITMQ_URL")
	if url == "" {
		return "amqp://guest:guest@localhost:5672/"
	}
	return url
}

func Publish(queue string, message interface{}) error {
	conn, err := amqp.Dial(getRabbitURL())
	if err != nil {
		return err
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		return err
	}
	defer ch.Close()

	_, err = ch.QueueDeclare(queue, true, false, false, false, nil)
	if err != nil {
		return err
	}

	body, err := json.Marshal(message)
	if err != nil {
		return err
	}

	return ch.PublishWithContext(context.Background(), "", queue, false, false, amqp.Publishing{
		DeliveryMode: amqp.Persistent,
		ContentType:  "application/json",
		Body:         body,
	})
}
`;
}

function goRabbitConsumer(): string {
  return `package queue

// RabbitMQ consumer.
//
// Usage: go get github.com/rabbitmq/amqp091-go

import (
	"encoding/json"
	"log"

	amqp "github.com/rabbitmq/amqp091-go"
)

func Consume(queue string, handler func(map[string]interface{}) error) error {
	conn, err := amqp.Dial(getRabbitURL())
	if err != nil {
		return err
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		return err
	}
	defer ch.Close()

	_, err = ch.QueueDeclare(queue, true, false, false, false, nil)
	if err != nil {
		return err
	}

	ch.Qos(1, 0, false)

	msgs, err := ch.Consume(queue, "", false, false, false, false, nil)
	if err != nil {
		return err
	}

	log.Printf(" [*] Waiting for messages on '%s'. Press CTRL+C to exit", queue)

	for d := range msgs {
		var body map[string]interface{}
		if err := json.Unmarshal(d.Body, &body); err != nil {
			log.Printf("Failed to unmarshal message: %v", err)
			d.Nack(false, true)
			continue
		}
		if err := handler(body); err != nil {
			log.Printf("Handler error: %v", err)
			d.Nack(false, true)
			continue
		}
		d.Ack(false)
	}

	return nil
}
`;
}

function rustRabbitPublisher(): string {
  return `//! RabbitMQ publisher.
//!
//! Add to Cargo.toml:
//!   lapin = "2"
//!   serde_json = "1"
//!   tokio = { version = "1", features = ["full"] }

use lapin::{options::*, types::FieldTable, BasicProperties, Connection, ConnectionProperties};
use std::env;

pub async fn publish(queue: &str, message: &serde_json::Value) -> lapin::Result<()> {
    let url = env::var("RABBITMQ_URL").unwrap_or_else(|_| "amqp://guest:guest@localhost:5672/%2f".into());
    let conn = Connection::connect(&url, ConnectionProperties::default()).await?;
    let channel = conn.create_channel().await?;

    channel.queue_declare(queue, QueueDeclareOptions { durable: true, ..Default::default() }, FieldTable::default()).await?;

    let payload = serde_json::to_vec(message).unwrap();
    channel.basic_publish("", queue, BasicPublishOptions::default(), &payload, BasicProperties::default().with_delivery_mode(2)).await?;

    Ok(())
}
`;
}

function rustRabbitConsumer(): string {
  return `//! RabbitMQ consumer.
//!
//! Add to Cargo.toml:
//!   lapin = "2"
//!   serde_json = "1"
//!   tokio = { version = "1", features = ["full"] }
//!   futures-lite = "2"

use futures_lite::stream::StreamExt;
use lapin::{options::*, types::FieldTable, Connection, ConnectionProperties};
use std::env;

pub async fn consume<F>(queue: &str, handler: F) -> lapin::Result<()>
where
    F: Fn(serde_json::Value) -> lapin::Result<()>,
{
    let url = env::var("RABBITMQ_URL").unwrap_or_else(|_| "amqp://guest:guest@localhost:5672/%2f".into());
    let conn = Connection::connect(&url, ConnectionProperties::default()).await?;
    let channel = conn.create_channel().await?;

    channel.queue_declare(queue, QueueDeclareOptions { durable: true, ..Default::default() }, FieldTable::default()).await?;
    channel.basic_qos(1, BasicQosOptions::default()).await?;

    let mut consumer = channel.basic_consume(queue, "consumer", BasicConsumeOptions::default(), FieldTable::default()).await?;

    println!(" [*] Waiting for messages on '{}'. Press CTRL+C to exit", queue);

    while let Some(delivery) = consumer.next().await {
        let delivery = delivery?;
        let body: serde_json::Value = serde_json::from_slice(&delivery.data).unwrap();
        handler(body)?;
        delivery.ack(BasicAckOptions::default()).await?;
    }

    Ok(())
}
`;
}

function csharpRabbitPublisher(): string {
  return `// RabbitMQ publisher.
//
// Add NuGet package: RabbitMQ.Client
// RABBITMQ_URL is read from environment — see .env.example.

using System;
using System.Text;
using System.Text.Json;
using RabbitMQ.Client;

namespace App.Queue;

public class Publisher
{
    private static readonly string RabbitUrl = Environment.GetEnvironmentVariable("RABBITMQ_URL") ?? "amqp://guest:guest@localhost:5672/";

    public static void Publish(string queue, object message)
    {
        var factory = new ConnectionFactory { Uri = new Uri(RabbitUrl) };
        using var connection = factory.CreateConnection();
        using var channel = connection.CreateModel();

        channel.QueueDeclare(queue, durable: true, exclusive: false, autoDelete: false);

        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(message));
        var props = channel.CreateBasicProperties();
        props.Persistent = true;

        channel.BasicPublish("", queue, props, body);
    }
}
`;
}

function csharpRabbitConsumer(): string {
  return `// RabbitMQ consumer.
//
// Add NuGet package: RabbitMQ.Client
// RABBITMQ_URL is read from environment — see .env.example.

using System;
using System.Text;
using System.Text.Json;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace App.Queue;

public class Consumer
{
    private static readonly string RabbitUrl = Environment.GetEnvironmentVariable("RABBITMQ_URL") ?? "amqp://guest:guest@localhost:5672/";

    public static void Consume(string queue, Action<JsonElement> handler)
    {
        var factory = new ConnectionFactory { Uri = new Uri(RabbitUrl) };
        using var connection = factory.CreateConnection();
        using var channel = connection.CreateModel();

        channel.QueueDeclare(queue, durable: true, exclusive: false, autoDelete: false);
        channel.BasicQos(0, 1, false);

        var consumer = new EventingBasicConsumer(channel);
        consumer.Received += (_, ea) =>
        {
            var body = JsonSerializer.Deserialize<JsonElement>(Encoding.UTF8.GetString(ea.Body.ToArray()));
            handler(body);
            channel.BasicAck(ea.DeliveryTag, false);
        };

        channel.BasicConsume(queue, false, consumer);
        Console.WriteLine($" [*] Waiting for messages on '{queue}'. Press CTRL+C to exit");
        Console.ReadLine();
    }
}
`;
}

function elixirRabbitPublisher(): string {
  return `defmodule App.Queue.Publisher do
  @moduledoc """
  RabbitMQ publisher using the amqp library.

  Add to mix.exs deps: {:amqp, "~> 3.3"}

  RABBITMQ_URL is read from environment — see .env.example.
  """

  @default_url "amqp://guest:guest@localhost:5672"

  def publish(queue, message) do
    url = System.get_env("RABBITMQ_URL", @default_url)
    {:ok, conn} = AMQP.Connection.open(url)
    {:ok, chan} = AMQP.Channel.open(conn)

    AMQP.Queue.declare(chan, queue, durable: true)

    AMQP.Basic.publish(chan, "", queue, Jason.encode!(message),
      persistent: true,
      content_type: "application/json"
    )

    AMQP.Channel.close(chan)
    AMQP.Connection.close(conn)
  end
end
`;
}

function elixirRabbitConsumer(): string {
  return `defmodule App.Queue.Consumer do
  @moduledoc """
  RabbitMQ consumer using the amqp library.

  Add to mix.exs deps: {:amqp, "~> 3.3"}

  RABBITMQ_URL is read from environment — see .env.example.
  """

  use GenServer

  @default_url "amqp://guest:guest@localhost:5672"

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(opts) do
    queue = Keyword.fetch!(opts, :queue)
    url = System.get_env("RABBITMQ_URL", @default_url)
    {:ok, conn} = AMQP.Connection.open(url)
    {:ok, chan} = AMQP.Channel.open(conn)

    AMQP.Queue.declare(chan, queue, durable: true)
    AMQP.Basic.qos(chan, prefetch_count: 1)
    AMQP.Basic.consume(chan, queue)

    {:ok, %{channel: chan, handler: Keyword.get(opts, :handler, &IO.inspect/1)}}
  end

  @impl true
  def handle_info({:basic_deliver, payload, meta}, state) do
    message = Jason.decode!(payload)
    state.handler.(message)
    AMQP.Basic.ack(state.channel, meta.delivery_tag)
    {:noreply, state}
  end

  @impl true
  def handle_info({:basic_consume_ok, _}, state), do: {:noreply, state}
end
`;
}

// ---------------------------------------------------------------------------
// Kafka — publisher + consumer per language
// ---------------------------------------------------------------------------

function pythonKafkaPublisher(): string {
  return `"""Kafka producer.

Usage: pip install confluent-kafka

KAFKA_BROKERS is read from .env — see .env.example.
"""

import os
import json
from confluent_kafka import Producer

KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")

_producer = Producer({"bootstrap.servers": KAFKA_BROKERS})


def publish(topic: str, message: dict, key: str | None = None) -> None:
    """Produce a JSON message to the given Kafka topic."""
    _producer.produce(
        topic,
        value=json.dumps(message).encode("utf-8"),
        key=key.encode("utf-8") if key else None,
    )
    _producer.flush()
`;
}

function pythonKafkaConsumer(): string {
  return `"""Kafka consumer.

Usage: pip install confluent-kafka

KAFKA_BROKERS is read from .env — see .env.example.
"""

import os
import json
from confluent_kafka import Consumer as KafkaConsumer

KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")


def consume(topic: str, group_id: str, callback) -> None:
    """Start consuming messages from the given Kafka topic.

    callback receives a dict (the decoded JSON message).
    """
    consumer = KafkaConsumer({
        "bootstrap.servers": KAFKA_BROKERS,
        "group.id": group_id,
        "auto.offset.reset": "earliest",
    })
    consumer.subscribe([topic])

    print(f" [*] Consuming from '{topic}' (group: {group_id}). Press CTRL+C to exit")

    try:
        while True:
            msg = consumer.poll(1.0)
            if msg is None:
                continue
            if msg.error():
                print(f"Consumer error: {msg.error()}")
                continue
            callback(json.loads(msg.value().decode("utf-8")))
    finally:
        consumer.close()
`;
}

function tsKafkaPublisher(): string {
  return `/**
 * Kafka producer.
 *
 * Usage: npm install kafkajs
 *
 * KAFKA_BROKERS is read from .env — see .env.example.
 */

import { Kafka } from "kafkajs";

const kafka = new Kafka({
  brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
});

const producer = kafka.producer();
let connected = false;

export async function publish(topic: string, message: Record<string, unknown>, key?: string): Promise<void> {
  if (!connected) {
    await producer.connect();
    connected = true;
  }
  await producer.send({
    topic,
    messages: [{ key, value: JSON.stringify(message) }],
  });
}
`;
}

function tsKafkaConsumer(): string {
  return `/**
 * Kafka consumer.
 *
 * Usage: npm install kafkajs
 *
 * KAFKA_BROKERS is read from .env — see .env.example.
 */

import { Kafka } from "kafkajs";

const kafka = new Kafka({
  brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
});

export async function consume(
  topic: string,
  groupId: string,
  handler: (msg: Record<string, unknown>) => void | Promise<void>,
): Promise<void> {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  console.log(\` [*] Consuming from '\${topic}' (group: \${groupId}). Press CTRL+C to exit\`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (message.value) {
        await handler(JSON.parse(message.value.toString()));
      }
    },
  });
}
`;
}

function goKafkaPublisher(): string {
  return `package queue

// Kafka producer.
//
// Usage: go get github.com/segmentio/kafka-go
//
// KAFKA_BROKERS is read from environment — see .env.example.

import (
	"context"
	"encoding/json"
	"os"
	"strings"

	"github.com/segmentio/kafka-go"
)

func getKafkaBrokers() []string {
	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		return []string{"localhost:9092"}
	}
	return strings.Split(brokers, ",")
}

func KafkaPublish(topic string, message interface{}, key string) error {
	writer := &kafka.Writer{
		Addr:  kafka.TCP(getKafkaBrokers()...),
		Topic: topic,
	}
	defer writer.Close()

	body, err := json.Marshal(message)
	if err != nil {
		return err
	}

	return writer.WriteMessages(context.Background(), kafka.Message{
		Key:   []byte(key),
		Value: body,
	})
}
`;
}

function goKafkaConsumer(): string {
  return `package queue

// Kafka consumer.
//
// Usage: go get github.com/segmentio/kafka-go

import (
	"context"
	"encoding/json"
	"log"

	"github.com/segmentio/kafka-go"
)

func KafkaConsume(topic, groupID string, handler func(map[string]interface{}) error) error {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: getKafkaBrokers(),
		GroupID: groupID,
		Topic:   topic,
	})
	defer reader.Close()

	log.Printf(" [*] Consuming from '%s' (group: %s). Press CTRL+C to exit", topic, groupID)

	for {
		msg, err := reader.ReadMessage(context.Background())
		if err != nil {
			return err
		}
		var body map[string]interface{}
		if err := json.Unmarshal(msg.Value, &body); err != nil {
			log.Printf("Failed to unmarshal message: %v", err)
			continue
		}
		if err := handler(body); err != nil {
			log.Printf("Handler error: %v", err)
		}
	}
}
`;
}

function rustKafkaPublisher(): string {
  return `//! Kafka producer.
//!
//! Add to Cargo.toml:
//!   rdkafka = { version = "0.36", features = ["cmake-build"] }
//!   serde_json = "1"

use rdkafka::config::ClientConfig;
use rdkafka::producer::{FutureProducer, FutureRecord};
use std::env;
use std::time::Duration;

pub async fn publish(topic: &str, message: &serde_json::Value, key: Option<&str>) -> Result<(), Box<dyn std::error::Error>> {
    let brokers = env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".into());
    let producer: FutureProducer = ClientConfig::new()
        .set("bootstrap.servers", &brokers)
        .create()?;

    let payload = serde_json::to_string(message)?;
    let mut record = FutureRecord::to(topic).payload(&payload);
    if let Some(k) = key {
        record = record.key(k);
    }

    producer.send(record, Duration::from_secs(5)).await.map_err(|(e, _)| e)?;
    Ok(())
}
`;
}

function rustKafkaConsumer(): string {
  return `//! Kafka consumer.
//!
//! Add to Cargo.toml:
//!   rdkafka = { version = "0.36", features = ["cmake-build"] }
//!   serde_json = "1"

use rdkafka::config::ClientConfig;
use rdkafka::consumer::{CommitMode, Consumer, StreamConsumer};
use rdkafka::Message;
use futures_lite::stream::StreamExt;
use std::env;

pub async fn consume<F>(topic: &str, group_id: &str, handler: F) -> Result<(), Box<dyn std::error::Error>>
where
    F: Fn(serde_json::Value) -> Result<(), Box<dyn std::error::Error>>,
{
    let brokers = env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".into());
    let consumer: StreamConsumer = ClientConfig::new()
        .set("bootstrap.servers", &brokers)
        .set("group.id", group_id)
        .set("auto.offset.reset", "earliest")
        .create()?;

    consumer.subscribe(&[topic])?;
    println!(" [*] Consuming from '{}' (group: {}). Press CTRL+C to exit", topic, group_id);

    let mut stream = consumer.stream();
    while let Some(result) = stream.next().await {
        let msg = result?;
        if let Some(payload) = msg.payload() {
            let body: serde_json::Value = serde_json::from_slice(payload)?;
            handler(body)?;
        }
        consumer.commit_message(&msg, CommitMode::Async)?;
    }

    Ok(())
}
`;
}

function csharpKafkaPublisher(): string {
  return `// Kafka producer.
//
// Add NuGet package: Confluent.Kafka
// KAFKA_BROKERS is read from environment — see .env.example.

using System;
using System.Text.Json;
using Confluent.Kafka;

namespace App.Queue;

public class Publisher
{
    private static readonly string Brokers = Environment.GetEnvironmentVariable("KAFKA_BROKERS") ?? "localhost:9092";

    public static void Publish(string topic, object message, string? key = null)
    {
        var config = new ProducerConfig { BootstrapServers = Brokers };
        using var producer = new ProducerBuilder<string, string>(config).Build();
        producer.Produce(topic, new Message<string, string>
        {
            Key = key ?? "",
            Value = JsonSerializer.Serialize(message),
        });
        producer.Flush(TimeSpan.FromSeconds(5));
    }
}
`;
}

function csharpKafkaConsumer(): string {
  return `// Kafka consumer.
//
// Add NuGet package: Confluent.Kafka
// KAFKA_BROKERS is read from environment — see .env.example.

using System;
using System.Text.Json;
using Confluent.Kafka;

namespace App.Queue;

public class Consumer
{
    private static readonly string Brokers = Environment.GetEnvironmentVariable("KAFKA_BROKERS") ?? "localhost:9092";

    public static void Consume(string topic, string groupId, Action<JsonElement> handler)
    {
        var config = new ConsumerConfig
        {
            BootstrapServers = Brokers,
            GroupId = groupId,
            AutoOffsetReset = AutoOffsetReset.Earliest,
        };

        using var consumer = new ConsumerBuilder<Ignore, string>(config).Build();
        consumer.Subscribe(topic);

        Console.WriteLine($" [*] Consuming from '{topic}' (group: {groupId}). Press CTRL+C to exit");

        while (true)
        {
            var result = consumer.Consume();
            var body = JsonSerializer.Deserialize<JsonElement>(result.Message.Value);
            handler(body);
        }
    }
}
`;
}

function elixirKafkaPublisher(): string {
  return `defmodule App.Queue.Publisher do
  @moduledoc """
  Kafka producer using brod.

  Add to mix.exs deps: {:brod, "~> 3.16"}

  KAFKA_BROKERS is read from environment — see .env.example.
  """

  def publish(topic, message, key \\\\ "") do
    brokers = get_brokers()
    :ok = :brod.start_client(brokers, :kafka_client)
    :ok = :brod.start_producer(:kafka_client, topic, [])
    :brod.produce_sync(:kafka_client, topic, :hash, key, Jason.encode!(message))
  end

  defp get_brokers do
    (System.get_env("KAFKA_BROKERS") || "localhost:9092")
    |> String.split(",")
    |> Enum.map(fn broker ->
      [host, port] = String.split(broker, ":")
      {host, String.to_integer(port)}
    end)
  end
end
`;
}

function elixirKafkaConsumer(): string {
  return `defmodule App.Queue.Consumer do
  @moduledoc """
  Kafka consumer using brod.

  Add to mix.exs deps: {:brod, "~> 3.16"}

  KAFKA_BROKERS is read from environment — see .env.example.
  """

  @behaviour :brod_group_subscriber

  def start_link(topic, group_id, handler) do
    brokers = get_brokers()
    :ok = :brod.start_client(brokers, :kafka_client)

    :brod.start_link_group_subscriber(
      :kafka_client,
      group_id,
      [topic],
      _config = [],
      _cb_module = __MODULE__,
      _cb_config = %{handler: handler}
    )
  end

  @impl true
  def handle_message(_topic, _partition, message, %{handler: handler} = state) do
    value = :brod.message_value(message)
    handler.(Jason.decode!(value))
    {:ok, :ack, state}
  end

  defp get_brokers do
    (System.get_env("KAFKA_BROKERS") || "localhost:9092")
    |> String.split(",")
    |> Enum.map(fn broker ->
      [host, port] = String.split(broker, ":")
      {host, String.to_integer(port)}
    end)
  end
end
`;
}

// ---------------------------------------------------------------------------
// File writers per provider
// ---------------------------------------------------------------------------

function getRabbitFiles(lang: string): { publisher: string; consumer: string; ext: string; dir: string } | null {
  switch (lang) {
    case "python":
      return { publisher: pythonRabbitPublisher(), consumer: pythonRabbitConsumer(), ext: "py", dir: "app/queue" };
    case "typescript":
      return { publisher: tsRabbitPublisher(), consumer: tsRabbitConsumer(), ext: "ts", dir: "src/queue" };
    case "go":
      return { publisher: goRabbitPublisher(), consumer: goRabbitConsumer(), ext: "go", dir: "internal/queue" };
    case "rust":
      return { publisher: rustRabbitPublisher(), consumer: rustRabbitConsumer(), ext: "rs", dir: "src/queue" };
    case "csharp":
      return { publisher: csharpRabbitPublisher(), consumer: csharpRabbitConsumer(), ext: "cs", dir: "Queue" };
    case "elixir":
      return { publisher: elixirRabbitPublisher(), consumer: elixirRabbitConsumer(), ext: "ex", dir: "lib/app/queue" };
    default:
      return null;
  }
}

function getKafkaFiles(lang: string): { publisher: string; consumer: string; ext: string; dir: string } | null {
  switch (lang) {
    case "python":
      return { publisher: pythonKafkaPublisher(), consumer: pythonKafkaConsumer(), ext: "py", dir: "app/queue" };
    case "typescript":
      return { publisher: tsKafkaPublisher(), consumer: tsKafkaConsumer(), ext: "ts", dir: "src/queue" };
    case "go":
      return { publisher: goKafkaPublisher(), consumer: goKafkaConsumer(), ext: "go", dir: "internal/queue" };
    case "rust":
      return { publisher: rustKafkaPublisher(), consumer: rustKafkaConsumer(), ext: "rs", dir: "src/queue" };
    case "csharp":
      return { publisher: csharpKafkaPublisher(), consumer: csharpKafkaConsumer(), ext: "cs", dir: "Queue" };
    case "elixir":
      return { publisher: elixirKafkaPublisher(), consumer: elixirKafkaConsumer(), ext: "ex", dir: "lib/app/queue" };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enhanceQueue(config: ProjectConfig, registry: Registry): Promise<void> {
  const { beDir } = resolveProjectDirs(config);
  const provider = config.queueProvider ?? "rabbitmq";

  if (config.backend) {
    const beEntry = getRegistryEntry(registry, "backend", config.backend);
    const lang = beEntry.lang;

    const files = provider === "kafka" ? getKafkaFiles(lang) : getRabbitFiles(lang);

    if (files) {
      const queueDir = path.join(beDir, files.dir);
      await fs.ensureDir(queueDir);
      await fs.writeFile(path.join(queueDir, `publisher.${files.ext}`), files.publisher);
      await fs.writeFile(path.join(queueDir, `consumer.${files.ext}`), files.consumer);
    }
  }

  // Append env vars
  if (provider === "kafka") {
    await appendEnvVars(
      config.targetDir,
      "KAFKA_BROKERS",
      "\n# Kafka\nKAFKA_BROKERS=localhost:9092\n",
    );
  } else {
    await appendEnvVars(
      config.targetDir,
      "RABBITMQ_URL",
      "\n# RabbitMQ\nRABBITMQ_URL=amqp://guest:guest@localhost:5672/\n",
    );
  }
}
