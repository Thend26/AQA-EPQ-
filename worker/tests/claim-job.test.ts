import assert from "node:assert/strict";
import { test } from "node:test";

import {
  claimNextDocumentJob,
  finishDocumentJobFailure,
  finishDocumentJobSuccess,
  type RpcResult,
  type WorkerRpcClient,
} from "../src/claim-job.ts";

function createRpcClient(responses: Record<string, RpcResult<unknown>>) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];

  return {
    calls,
    client: {
      async rpc<T>(name: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
        calls.push({ name, args });
        return (responses[name] ?? { data: null, error: null }) as RpcResult<T>;
      },
    } satisfies WorkerRpcClient,
  };
}

test("claims the next queued document job through the worker RPC", async () => {
  const { client, calls } = createRpcClient({
    claim_document_job: {
      data: [
        {
          job_id: "job-1",
          owner_id: "owner-1",
          document_id: "doc-1",
          storage_path: "owner-1/documents/doc-1/sample.pdf",
          mime_type: "application/pdf",
          original_filename: "sample.pdf",
          attempts: 1,
        },
      ],
      error: null,
    },
  });

  const job = await claimNextDocumentJob(client, "worker-a");

  assert.equal(job?.jobId, "job-1");
  assert.equal(job?.storagePath, "owner-1/documents/doc-1/sample.pdf");
  assert.deepEqual(calls[0], {
    name: "claim_document_job",
    args: { p_worker_id: "worker-a" },
  });
});

test("finishes successful document extraction through the worker RPC", async () => {
  const { client, calls } = createRpcClient({
    finish_document_job_success: { data: null, error: null },
  });

  await finishDocumentJobSuccess(client, {
    jobId: "job-1",
    ownerId: "owner-1",
    documentId: "doc-1",
    extractedText: "AO1 evidence",
  });

  assert.deepEqual(calls[0], {
    name: "finish_document_job_success",
    args: {
      p_job_id: "job-1",
      p_owner_id: "owner-1",
      p_document_id: "doc-1",
      p_extracted_text: "AO1 evidence",
    },
  });
});

test("records failed document extraction through the worker RPC", async () => {
  const { client, calls } = createRpcClient({
    finish_document_job_failure: { data: null, error: null },
  });

  await finishDocumentJobFailure(client, {
    jobId: "job-1",
    ownerId: "owner-1",
    documentId: "doc-1",
    error: "OCR_UNAVAILABLE",
  });

  assert.deepEqual(calls[0], {
    name: "finish_document_job_failure",
    args: {
      p_job_id: "job-1",
      p_owner_id: "owner-1",
      p_document_id: "doc-1",
      p_error: "OCR_UNAVAILABLE",
    },
  });
});
