import { auth, currentUser } from "@clerk/nextjs/server";
import { Mic, Zap, MessageSquare, Shield } from "lucide-react";
import VoiceRecorder from "@/components/recorder/VoiceRecorder";
import { prisma } from "@/lib/prisma";
import { hasActiveSubscription } from "@/lib/stripe";

export default async function HomePage() {
  let userId: string | null = null;
  let clerkUser = null;
  let freeUsed = 0;
  let hasPro = false;

  try {
    const authResult = await auth();
    userId = authResult.userId;
    clerkUser = userId ? await currentUser() : null;

    if (userId) {
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { freeUsed: true, id: true },
      });
      freeUsed = dbUser?.freeUsed ?? 0;
      if (dbUser) hasPro = await hasActiveSubscription(dbUser.id);
    }
  } catch (err) {
    console.error("[HomePage] render error:", err);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <Mic className="w-6 h-6 text-purple-400" />
          <span className="text-white font-bold text-lg">VoiceNote AI</span>
        </div>
        <div className="flex items-center gap-3">
          {clerkUser ? (
            <a
              href="/dashboard"
              className="text-sm text-purple-300 hover:text-white transition-colors"
            >
              Dashboard →
            </a>
          ) : (
            <>
              <a
                href="/sign-in"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Sign in
              </a>
              <a
                href="/sign-up"
                className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Get started
              </a>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-purple-900/50 border border-purple-700 rounded-full px-4 py-1.5 mb-6">
          <Zap className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs text-purple-300 font-medium">
            Powered by OpenAI Whisper + GPT-4
          </span>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 max-w-3xl leading-tight">
          Record your voice,{" "}
          <span className="text-purple-400">chat with AI</span>
        </h1>

        <p className="text-lg text-gray-400 max-w-xl mb-12">
          Transcribe your voice recordings instantly and have intelligent
          conversations about them. First recording is free.
        </p>

        {/* Voice Recorder */}
        <div className="w-full max-w-md bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
          <VoiceRecorder
            isAuthenticated={!!userId}
            hasPro={hasPro}
            freeUsed={freeUsed}
          />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 pb-24 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: <Mic className="w-6 h-6 text-purple-400" />,
            title: "Voice to Text",
            desc: "OpenAI Whisper transcribes your recordings with near-perfect accuracy in any language.",
          },
          {
            icon: <MessageSquare className="w-6 h-6 text-purple-400" />,
            title: "AI Chat",
            desc: "Ask GPT-4 questions about your recordings, get summaries, action items, and insights.",
          },
          {
            icon: <Shield className="w-6 h-6 text-purple-400" />,
            title: "Secure Storage",
            desc: "All recordings and transcripts are stored securely in your private account.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-white/5 border border-white/10 rounded-xl p-6"
          >
            <div className="mb-3">{f.icon}</div>
            <h3 className="text-white font-semibold mb-2">{f.title}</h3>
            <p className="text-gray-400 text-sm">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
