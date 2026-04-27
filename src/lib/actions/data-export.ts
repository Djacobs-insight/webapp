"use server";

import { prisma } from "../prisma";
import { auth } from "../auth/auth";

export type ExportResult =
  | { success: true; csv: string; filename: string }
  | { success: false; error: string };

export async function exportResultsCsv(): Promise<ExportResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  const userId = session.user.id;

  const results = await prisma.parkrunResult.findMany({
    where: { userId, deletedAt: null },
    include: { location: true },
    orderBy: { date: "desc" },
  });

  if (results.length === 0) {
    return { success: false, error: "No results to export" };
  }

  // Build CSV
  const header = "Date,Location,Finish Time,Age-Graded %,Personal Best";

  // Determine personal bests (fastest finish time up to that date)
  const chronological = [...results].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  const pbSet = new Set<string>();
  let bestTime = Infinity;
  for (const r of chronological) {
    if (r.finishTimeSecs < bestTime) {
      bestTime = r.finishTimeSecs;
      pbSet.add(r.id);
    }
  }

  const rows = results.map((r) => {
    const date = r.date.toISOString().split("T")[0];
    const location = csvEscape(r.location.name);
    const mins = Math.floor(r.finishTimeSecs / 60);
    const secs = r.finishTimeSecs % 60;
    const time = `${mins}:${String(secs).padStart(2, "0")}`;
    const ag = r.ageGradedPct != null ? r.ageGradedPct.toFixed(1) : "";
    const pb = pbSet.has(r.id) ? "Yes" : "No";
    return `${date},${location},${time},${ag},${pb}`;
  });

  const csv = [header, ...rows].join("\n");
  const filename = `parkrun-results-${new Date().toISOString().split("T")[0]}.csv`;

  return { success: true, csv, filename };
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
