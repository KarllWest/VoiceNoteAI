import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { stripe, hasActiveSubscription } from "@/lib/stripe";
import DashboardClient from "./DashboardClient";
import PaymentVerification from "./PaymentVerification";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    recording?: string;
    success?: string;
    session_id?: string;
    attempt?: string;
  }>;
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

  // Fast path: if session_id is present, provision subscription directly from
  // Stripe without waiting for the webhook.
  if (params.success === "true" && params.session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(params.session_id);
      if (session.payment_status === "paid" && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subData = sub as any;
        await prisma.subscription.upsert({
          where: { userId: dbUser.id },
          update: {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: sub.id,
            stripePriceId: sub.items.data[0]?.price?.id ?? null,
            stripeCurrentPeriodEnd: subData.current_period_end
              ? new Date(subData.current_period_end * 1000)
              : null,
            status: "active",
          },
          create: {
            userId: dbUser.id,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: sub.id,
            stripePriceId: sub.items.data[0]?.price?.id ?? null,
            stripeCurrentPeriodEnd: subData.current_period_end
              ? new Date(subData.current_period_end * 1000)
              : null,
            status: "active",
          },
        });
      }
    } catch (err) {
      console.error("[dashboard] Stripe session provision error:", err);
    }
  }

  const hasPro = await hasActiveSubscription(dbUser.id);

  if (!hasPro) {
    // If this is a post-payment redirect, show polling UI instead of sending
    // the user back to /pay — the webhook may just not have arrived yet.
    if (params.success === "true") {
      const attempt = parseInt(params.attempt ?? "0", 10);
      return <PaymentVerification attempt={attempt} />;
    }
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
