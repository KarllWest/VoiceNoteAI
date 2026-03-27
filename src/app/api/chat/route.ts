import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { hasActiveSubscription } from "@/lib/stripe";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recordingId, message } = await req.json();

  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isPro = await hasActiveSubscription(dbUser.id);
  if (!isPro) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 402 });
  }

  const recording = await prisma.recording.findFirst({
    where: { id: recordingId, userId: dbUser.id },
  });

  if (!recording) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  const history = (recording.chatHistory as unknown as ChatMessage[]) || [];

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are a helpful AI assistant. The user has a voice recording with the following transcript:\n\n"${recording.transcript}"\n\nAnswer questions about this recording, provide summaries, extract action items, or help analyze the content.`,
    },
    ...history,
    { role: "user", content: message },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 1000,
  });

  const assistantMessage = completion.choices[0].message.content ?? "";

  const updatedHistory: ChatMessage[] = [
    ...history,
    { role: "user", content: message },
    { role: "assistant", content: assistantMessage },
  ];

  await prisma.recording.update({
    where: { id: recordingId },
    data: { chatHistory: updatedHistory as unknown as object },
  });

  return NextResponse.json({ message: assistantMessage });
}
