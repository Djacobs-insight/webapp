"use server";

import { prisma } from "../prisma";
import { auth } from "../auth/auth";
import { z } from "zod";

const CHALLENGE_TYPES = ["most_runs", "best_age_grade", "fastest_time"] as const;

const createChallengeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(CHALLENGE_TYPES),
  startsAt: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid start date"),
  endsAt: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid end date"),
  invitedUserIds: z.array(z.string()).min(1, "Invite at least one family member"),
});

export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

export type CreateChallengeResult =
  | { success: true; challengeId: string }
  | { success: false; error: string };

export async function createChallenge(input: {
  name: string;
  type: string;
  startsAt: string;
  endsAt: string;
  invitedUserIds: string[];
}): Promise<CreateChallengeResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated." };

  const parsed = createChallengeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { name, type, startsAt, endsAt, invitedUserIds } = parsed.data;

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (end <= start) return { success: false, error: "End date must be after start date." };

  // Verify user belongs to a family
  const membership = await prisma.familyMember.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    select: { familyId: true },
  });
  if (!membership) return { success: false, error: "You must belong to a family." };

  // Verify all invitees are family members
  const familyMembers = await prisma.familyMember.findMany({
    where: { familyId: membership.familyId, deletedAt: null },
    select: { userId: true },
  });
  const memberIds = new Set(familyMembers.map((m) => m.userId));
  for (const uid of invitedUserIds) {
    if (!memberIds.has(uid)) return { success: false, error: "All participants must be family members." };
  }

  const userId = session.user.id;

  const challenge = await prisma.challenge.create({
    data: {
      name,
      type,
      createdById: userId,
      familyId: membership.familyId,
      startsAt: start,
      endsAt: end,
      participants: {
        create: [
          // Creator auto-accepts
          { userId, status: "accepted" },
          // Invited users start as pending
          ...invitedUserIds
            .filter((uid) => uid !== userId)
            .map((uid) => ({ userId: uid, status: "pending" as const })),
        ],
      },
    },
  });

  return { success: true, challengeId: challenge.id };
}

export type RespondToChallengeResult =
  | { success: true }
  | { success: false; error: string };

export async function respondToChallenge(
  challengeId: string,
  accept: boolean,
): Promise<RespondToChallengeResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated." };

  const participant = await prisma.challengeParticipant.findUnique({
    where: { challengeId_userId: { challengeId, userId: session.user.id } },
  });
  if (!participant) return { success: false, error: "You are not invited to this challenge." };
  if (participant.status !== "pending") return { success: false, error: "Already responded." };

  await prisma.challengeParticipant.update({
    where: { id: participant.id },
    data: { status: accept ? "accepted" : "declined" },
  });

  return { success: true };
}

export type ChallengeListItem = {
  id: string;
  name: string;
  type: string;
  status: string;
  startsAt: string;
  endsAt: string;
  createdByName: string;
  participantCount: number;
  myStatus: string; // "accepted" | "pending" | "declined"
  winnerName: string | null;
};

export async function getChallenges(): Promise<ChallengeListItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const membership = await prisma.familyMember.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    select: { familyId: true },
  });
  if (!membership) return [];

  const challenges = await prisma.challenge.findMany({
    where: { familyId: membership.familyId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      participants: {
        select: { userId: true, status: true },
      },
    },
  });

  // Fetch winner names for completed challenges
  const winnerIds = challenges
    .filter((c) => c.winnerId)
    .map((c) => c.winnerId!);
  const winners = winnerIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: winnerIds } },
        select: { id: true, name: true },
      })
    : [];
  const winnerMap = new Map(winners.map((w) => [w.id, w.name]));

  return challenges.map((c) => {
    const myParticipation = c.participants.find((p) => p.userId === session.user!.id);
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
      createdByName: c.createdBy.name ?? "Unknown",
      participantCount: c.participants.filter((p) => p.status === "accepted").length,
      myStatus: myParticipation?.status ?? "none",
      winnerName: c.winnerId ? (winnerMap.get(c.winnerId) ?? "Unknown") : null,
    };
  });
}

export type ChallengeDetail = {
  id: string;
  name: string;
  type: string;
  status: string;
  startsAt: string;
  endsAt: string;
  createdByName: string;
  myStatus: string;
  participants: {
    userId: string;
    name: string;
    status: string;
    score: number;
  }[];
  winnerName: string | null;
};

export async function getChallengeDetail(challengeId: string): Promise<ChallengeDetail | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      createdBy: { select: { name: true } },
      participants: {
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!challenge) return null;

  // Verify the user is in the same family
  const membership = await prisma.familyMember.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    select: { familyId: true },
  });
  if (!membership || membership.familyId !== challenge.familyId) return null;

  // Calculate scores for accepted participants
  const acceptedParticipants = challenge.participants.filter((p) => p.status === "accepted");
  const participantScores = await Promise.all(
    acceptedParticipants.map(async (p) => {
      const score = await calculateParticipantScore(
        p.userId,
        challenge.type,
        challenge.startsAt,
        challenge.endsAt,
      );
      return {
        userId: p.userId,
        name: p.user.name ?? "Unknown",
        status: p.status,
        score,
      };
    }),
  );

  // Add pending/declined participants with 0 score
  const otherParticipants = challenge.participants
    .filter((p) => p.status !== "accepted")
    .map((p) => ({
      userId: p.userId,
      name: p.user.name ?? "Unknown",
      status: p.status,
      score: 0,
    }));

  // Sort accepted by score descending
  participantScores.sort((a, b) => b.score - a.score);

  const myParticipation = challenge.participants.find((p) => p.userId === session.user!.id);

  let winnerName: string | null = null;
  if (challenge.winnerId) {
    const winner = challenge.participants.find((p) => p.userId === challenge.winnerId);
    winnerName = winner?.user.name ?? "Unknown";
  }

  return {
    id: challenge.id,
    name: challenge.name,
    type: challenge.type,
    status: challenge.status,
    startsAt: challenge.startsAt.toISOString(),
    endsAt: challenge.endsAt.toISOString(),
    createdByName: challenge.createdBy.name ?? "Unknown",
    myStatus: myParticipation?.status ?? "none",
    participants: [...participantScores, ...otherParticipants],
    winnerName,
  };
}

async function calculateParticipantScore(
  userId: string,
  type: string,
  startsAt: Date,
  endsAt: Date,
): Promise<number> {
  const results = await prisma.parkrunResult.findMany({
    where: {
      userId,
      date: { gte: startsAt, lte: endsAt },
    },
    select: { finishTimeSecs: true, ageGradedPct: true },
  });

  if (results.length === 0) return 0;

  switch (type) {
    case "most_runs":
      return results.length;
    case "best_age_grade":
      return Math.max(...results.map((r) => r.ageGradedPct ?? 0));
    case "fastest_time": {
      // Lower is better, so we invert: score = 10000 - fastest time
      const fastest = Math.min(...results.map((r) => r.finishTimeSecs));
      return Math.max(0, 10000 - fastest);
    }
    default:
      return 0;
  }
}

/**
 * Resolve any challenges that have ended. Called periodically or after result submission.
 */
export async function resolveExpiredChallenges(): Promise<void> {
  const now = new Date();
  const expired = await prisma.challenge.findMany({
    where: { status: "active", endsAt: { lte: now } },
    include: {
      participants: {
        where: { status: "accepted" },
        select: { userId: true },
      },
    },
  });

  for (const challenge of expired) {
    const scores = await Promise.all(
      challenge.participants.map(async (p) => ({
        userId: p.userId,
        score: await calculateParticipantScore(
          p.userId,
          challenge.type,
          challenge.startsAt,
          challenge.endsAt,
        ),
      })),
    );

    const hasResults = scores.some((s) => s.score > 0);
    const winner = hasResults
      ? scores.sort((a, b) => b.score - a.score)[0]
      : null;

    await prisma.challenge.update({
      where: { id: challenge.id },
      data: {
        status: "completed",
        winnerId: winner?.userId ?? null,
      },
    });
  }
}

export async function getFamilyMembers(): Promise<{ userId: string; name: string }[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const membership = await prisma.familyMember.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    select: { familyId: true },
  });
  if (!membership) return [];

  const members = await prisma.familyMember.findMany({
    where: { familyId: membership.familyId, deletedAt: null },
    include: { user: { select: { id: true, name: true } } },
  });

  return members
    .filter((m) => m.userId !== session.user!.id)
    .map((m) => ({ userId: m.user.id, name: m.user.name ?? "Unknown" }));
}
