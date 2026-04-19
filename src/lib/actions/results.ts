"use server";

import { prisma } from "../prisma";
import { auth } from "../auth/auth";
import { z } from "zod";
import { calculateAgeGradedPercentage, calculateAgeOnDate } from "../age-grading";

const timeRegex = /^\d{1,3}:\d{2}$/;

const submitResultSchema = z.object({
  date: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid date"),
  location: z.string().min(1, "Location is required").max(200),
  finishTime: z
    .string()
    .regex(timeRegex, "Time must be in mm:ss format")
    .refine((t) => {
      const [mins, secs] = t.split(":").map(Number);
      return secs < 60 && mins >= 0 && mins + secs > 0;
    }, "Invalid time"),
  photo: z.object({
    displayUrl: z.string(),
    thumbnailUrl: z.string(),
    originalName: z.string().nullable(),
  }).optional(),
});

export type MilestoneInfo = {
  type: string;
  value: string;
  label: string;
};

export type SubmitResultResult =
  | { success: true; resultId: string; ageGradedPct: number | null; milestones: MilestoneInfo[] }
  | { success: false; error: string };

const RUN_COUNT_MILESTONES = [10, 25, 50, 100];
const AG_THRESHOLDS = [60, 70, 80];

function parseFinishTime(time: string): number {
  const [mins, secs] = time.split(":").map(Number);
  return mins * 60 + secs;
}

export async function submitResult(formData: {
  date: string;
  location: string;
  finishTime: string;
  photo?: { displayUrl: string; thumbnailUrl: string; originalName: string | null };
}): Promise<SubmitResultResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated." };
  }
  const userId = session.user.id;

  const parsed = submitResultSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { date, location, finishTime } = parsed.data;

  // Validate date is not in the future
  const resultDate = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (resultDate > today) {
    return { success: false, error: "Date cannot be in the future." };
  }

  // Verify user belongs to a family
  const membership = await prisma.familyMember.findFirst({
    where: { userId, deletedAt: null },
  });
  if (!membership) {
    return { success: false, error: "You must belong to a family to record results." };
  }

  // Find or create parkrun location
  const parkrunLocation = await prisma.parkrunLocation.upsert({
    where: { name: location.trim() },
    create: { name: location.trim() },
    update: {},
  });

  const finishTimeSecs = parseFinishTime(finishTime);

  // Calculate age-graded percentage if user has birthday and gender
  let ageGradedPct: number | null = null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { birthday: true, gender: true },
  });
  if (user?.birthday && user?.gender && (user.gender === "M" || user.gender === "F")) {
    const age = calculateAgeOnDate(user.birthday, resultDate);
    const grading = calculateAgeGradedPercentage(finishTimeSecs, age, user.gender);
    if (grading) {
      ageGradedPct = grading.percentage;
    }
  }

  const result = await prisma.parkrunResult.upsert({
    where: {
      userId_date: { userId, date: resultDate },
    },
    create: {
      userId,
      locationId: parkrunLocation.id,
      date: resultDate,
      finishTimeSecs,
      ageGradedPct,
    },
    update: {
      locationId: parkrunLocation.id,
      finishTimeSecs,
      ageGradedPct,
    },
  });

  // Attach photo if provided
  if (parsed.data.photo) {
    await prisma.photo.create({
      data: {
        resultId: result.id,
        userId,
        displayUrl: parsed.data.photo.displayUrl,
        thumbnailUrl: parsed.data.photo.thumbnailUrl,
        originalName: parsed.data.photo.originalName,
      },
    });
  }

  // Detect milestones
  const milestones = await detectMilestones(userId, result.id, finishTimeSecs, ageGradedPct);

  return { success: true, resultId: result.id, ageGradedPct, milestones };
}

async function detectMilestones(
  userId: string,
  resultId: string,
  finishTimeSecs: number,
  ageGradedPct: number | null,
): Promise<MilestoneInfo[]> {
  const newMilestones: MilestoneInfo[] = [];

  // 1. Run count milestones
  const runCount = await prisma.parkrunResult.count({ where: { userId } });
  for (const threshold of RUN_COUNT_MILESTONES) {
    if (runCount >= threshold) {
      const exists = await prisma.milestone.findUnique({
        where: { userId_type_value: { userId, type: "run_count", value: String(threshold) } },
      });
      if (!exists) {
        await prisma.milestone.create({
          data: { userId, type: "run_count", value: String(threshold), resultId },
        });
        newMilestones.push({
          type: "run_count",
          value: String(threshold),
          label: `${threshold} parkruns completed!`,
        });
      }
    }
  }

  // 2. Personal best (fastest time)
  const fastest = await prisma.parkrunResult.findFirst({
    where: { userId },
    orderBy: { finishTimeSecs: "asc" },
    select: { finishTimeSecs: true },
  });
  if (fastest && fastest.finishTimeSecs === finishTimeSecs) {
    // Check if more than 1 result (first result isn't a "PB")
    if (runCount > 1) {
      const pbExists = await prisma.milestone.findUnique({
        where: { userId_type_value: { userId, type: "personal_best", value: "pb_time" } },
      });
      // Always create a new PB milestone if the time improved — delete old one first
      if (pbExists) {
        await prisma.milestone.delete({ where: { id: pbExists.id } });
      }
      await prisma.milestone.create({
        data: { userId, type: "personal_best", value: "pb_time", resultId },
      });
      const mins = Math.floor(finishTimeSecs / 60);
      const secs = finishTimeSecs % 60;
      newMilestones.push({
        type: "personal_best",
        value: "pb_time",
        label: `New PB! ${mins}:${String(secs).padStart(2, "0")}`,
      });
    }
  }

  // 3. Age-grade thresholds
  if (ageGradedPct != null) {
    for (const threshold of AG_THRESHOLDS) {
      if (ageGradedPct >= threshold) {
        const exists = await prisma.milestone.findUnique({
          where: { userId_type_value: { userId, type: "age_grade", value: String(threshold) } },
        });
        if (!exists) {
          await prisma.milestone.create({
            data: { userId, type: "age_grade", value: String(threshold), resultId },
          });
          newMilestones.push({
            type: "age_grade",
            value: String(threshold),
            label: `First ${threshold}%+ age-graded result!`,
          });
        }
      }
    }
  }

  return newMilestones;
}

export async function getDashboardSummary(): Promise<{ personalBest: string; streak: string }> {
  const session = await auth();
  if (!session?.user?.id) return { personalBest: "—", streak: "—" };

  const userId = session.user.id;

  // Personal best (fastest finish time)
  const fastest = await prisma.parkrunResult.findFirst({
    where: { userId },
    orderBy: { finishTimeSecs: "asc" },
    select: { finishTimeSecs: true },
  });
  const personalBest = fastest
    ? `${Math.floor(fastest.finishTimeSecs / 60)}:${String(fastest.finishTimeSecs % 60).padStart(2, "0")}`
    : "—";

  // Weekly streak: count consecutive Saturdays with at least one result, working backwards
  const results = await prisma.parkrunResult.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  let streak = 0;
  if (results.length > 0) {
    // Build set of Saturday dates (as YYYY-MM-DD strings)
    const saturdaySet = new Set<string>();
    for (const r of results) {
      const d = r.date;
      // Normalise to the Saturday of that week (parkrun is always Saturday)
      const day = d.getUTCDay(); // 0=Sun..6=Sat
      const diff = (day + 1) % 7; // days since Saturday
      const sat = new Date(d);
      sat.setUTCDate(d.getUTCDate() - diff);
      saturdaySet.add(sat.toISOString().slice(0, 10));
    }

    // Walk backwards from the most recent Saturday
    const sortedSats = [...saturdaySet].sort().reverse();
    // Check if most recent Saturday is within the last 7 days (active streak)
    const now = new Date();
    const latestSat = new Date(sortedSats[0] + "T00:00:00Z");
    const daysSince = Math.floor((now.getTime() - latestSat.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince <= 13) {
      // Streak is active — count consecutive weeks
      streak = 1;
      for (let i = 1; i < sortedSats.length; i++) {
        const prev = new Date(sortedSats[i - 1] + "T00:00:00Z");
        const curr = new Date(sortedSats[i] + "T00:00:00Z");
        const gap = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
        if (gap === 7) {
          streak++;
        } else {
          break;
        }
      }
    }
  }

  return {
    personalBest,
    streak: streak > 0 ? `${streak} week${streak !== 1 ? "s" : ""}` : "—",
  };
}

export async function getRecentResults(limit = 5) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const results = await prisma.parkrunResult.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
    take: limit,
    include: { location: true },
  });

  return results.map((r) => {
    const d = r.date;
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    return {
      id: r.id,
      date: `${dd}/${mm}/${yyyy}`,
      location: r.location.name,
      finishTimeSecs: r.finishTimeSecs,
      ageGradedPct: r.ageGradedPct,
    };
  });
}

function formatDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Monday 00:00 UTC week label for grouping (D-35) */
function getWeekLabel(d: Date): string {
  const day = d.getUTCDay(); // 0=Sun, 1=Mon...
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - diff);
  return `Week of ${formatDate(monday)}`;
}

export async function getFamilyResults(filterUserId?: string) {
  const session = await auth();
  if (!session?.user?.id) return { results: [], members: [] };

  // Find user's family
  const membership = await prisma.familyMember.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    select: { familyId: true },
  });
  if (!membership) return { results: [], members: [] };

  // Get all active family members
  const members = await prisma.familyMember.findMany({
    where: { familyId: membership.familyId, deletedAt: null },
    include: { user: { select: { id: true, name: true } } },
  });

  const memberUserIds = members.map((m) => m.user.id);

  // Fetch results for all family members (or filtered)
  const where: { userId: { in: string[] } } | { userId: string } = filterUserId && memberUserIds.includes(filterUserId)
    ? { userId: filterUserId }
    : { userId: { in: memberUserIds } };

  const results = await prisma.parkrunResult.findMany({
    where,
    orderBy: { date: "desc" },
    include: { location: true, user: { select: { id: true, name: true } } },
  });

  return {
    results: results.map((r) => ({
      id: r.id,
      userId: r.user.id,
      runnerName: r.user.name ?? "Unknown",
      date: formatDate(r.date),
      weekLabel: getWeekLabel(r.date),
      location: r.location.name,
      finishTimeSecs: r.finishTimeSecs,
      ageGradedPct: r.ageGradedPct,
    })),
    members: members.map((m) => ({
      id: m.user.id,
      name: m.user.name ?? "Unknown",
    })),
  };
}

export type LeaderboardPeriod = "weekly" | "monthly" | "all-time";

/** Get Monday 00:00 UTC of the current week (D-35) */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return monday;
}

/** Get first day of current month UTC */
function getMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getLeaderboard(period: LeaderboardPeriod = "weekly") {
  const session = await auth();
  if (!session?.user?.id) return { entries: [], currentUserId: "" };

  const membership = await prisma.familyMember.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    select: { familyId: true },
  });
  if (!membership) return { entries: [], currentUserId: session.user.id };

  const members = await prisma.familyMember.findMany({
    where: { familyId: membership.familyId, deletedAt: null },
    include: { user: { select: { id: true, name: true } } },
  });

  const memberUserIds = members.map((m) => m.user.id);

  // Date filter based on period
  const dateFilter: { gte?: Date } = {};
  if (period === "weekly") {
    dateFilter.gte = getWeekStart();
  } else if (period === "monthly") {
    dateFilter.gte = getMonthStart();
  }
  // "all-time" has no date filter

  const results = await prisma.parkrunResult.findMany({
    where: {
      userId: { in: memberUserIds },
      ageGradedPct: { not: null },
      ...(dateFilter.gte ? { date: { gte: dateFilter.gte } } : {}),
    },
    select: {
      userId: true,
      ageGradedPct: true,
    },
  });

  // Aggregate: best AG% and run count per user
  const statsMap = new Map<string, { bestPct: number; runs: number }>();
  for (const r of results) {
    const existing = statsMap.get(r.userId);
    const pct = r.ageGradedPct!;
    if (existing) {
      existing.bestPct = Math.max(existing.bestPct, pct);
      existing.runs++;
    } else {
      statsMap.set(r.userId, { bestPct: pct, runs: 1 });
    }
  }

  // Build leaderboard entries, including members with no results in period
  const entries = members.map((m) => {
    const stats = statsMap.get(m.user.id);
    return {
      userId: m.user.id,
      name: m.user.name ?? "Unknown",
      bestAgeGradedPct: stats?.bestPct ?? null,
      runs: stats?.runs ?? 0,
    };
  });

  // Sort: members with results first (by best AG% desc), then members without
  entries.sort((a, b) => {
    if (a.bestAgeGradedPct != null && b.bestAgeGradedPct != null) {
      return b.bestAgeGradedPct - a.bestAgeGradedPct;
    }
    if (a.bestAgeGradedPct != null) return -1;
    if (b.bestAgeGradedPct != null) return 1;
    return a.name.localeCompare(b.name);
  });

  return { entries, currentUserId: session.user.id };
}

export async function getResultById(resultId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Verify user is in same family as the result owner
  const membership = await prisma.familyMember.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    select: { familyId: true },
  });
  if (!membership) return null;

  const result = await prisma.parkrunResult.findUnique({
    where: { id: resultId },
    include: {
      location: true,
      user: { select: { id: true, name: true, birthday: true, gender: true } },
      photos: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, displayUrl: true, thumbnailUrl: true, userId: true },
      },
    },
  });
  if (!result) return null;

  // Check result owner is in same family
  const ownerMembership = await prisma.familyMember.findFirst({
    where: { userId: result.userId, familyId: membership.familyId, deletedAt: null },
  });
  if (!ownerMembership) return null;

  return {
    id: result.id,
    runnerName: result.user.name ?? "Unknown",
    date: formatDate(result.date),
    location: result.location.name,
    finishTimeSecs: result.finishTimeSecs,
    ageGradedPct: result.ageGradedPct,
    photos: result.photos,
  };
}

const HISTORY_PAGE_SIZE = 20;

export async function getPersonalHistory(cursor?: string) {
  const session = await auth();
  if (!session?.user?.id) return { items: [], nextCursor: null, stats: null };

  const userId = session.user.id;

  // Fetch one extra to know if there's a next page
  const results = await prisma.parkrunResult.findMany({
    where: { userId, ...(cursor ? { id: { lt: cursor } } : {}) },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: HISTORY_PAGE_SIZE + 1,
    include: { location: true },
  });

  const hasMore = results.length > HISTORY_PAGE_SIZE;
  const page = hasMore ? results.slice(0, HISTORY_PAGE_SIZE) : results;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  // Fetch PB (best finish time) and best AG% across ALL results for highlighting
  const [bestTime, bestAg] = await Promise.all([
    prisma.parkrunResult.findFirst({
      where: { userId },
      orderBy: { finishTimeSecs: "asc" },
      select: { id: true },
    }),
    prisma.parkrunResult.findFirst({
      where: { userId, ageGradedPct: { not: null } },
      orderBy: { ageGradedPct: "desc" },
      select: { id: true },
    }),
  ]);

  const pbIds = new Set<string>();
  if (bestTime) pbIds.add(bestTime.id);
  if (bestAg) pbIds.add(bestAg.id);

  // Stats summary
  const allResults = await prisma.parkrunResult.aggregate({
    where: { userId },
    _count: true,
    _avg: { ageGradedPct: true },
    _max: { ageGradedPct: true },
    _min: { finishTimeSecs: true },
  });

  return {
    items: page.map((r) => ({
      id: r.id,
      date: formatDate(r.date),
      rawDate: r.date.toISOString(),
      location: r.location.name,
      finishTimeSecs: r.finishTimeSecs,
      ageGradedPct: r.ageGradedPct,
      isPB: pbIds.has(r.id),
    })),
    nextCursor,
    stats: {
      totalRuns: allResults._count,
      avgAgeGradedPct: allResults._avg.ageGradedPct,
      bestAgeGradedPct: allResults._max.ageGradedPct,
      bestTimeSecs: allResults._min.finishTimeSecs,
    },
  };
}

export async function getTrendData() {
  const session = await auth();
  if (!session?.user?.id) return { points: [], stats: null };

  const userId = session.user.id;

  const results = await prisma.parkrunResult.findMany({
    where: { userId },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      finishTimeSecs: true,
      ageGradedPct: true,
    },
  });

  if (results.length === 0) return { points: [], stats: null };

  // Track running PBs to mark PB points
  let bestTimeSoFar = Infinity;
  let bestAgSoFar = -Infinity;

  const points = results.map((r) => {
    const isTimePB = r.finishTimeSecs < bestTimeSoFar;
    const isAgPB = r.ageGradedPct != null && r.ageGradedPct > bestAgSoFar;
    if (isTimePB) bestTimeSoFar = r.finishTimeSecs;
    if (isAgPB) bestAgSoFar = r.ageGradedPct!;

    return {
      id: r.id,
      date: formatDate(r.date),
      isoDate: r.date.toISOString(),
      finishTimeSecs: r.finishTimeSecs,
      ageGradedPct: r.ageGradedPct,
      isPB: isTimePB || isAgPB,
    };
  });

  // Stats
  const first = results[0];
  const last = results[results.length - 1];
  const agValues = results.filter((r) => r.ageGradedPct != null).map((r) => r.ageGradedPct!);
  const avgAg = agValues.length > 0 ? agValues.reduce((a, b) => a + b, 0) / agValues.length : null;
  const bestAg = agValues.length > 0 ? Math.max(...agValues) : null;
  const firstAg = first.ageGradedPct;
  const lastAg = last.ageGradedPct;
  const improvement = firstAg != null && lastAg != null ? lastAg - firstAg : null;

  return {
    points,
    stats: {
      totalRuns: results.length,
      avgAgeGradedPct: avgAg,
      bestAgeGradedPct: bestAg,
      bestTimeSecs: Math.min(...results.map((r) => r.finishTimeSecs)),
      improvementPct: improvement,
    },
  };
}
