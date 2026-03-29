import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Zap, ArrowLeft, RefreshCw, Check } from "lucide-react";
import Link from "next/link";
import CheckoutButton from "./CheckoutButton";
import { hasActiveSubscription } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

const FEATURES = [
  "Необмежена кількість записів",
  "AI транскрипція через Whisper",
  "Чат з GPT-4 по кожному запису",
  "Збереження всіх записів і транскриптів",
  "Скасування в будь-який момент",
];

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
      <div className="max-w-md mx-auto">

        {/* Navigation */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            На головну
          </Link>
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <RefreshCw className="w-4 h-4" />
            Вже оплатив
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-purple-900/50 border border-purple-700 rounded-full px-4 py-1.5 mb-4">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs text-purple-300 font-medium">Pro Plan</span>
            </div>
            <div className="text-4xl font-bold text-white mb-1">
              £9<span className="text-lg text-gray-400 font-normal">/міс</span>
            </div>
            <p className="text-gray-400 text-sm">Повний доступ до всіх функцій</p>
          </div>

          {/* Features */}
          <ul className="space-y-3 mb-8">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                <Check className="w-4 h-4 text-purple-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <CheckoutButton email={email} />
        </div>

        <p className="text-center text-xs text-gray-500 mt-4">
          Скасування в будь-який момент · Powered by Stripe
        </p>
      </div>
    </div>
  );
}
