import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasActiveSubscription } from "@/lib/stripe";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ recording?: string; success?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const clerkUser = await currentUser();
  const params = await searchParams;

  // Get or create DB user
  let dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        clerkId: userId,
        email: clerkUser?.emailAddresses[0]?.emailAddress ?? "",
        name: clerkUser?.fullName ?? null,
      },
    });
  }

  const hasPro = await hasActiveSubscription(dbUser.id);

  if (!hasPro) {
    redirect("/pay");
  }

  const recordings = await prisma.recording.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      transcript: true,
      chatHistory: true,
      createdAt: true,
    },
  });

  const initialRecordingId = params.recording ?? recordings[0]?.id ?? null;

  return (
    <DashboardClient
      recordings={recordings}
      initialRecordingId={initialRecordingId}
      userName={clerkUser?.firstName ?? "there"}
      showSuccessBanner={params.success === "true"}
    />
  );
}
