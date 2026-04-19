"use server";

import { prisma } from "../prisma";
import { auth } from "../auth/auth";

export async function saveOnboardingProfile(data: {
  name?: string;
  birthday?: string;
  gender?: string;
  parkrunHomeEvent?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return;

  const update: Record<string, unknown> = { onboardingCompleted: true };

  if (data.name) update.name = data.name;
  if (data.birthday) update.birthday = new Date(data.birthday);
  if (data.gender && (data.gender === "M" || data.gender === "F")) {
    update.gender = data.gender;
  }
  if (data.parkrunHomeEvent) update.parkrunHomeEvent = data.parkrunHomeEvent;

  await prisma.user.update({
    where: { id: session.user.id },
    data: update,
  });
}

export async function getUserHomeEvent(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { parkrunHomeEvent: true },
  });

  return user?.parkrunHomeEvent ?? null;
}
