"use server";

import { prisma } from "../prisma";
import { isFamilyAtLimit, FREE_MEMBER_LIMIT } from "../freemium";
import { auth } from "../auth/auth";
import { randomUUID } from "crypto";
import { z } from "zod";

const createFamilySchema = z.object({
  name: z.string().min(2, "Family name must be at least 2 characters").max(60),
});

export type CreateFamilyResult =
  | { success: true; familyId: string }
  | { success: false; error: string };

/**
 * Creates a new family group and adds the creator as admin.
 * Enforces: one active family per user (MVP).
 */
export async function createFamily(formData: {
  name: string;
}): Promise<CreateFamilyResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated." };
  }
  const userId = session.user.id;

  const parsed = createFamilySchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { name } = parsed.data;

  // MVP: one family per user
  const existing = await prisma.familyMember.findFirst({
    where: { userId, deletedAt: null },
    include: { family: true },
  });
  if (existing) {
    return { success: false, error: "You are already a member of a family group." };
  }

  const family = await prisma.family.create({
    data: {
      name,
      members: {
        create: { userId, role: "admin" },
      },
    },
  });

  return { success: true, familyId: family.id };
}

// ── Invite actions ────────────────────────────────────────────────────────────

export type CreateInviteResult =
  | { success: true; inviteUrl: string; token: string }
  | { success: false; error: string };

/**
 * Generates a shareable invite link for a family.
 * Enforces freemium limit before creating token.
 */
export async function createInvite(formData: {
  familyId: string;
  email?: string;
  appUrl: string;
}): Promise<CreateInviteResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated." };
  }
  const { familyId, email, appUrl } = formData;
  const invitedById = session.user.id;

  // SECURITY: Verify the caller is an admin or member of this family (IDOR fix)
  const membership = await prisma.familyMember.findFirst({
    where: {
      familyId,
      userId: invitedById,
      deletedAt: null,
    },
  });
  if (!membership) {
    return {
      success: false,
      error: "You are not a member of this family.",
    };
  }

  const atLimit = await isFamilyAtLimit(familyId);
  if (atLimit) {
    return {
      success: false,
      error: `Free plan is limited to ${FREE_MEMBER_LIMIT} family members. Upgrade to invite more.`,
    };
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.invite.create({
    data: { token, familyId, invitedById, email: email ?? null, expiresAt },
  });

  const inviteUrl = `${appUrl}/invite/${token}`;
  return { success: true, inviteUrl, token };
}

// ── Accept invite ─────────────────────────────────────────────────────────────

export type AcceptInviteResult =
  | { success: true; familyId: string; familyName: string }
  | { success: false; error: string };

/**
 * Accepts an invite token and adds the user to the family.
 * Validates: token exists, not expired, not used, family not at limit.
 */
export async function acceptInvite(formData: {
  token: string;
}): Promise<AcceptInviteResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated." };
  }
  const { token } = formData;
  const userId = session.user.id;

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { family: true },
  });

  if (!invite) return { success: false, error: "Invite link is invalid." };
  // Invites are reusable until the family hits its member limit or the link
  // expires, so we no longer treat `usedAt` as a hard block.
  if (invite.expiresAt < new Date()) return { success: false, error: "This invite has expired." };

  const atLimit = await isFamilyAtLimit(invite.familyId);
  if (atLimit) {
    return {
      success: false,
      error: `This family has reached the ${FREE_MEMBER_LIMIT}-member free limit. Ask the admin to upgrade.`,
    };
  }

  // Check if user is already a member
  const alreadyMember = await prisma.familyMember.findFirst({
    where: { familyId: invite.familyId, userId, deletedAt: null },
  });
  if (alreadyMember) {
    return { success: false, error: "You are already a member of this family." };
  }

  // Stamp `usedAt` on first use for audit/UX, but keep the invite reusable.
  await prisma.$transaction([
    prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: invite.usedAt ?? new Date() },
    }),
    prisma.familyMember.create({ data: { familyId: invite.familyId, userId, role: "member" } }),
  ]);

  return { success: true, familyId: invite.familyId, familyName: invite.family.name };
}

// ── Remove member ─────────────────────────────────────────────────────────────

export type RemoveMemberResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Soft-deletes a family member. Only admins or the member themselves can remove.
 */
export async function removeMember(formData: {
  familyMemberId: string;
}): Promise<RemoveMemberResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated." };
  }
  const { familyMemberId } = formData;
  const requestingUserId = session.user.id;

  const membership = await prisma.familyMember.findUnique({
    where: { id: familyMemberId },
  });
  if (!membership || membership.deletedAt) {
    return { success: false, error: "Member not found." };
  }

  // Check requester is admin or self
  const requesterMembership = await prisma.familyMember.findFirst({
    where: { userId: requestingUserId, familyId: membership.familyId, deletedAt: null },
  });
  const isSelf = membership.userId === requestingUserId;
  const isAdmin = requesterMembership?.role === "admin";

  if (!isSelf && !isAdmin) {
    return { success: false, error: "Not authorised to remove this member." };
  }

  await prisma.familyMember.update({
    where: { id: familyMemberId },
    data: { deletedAt: new Date() },
  });

  return { success: true };
}

// ── Read helpers ──────────────────────────────────────────────────────────────

export async function getFamilyForUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const membership = await prisma.familyMember.findFirst({
    where: { userId, deletedAt: null },
    include: {
      family: {
        include: {
          members: {
            where: { deletedAt: null },
            include: { user: { select: { id: true, name: true, email: true, parkrunHomeEvent: true } } },
            orderBy: { joinedAt: "asc" },
          },
        },
      },
    },
  });
  return membership ?? null;
}

export async function getInviteByToken(token: string) {
  return prisma.invite.findUnique({
    where: { token },
    include: {
      family: {
        include: {
          members: {
            where: { deletedAt: null },
            include: { user: { select: { id: true, name: true } } },
            take: 5,
          },
        },
      },
      invitedBy: { select: { id: true, name: true } },
    },
  });
}
