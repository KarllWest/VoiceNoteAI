import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!dbUser) return NextResponse.json({ recordings: [] });

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

  return NextResponse.json({ recordings });
}
