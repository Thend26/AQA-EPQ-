"use client";

import { useEffect, useState } from "react";

import { MAX_DOCUMENT_BYTES, validateDocumentMetadata } from "@/lib/documents/file-validation";
import { createClient } from "@/lib/supabase/client";
import { requestWorkspaceJson } from "@/lib/workspace/api";
import { z } from "zod";

const documentSchema = z.object({
  id: z.string(),
  originalFilename: z.string(),
  status: z.string(),
}).passthrough();
const listSchema = z.object({ data: z.array(documentSchema) });
const createSchema = z.object({
  data: documentSchema,
  storagePath: z.string(),
});
const downloadSchema = z.object({ url: z.string().url() });

type DocumentItem = z.output<typeof documentSchema>;

export function DocumentPanel({
  studentId,
  campDay,
}: {
  studentId: string;
  campDay: number | null;
}) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const locked = campDay === null;

  async function load() {
    const result = await requestWorkspaceJson(
      fetch,
      `/api/documents?studentId=${studentId}`,
      { method: "GET" },
      listSchema,
    );
    setDocuments(result.data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch(() => setMessage("文档列表加载失败"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function sha256Hex(selected: File) {
    const digest = await crypto.subtle.digest("SHA-256", await selected.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function uploadDocument() {
    if (!file || locked || campDay === null || pending) return;
    setMessage("");
    const validation = validateDocumentMetadata({
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    });
    if (!validation.ok) {
      setMessage(validation.error);
      return;
    }
    setPending(true);
    try {
      const created = await requestWorkspaceJson(
        fetch,
        "/api/documents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            campDay,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            byteSize: file.size,
            sha256: await sha256Hex(file),
          }),
        },
        createSchema,
      );
      const uploaded = await createClient()
        .storage
        .from("student-documents")
        .upload(created.storagePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (uploaded.error) throw new Error("upload failed");
      setFile(null);
      setMessage("文档已上传，正在等待解析");
      await load();
    } catch {
      setMessage("文档上传失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  async function retry(id: string) {
    await fetch(`/api/documents/${id}/retry`, { method: "POST" });
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    await load();
  }

  async function download(id: string) {
    const result = await requestWorkspaceJson(
      fetch,
      `/api/documents/${id}/download`,
      { method: "GET" },
      downloadSchema,
    );
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">学生文档</h2>
      <p className="mt-1 text-sm text-stone-600">
        支持 PDF、Word、Excel、PPT、TXT 和图片，单个文件不超过 {MAX_DOCUMENT_BYTES / 1024 / 1024}MB。
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          上传学生文档
          <input
            aria-label="上传学生文档"
            disabled={locked || pending}
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="button"
          disabled={locked || pending || !file}
          className="min-h-11 rounded-xl bg-orange-500 px-4 py-2.5 font-semibold text-white"
          onClick={() => void uploadDocument()}
        >
          {pending ? "上传中…" : "上传文档"}
        </button>
      </div>
      {locked ? (
        <p className="mt-3 text-sm text-stone-500">营地开始后才可上传对应天数的文档。</p>
      ) : null}
      {message ? <p role="status" className="mt-3 text-sm text-blue-800">{message}</p> : null}
      <ul className="mt-4 space-y-2">
        {documents.map((document) => (
          <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 p-3 text-sm">
            <span>{document.originalFilename}</span>
            <span className="text-stone-500">{document.status}</span>
            <span className="flex gap-2">
              <button type="button" onClick={() => void download(document.id)}>下载</button>
              <button type="button" onClick={() => void retry(document.id)}>重试</button>
              <button type="button" onClick={() => void remove(document.id)}>删除</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
