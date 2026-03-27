import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { hasActiveSubscription } from "@/lib/stripe";

export const maxDuration = 60; // allow up to 60s for large files

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  const formData = await req.formData();
  const audioFile = formData.get("audio") as File;

  if (!audioFile) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  // Anonymous user — check/use free slot via cookie
  if (!userId) {
    const cookieStore = req.cookies;
    const freeUsed = cookieStore.get("free_used")?.value === "1";

    if (freeUsed) {
      return NextResponse.json(
        { error: "Free recording used. Please sign up to continue." },
        { status: 401 }
      );
    }

    // Transcribe for free
    const transcript = await transcribeAudio(audioFile);

    const response = NextResponse.json({ transcript, recordingId: null });
    response.cookies.set("free_used", "1", {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    return response;
  }

  // Authenticated user — get or create DB user
  const clerkUser = await import("@clerk/nextjs/server").then((m) =>
    m.currentUser()
  );

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

  const isPro = await hasActiveSubscription(dbUser.id);

  // Check free limit for non-pro users
  if (!isPro && dbUser.freeUsed >= 1) {
    return NextResponse.json(
      { error: "Free recording used. Please upgrade." },
      { status: 402 }
    );
  }

  // Transcribe
  const transcript = await transcribeAudio(audioFile);

  // Save recording to DB
  const recording = await prisma.recording.create({
    data: {
      userId: dbUser.id,
      transcript,
      title: transcript.slice(0, 60) + (transcript.length > 60 ? "..." : ""),
    },
  });

  // Increment free usage for non-pro users
  if (!isPro) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { freeUsed: { increment: 1 } },
    });
  }

  return NextResponse.json({ transcript, recordingId: recording.id });
}

async function transcribeAudio(file: File): Promise<string> {
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "text",
  });
  return transcription as unknown as string;
}
