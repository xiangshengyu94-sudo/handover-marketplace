"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { BRAND_NAME, BRAND_SLUG } from "@/lib/brand";

type Operation = "idle" | "exporting" | "deleting" | "deleted";

type DeletionResult = {
  receipt: string;
  status: "completed" | "partial";
};

export function PrivacyControls() {
  const [confirmation, setConfirmation] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [deletionError, setDeletionError] = useState("");
  const [deletionResult, setDeletionResult] =
    useState<DeletionResult | null>(null);
  const [operation, setOperationState] = useState<Operation>("idle");
  const operationRef = useRef<Operation>("idle");
  const mountedRef = useRef(true);
  const exportControllerRef = useRef<AbortController | null>(null);
  const exportOperationRef = useRef(0);
  const deletionRequestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      exportOperationRef.current += 1;
      exportControllerRef.current?.abort();
      exportControllerRef.current = null;
    };
  }, []);

  function setOperation(next: Operation) {
    operationRef.current = next;
    setOperationState(next);
  }

  async function exportData() {
    if (operationRef.current !== "idle") return;

    const operationId = exportOperationRef.current + 1;
    exportOperationRef.current = operationId;
    const controller = new AbortController();
    exportControllerRef.current = controller;
    setOperation("exporting");
    setExportMessage("");

    const isCurrentExport = () =>
      mountedRef.current &&
      exportOperationRef.current === operationId &&
      operationRef.current === "exporting";

    try {
      const response = await fetch("/api/account/export", {
        method: "POST",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Export could not be created.");

      const blob = await response.blob();
      if (!isCurrentExport()) return;

      const url = URL.createObjectURL(blob);
      try {
        if (!isCurrentExport()) return;
        const link = document.createElement("a");
        link.href = url;
        link.download = `${BRAND_SLUG}-export-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
      } finally {
        URL.revokeObjectURL(url);
      }
      if (isCurrentExport()) setExportMessage("Export downloaded.");
    } catch (caught) {
      if (!isCurrentExport() || controller.signal.aborted) return;
      setExportMessage(
        caught instanceof Error ? caught.message : "Export failed.",
      );
    } finally {
      if (isCurrentExport()) {
        exportControllerRef.current = null;
        setOperation("idle");
      }
    }
  }

  async function removeAccount() {
    if (operationRef.current !== "idle" || confirmation !== "DELETE") return;

    deletionRequestKeyRef.current ??= crypto.randomUUID();
    const requestKey = deletionRequestKeyRef.current;
    setOperation("deleting");
    setDeletionError("");
    let reachedTerminalState = false;
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation, requestKey }),
      });
      const body = (await response.json()) as {
        error?: unknown;
        receipt?: unknown;
        status?: unknown;
      };
      if (!response.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Account deletion could not be completed.",
        );
      }
      if (
        ![200, 202].includes(response.status) ||
        typeof body.receipt !== "string" ||
        (body.status !== "completed" && body.status !== "partial")
      ) {
        throw new Error("Account deletion returned an invalid response.");
      }
      if (!mountedRef.current) return;

      setDeletionResult({ receipt: body.receipt, status: body.status });
      reachedTerminalState = true;
      setOperation("deleted");
    } catch (caught) {
      if (!mountedRef.current) return;
      setDeletionError(
        caught instanceof Error ? caught.message : "Deletion failed.",
      );
    } finally {
      if (mountedRef.current && !reachedTerminalState) {
        setOperation("idle");
      }
    }
  }

  if (operation === "deleted" && deletionResult) {
    const receiptText = [
      `${BRAND_NAME} account deletion receipt`,
      `Status: ${deletionResult.status}`,
      `Receipt: ${deletionResult.receipt}`,
    ].join("\n");
    const receiptHref = `data:text/plain;charset=utf-8,${encodeURIComponent(receiptText)}`;

    return (
      <div className="privacy-controls">
        <section aria-labelledby="deletion-receipt-title">
          <h2 id="deletion-receipt-title">Account deletion recorded</h2>
          <p>
            {deletionResult.status === "completed"
              ? "Account and provider cleanup completed."
              : "Your public account is hidden. Provider cleanup is not yet confirmed and may require operator follow-up."}
          </p>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{deletionResult.status}</dd>
            </div>
            <div>
              <dt>Receipt</dt>
              <dd>
                <strong>{deletionResult.receipt}</strong>
              </dd>
            </div>
          </dl>
          <div className="button-row">
            <a
              className="button-link button-secondary"
              download={`${BRAND_SLUG}-deletion-receipt-${deletionResult.receipt}.txt`}
              href={receiptHref}
            >
              Save receipt
            </a>
            <Link className="button-link" href="/">
              Return to {BRAND_NAME} home
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const busy = operation === "exporting" || operation === "deleting";

  return (
    <div className="privacy-controls">
      <section>
        <h2>Download your data</h2>
        <p>
          Creates a JSON export of your account, listings, sent contact messages
          still within retention, reports, and roles.
        </p>
        <button
          className="button-secondary"
          disabled={operation !== "idle"}
          onClick={() => void exportData()}
          type="button"
        >
          {operation === "exporting" ? "Preparing export..." : "Download export"}
        </button>
        {exportMessage ? <p role="status">{exportMessage}</p> : null}
      </section>
      <section className="danger-zone">
        <h2>Delete your account</h2>
        <p>
          Listings are immediately hidden and tombstoned; media and Auth cleanup
          follow. Legally required moderation history remains, separated from
          public content.
        </p>
        <label>
          Type DELETE to confirm
          <input
            autoComplete="off"
            disabled={busy}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <button
          className="button-danger"
          disabled={operation !== "idle" || confirmation !== "DELETE"}
          onClick={() => void removeAccount()}
          type="button"
        >
          {operation === "deleting" ? "Deleting account..." : "Delete account"}
        </button>
        {deletionError ? (
          <p role="alert" className="form-error">
            {deletionError}
          </p>
        ) : null}
      </section>
    </div>
  );
}
