"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BackChevron } from "@/components/ui/back-chevron";
import { useToast } from "@/components/ui/toast-provider";
import { exportResultsCsv } from "@/lib/actions/data-export";
import {
  requestAccountDeletion,
  undoDeleteAccount,
} from "@/lib/actions/account-deletion";
import { signOut } from "next-auth/react";

export default function DataManagementPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const result = await exportResultsCsv();
      if (!result.success) {
        showToast("warning", result.error);
        return;
      }
      // Trigger browser download
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast("success", "Results exported successfully");
    } catch {
      showToast("error", "Failed to export results");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setShowConfirm(false);
    setDeleting(true);
    try {
      const result = await requestAccountDeletion();
      if (!result.success) {
        showToast("error", result.error);
        setDeleting(false);
        return;
      }

      const token = result.token;

      // 5-second undo toast
      let undone = false;
      showToast("warning", "Account scheduled for deletion", {
        durationMs: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            undone = true;
            await undoDeleteAccount(token);
            setDeleting(false);
            showToast("success", "Account deletion cancelled");
          },
        },
      });

      // After 5 seconds, sign out if not undone
      setTimeout(async () => {
        if (!undone) {
          await signOut({ redirect: false });
          router.push("/");
        }
      }, 5200);
    } catch {
      showToast("error", "Failed to delete account");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <BackChevron />
      <main className="flex flex-col flex-1 w-full max-w-xl mx-auto px-4 py-6 gap-6">
        <h1 className="text-2xl font-bold text-charcoal">Data Management</h1>

        {/* Export Section */}
        <section className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
          <h2 className="text-lg font-bold text-charcoal">Export Your Data</h2>
          <p className="text-sm text-gray-500">
            Download all your parkrun results as a CSV file including dates,
            locations, finish times, age-graded percentages, and personal bests.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="self-start rounded-xl bg-teal px-5 py-2.5 text-white font-semibold text-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {exporting ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Exporting…
              </span>
            ) : (
              "Export Results CSV"
            )}
          </button>
        </section>

        {/* Delete Section */}
        <section className="rounded-2xl bg-white border border-red-100 shadow-sm p-5 flex flex-col gap-3">
          <h2 className="text-lg font-bold text-charcoal">Delete Account</h2>
          <p className="text-sm text-gray-500">
            Permanently delete your account and all associated data. This
            includes all results, photos, comments, badges, family memberships,
            and profile data. This action cannot be undone after the grace
            period.
          </p>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={deleting}
              className="self-start rounded-xl border-2 border-red-500 text-red-600 px-5 py-2.5 font-semibold text-sm transition hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete My Account"}
            </button>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-col gap-3">
              <p className="text-sm font-medium text-red-800">
                Are you sure? All your results, photos, comments, badges,
                family memberships, and profile data will be permanently
                removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  className="rounded-xl bg-red-600 text-white px-5 py-2 font-semibold text-sm transition hover:bg-red-700"
                >
                  Yes, delete everything
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="rounded-xl border border-gray-300 text-charcoal px-5 py-2 font-semibold text-sm transition hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        <p className="text-xs text-gray-400 text-center">
          Deleted data is retained for 30 days before permanent removal per our
          data retention policy.
        </p>
      </main>
    </div>
  );
}
