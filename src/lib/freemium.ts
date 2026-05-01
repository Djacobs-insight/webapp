import { prisma } from "./prisma";

export const FREE_MEMBER_LIMIT = 30;

/**
 * Returns the active (non-deleted) member count for a family.
 * Used to gate freemium enforcement across invite acceptance and member creation.
 */
export async function getFamilyMemberCount(familyId: string): Promise<number> {
  return prisma.familyMember.count({
    where: { familyId, deletedAt: null },
  });
}

/**
 * Returns true if the family has reached its free-tier member limit.
 */
export async function isFamilyAtLimit(familyId: string): Promise<boolean> {
  const count = await getFamilyMemberCount(familyId);
  return count >= FREE_MEMBER_LIMIT;
}
