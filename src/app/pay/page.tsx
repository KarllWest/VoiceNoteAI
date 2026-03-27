import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Zap, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import StripePricingTable from "./StripePricingTable";
import { hasActiveSubscription } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export default async function PayPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-up");

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? "";

  let dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });

  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: { clerkId: userId, email },
    });
  }

  const hasPro = await hasActiveSubscription(dbUser.id);
  if (hasPro) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 px-4 py-16">
      <div className="max-w-3xl mx-auto">

        {/* Navigation */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            На головну
          </Link>
          <Link href="/pay" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <RefreshCw className="w-4 h-4" />
            Вже оплатив — оновити
          </Link>
        </div>

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-purple-900/50 border border-purple-700 rounded-full px-4 py-1.5 mb-4">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-purple-300 font-medium">Pro Plan</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Unlock Full Access</h1>
          <p className="text-gray-400">
            You&apos;ve used your free recording. Upgrade to continue.
          </p>
        </div>

        <StripePricingTable userId={dbUser.id} email={email} />

        <p className="text-center text-xs text-gray-500 mt-6">
          Cancel anytime · Powered by Stripe
        </p>
      </div>
    </div>
  );
}
