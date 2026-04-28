import { prisma } from "@/lib/prisma";

export type DigestFrequency = "off" | "daily" | "weekly";

export function isValidDigestFrequency(v: string): v is DigestFrequency {
  return v === "off" || v === "daily" || v === "weekly";
}

export async function getDigestFrequency(userId: string): Promise<DigestFrequency> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationDigestFrequency: true },
  });
  if (!user) return "off";
  const v = user.notificationDigestFrequency;
  return isValidDigestFrequency(v) ? v : "off";
}

export async function setDigestFrequency(
  userId: string,
  freq: DigestFrequency
): Promise<void> {
  if (!isValidDigestFrequency(freq)) {
    throw new Error(`Invalid digest frequency: ${freq}`);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { notificationDigestFrequency: freq },
  });
}
