export type RpcResult<T> = {
  data: T | null;
  error: { message?: string } | null;
};

export type WorkerRpcClient = {
  rpc<T>(name: string, args: Record<string, unknown>): Promise<RpcResult<T>>;
};

export type ClaimedDocumentJob = {
  jobId: string;
  ownerId: string;
  documentId: string;
  storagePath: string;
  mimeType: string;
  originalFilename: string;
  attempts: number;
};

type ClaimedDocumentJobRow = {
  job_id: string;
  owner_id: string;
  document_id: string;
  storage_path: string;
  mime_type: string;
  original_filename: string;
  attempts: number;
};

function assertNoRpcError(result: RpcResult<unknown>, action: string): void {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message ?? "Supabase RPC failed"}`);
  }
}

function mapClaimedJob(row: ClaimedDocumentJobRow): ClaimedDocumentJob {
  return {
    jobId: row.job_id,
    ownerId: row.owner_id,
    documentId: row.document_id,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    originalFilename: row.original_filename,
    attempts: row.attempts,
  };
}

export async function claimNextDocumentJob(
  client: WorkerRpcClient,
  workerId: string,
): Promise<ClaimedDocumentJob | null> {
  const result = await client.rpc<ClaimedDocumentJobRow[]>("claim_document_job", {
    p_worker_id: workerId,
  });

  assertNoRpcError(result, "claim_document_job");

  const row = result.data?.[0];
  return row ? mapClaimedJob(row) : null;
}

export async function finishDocumentJobSuccess(
  client: WorkerRpcClient,
  input: {
    jobId: string;
    ownerId: string;
    documentId: string;
    extractedText: string;
  },
): Promise<void> {
  const result = await client.rpc("finish_document_job_success", {
    p_job_id: input.jobId,
    p_owner_id: input.ownerId,
    p_document_id: input.documentId,
    p_extracted_text: input.extractedText,
  });

  assertNoRpcError(result, "finish_document_job_success");
}

export async function finishDocumentJobFailure(
  client: WorkerRpcClient,
  input: {
    jobId: string;
    ownerId: string;
    documentId: string;
    error: string;
  },
): Promise<void> {
  const result = await client.rpc("finish_document_job_failure", {
    p_job_id: input.jobId,
    p_owner_id: input.ownerId,
    p_document_id: input.documentId,
    p_error: input.error,
  });

  assertNoRpcError(result, "finish_document_job_failure");
}
