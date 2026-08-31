import amqp, { Channel, ConsumeMessage } from "amqplib";
import { EventMessage } from "../../types/event";

type Connection = Awaited<ReturnType<typeof amqp.connect>>;

let connection: Connection;
let channel: Channel;

export async function connect(): Promise<void> {
  //connect to the server
  connection = await amqp.connect(process.env.AMQP_URL!);

  //create a channel
  channel = await connection.createChannel();

  await channel.assertExchange(process.env.EXCHANGE!, "topic", {
    durable: true,
  });

  await channel.prefetch(20); // don't let one consumer hoard the whole queue
}

export async function close(): Promise<void> {
  await channel?.close();
  await connection?.close();
}

// Event is published to exchange, keyed by its type (routing key).
export function publish(envelope: EventMessage): void {
  channel.publish(
    process.env.EXCHANGE!,
    envelope.type,
    Buffer.from(JSON.stringify(envelope)),
    {
      persistent: true,
      messageId: envelope.eventId,
      contentType: "application/json",
    }
  );
}

type Handler = (envelope: EventMessage) => Promise<void>;

export async function consume(
  queue: string,
  routingKey: string,
  handler: Handler
): Promise<void> {
  const retryQueue = `${queue}.retry`;
  const deadQueue = `${queue}.dead`;

  await channel.assertQueue(queue, { durable: true });
  await channel.bindQueue(queue, process.env.EXCHANGE!, routingKey);

  // After RETRY_DELAY the message dead-letters (default exchange) back to the main queue.
  await channel.assertQueue(retryQueue, {
    durable: true,
    arguments: {
      "x-message-ttl": Number(process.env.RETRY_DELAY_MS!),
      "x-dead-letter-exchange": "",
      "x-dead-letter-routing-key": queue,
    },
  });
  await channel.assertQueue(deadQueue, { durable: true });

  await channel.consume(queue, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    const attempts = Number(msg.properties.headers?.["x-attempts"] ?? 0);

    try {
      const envelope = JSON.parse(msg.content.toString()) as EventMessage;
      await handler(envelope);

      channel.ack(msg);
    } catch (error) {
      console.error(
        `[${queue}] handler failed (attempt ${attempts + 1}):`,
        error
      );

      if (attempts + 1 < Number(process.env.MAX_RETRIES!)) {
        // Re-inject with an incremented attempt count.
        channel.sendToQueue(retryQueue, msg.content, {
          persistent: true,
          headers: { ...msg.properties.headers, "x-attempts": attempts + 1 },
        });
      } else {
        // No more retries, move to DLQ; should have alerting for eyes on it
        console.error(`[${queue}] max retries reached; ${deadQueue}`);

        channel.sendToQueue(deadQueue, msg.content, {
          persistent: true,
          headers: { ...msg.properties.headers, "x-attempts": attempts + 1 },
        });
      }

      channel.ack(msg); // original is settled; the copy lives in retry/dead
    }
  });

  console.log(`[${queue}] consuming '${routingKey}'`);
}
