import prisma from "./prisma";

/**
 * Validate optional `assetId` and `executorIds` references before creating or updating a SupportTicket.
 * Returns `{ error }` if any referenced ID does not exist, avoiding opaque Prisma 500 foreign-key failures.
 */
export async function validateSupportRefs(input: {
  assetId?: string | null;
  executorIds?: string[];
}): Promise<{ error?: string }> {
  if (input.assetId) {
    const asset = await prisma.asset.findUnique({
      where: { id: input.assetId },
      select: { id: true },
    });
    if (!asset) {
      return { error: "Selected asset not found" };
    }
  }

  if (input.executorIds && input.executorIds.length > 0) {
    const uniqueIds = Array.from(new Set(input.executorIds));
    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: { id: true },
    });
    if (users.length !== uniqueIds.length) {
      return { error: "One or more selected executors are invalid or inactive" };
    }
  }

  return {};
}

/**
 * Re-query fresh `timeLogs` for a ticket after open/close timer mutations so API responses never return stale logs.
 */
export async function fetchTicketTimeLogs(supportTicketId: string) {
  return prisma.timeLog.findMany({
    where: { supportTicketId },
    include: { user: { select: { id: true, name: true, photo: true } } },
    orderBy: { startTime: "desc" },
  });
}
