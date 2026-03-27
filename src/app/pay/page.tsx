import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Check, Zap } from "lucide-react";
import CheckoutButton from "./CheckoutButton";
import { hasActiveSubscription } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export default async function PayPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-up");

  const clerkUser = await currentUser();

  let dbUserId: string | null = null;
  let hasPro = false;

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });

  if (dbUser) {
    dbUserId = dbUser.id;
    hasPro = await hasActiveSubscription(dbUser.id);
  }

  if (hasPro) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-purple-900/50 border border-purple-700 rounded-full px-4 py-1.5 mb-4">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-purple-300 font-medium">
              Pro Plan
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Unlock Full Access
          </h1>
          <p className="text-gray-400">
            You&apos;ve used your free recording. Upgrade to continue.
          </p>
        </div>

        <div className="bg-white/5 border border-purple-500/50 rounded-2xl p-6 mb-6">
          <div className="flex items-baseline gap-1 mb-6">
            <span className="text-4xl font-bold text-white">$9</span>
            <span className="text-gray-400">/month</span>
          </div>

          <ul className="space-y-3 mb-8">
            {[
              "Unlimited voice recordings",
              "AI transcription with Whisper",
              "GPT-4 chat for every recording",
              "Secure cloud storage",
              "Export transcripts",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-gray-300">
                <Check className="w-4 h-4 text-purple-400 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          <CheckoutButton email={clerkUser?.emailAddresses[0]?.emailAddress ?? ""} />
        </div>

        <p className="text-center text-xs text-gray-500">
          Cancel anytime · Powered by Stripe
        </p>
      </div>
    </div>
  );
}
