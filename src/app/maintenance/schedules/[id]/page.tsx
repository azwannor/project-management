import { redirect } from "next/navigation";

export default async function ScheduleDeepLinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/maintenance?tab=schedules&scheduleId=${encodeURIComponent(id)}`);
}
