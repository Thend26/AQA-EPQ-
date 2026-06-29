import { readFile } from "node:fs/promises";

import {
  claimNextDocumentJob,
  finishDocumentJobFailure,
  finishDocumentJobSuccess,
  type WorkerRpcClient,
} from "./claim-job.ts";
import { loadWorkerConfig, type WorkerConfig } from "./config.ts";
import { ExtractionError, extractTextFromBuffer } from "./extract.ts";

type SupabaseRpcResponse<T> = {
  data: T | null;
  error: { message?: string } | null;
};

class SupabaseRestRpcClient implements WorkerRpcClient {
  private readonly config: WorkerConfig;

  constructor(config: WorkerConfig) {
    this.config = config;
  }

  async rpc<T>(name: string, args: Record<string, unknown>): Promise<SupabaseRpcResponse<T>> {
    const response = await fetch(`${this.config.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: this.config.supabaseServiceRoleKey,
        authorization: `Bearer ${this.config.supabaseServiceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        data: null,
        error: { message: body?.message ?? `RPC ${name} failed with ${response.status}` },
      };
    }

    return { data: body as T, error: null };
  }
}

async function downloadDocument(config: WorkerConfig, storagePath: string): Promise<Uint8Array> {
  const response = await fetch(
    `${config.supabaseUrl}/storage/v1/object/student-documents/${encodeURIComponent(storagePath)}`,
    {
      headers: {
        apikey: config.supabaseServiceRoleKey,
        authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`download failed with ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

export async function runWorkerOnce(
  client: WorkerRpcClient,
  config: Pick<WorkerConfig, "ocrEnabled">,
  readDocument: (storagePath: string) => Promise<Uint8Array>,
): Promise<boolean> {
  const job = await claimNextDocumentJob(client, "document-worker");

  if (!job) {
    return false;
  }

  try {
    const bytes = await readDocument(job.storagePath);
    const extracted = await extractTextFromBuffer({
      bytes,
      filename: job.originalFilename,
      mimeType: job.mimeType,
      ocrEnabled: config.ocrEnabled,
    });

    await finishDocumentJobSuccess(client, {
      jobId: job.jobId,
      ownerId: job.ownerId,
      documentId: job.documentId,
      extractedText: extracted.text,
    });
  } catch (error) {
    const message = error instanceof ExtractionError ? error.code : error instanceof Error ? error.message : "UNKNOWN";
    await finishDocumentJobFailure(client, {
      jobId: job.jobId,
      ownerId: job.ownerId,
      documentId: job.documentId,
      error: message,
    });
  }

  return true;
}

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const client = new SupabaseRestRpcClient(config);

  if (process.argv.includes("--local-file")) {
    const filePath = process.argv[process.argv.indexOf("--local-file") + 1];
    const filename = process.argv[process.argv.indexOf("--filename") + 1] ?? filePath;
    const mimeType = process.argv[process.argv.indexOf("--mime-type") + 1] ?? "application/octet-stream";
    const result = await extractTextFromBuffer({
      bytes: await readFile(filePath),
      filename,
      mimeType,
      ocrEnabled: config.ocrEnabled,
    });
    console.log(result.text);
    return;
  }

  const runOnce = async () => {
    await runWorkerOnce(client, config, (storagePath) => downloadDocument(config, storagePath));
  };

  if (process.argv.includes("--once")) {
    await runOnce();
    return;
  }

  for (;;) {
    await runOnce();
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
