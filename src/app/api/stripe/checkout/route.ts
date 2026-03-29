import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { stripe, getOrCreateStripeCustomer, hasActiveSubscription } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { email } = await req.json();

    let dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser) {
      dbUser = await prisma.user.upsert({
        where: { email },
        update: { clerkId: userId },
        create: { clerkId: userId, email },
      });
    }

    // If already subscribed, just return dashboard URL
    const alreadyPro = await hasActiveSubscription(dbUser.id);
    if (alreadyPro) {
      return NextResponse.json({
        url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      });
    }

    const customerId = await getOrCreateStripeCustomer(dbUser.id, email);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay?canceled=true`,
      client_reference_id: dbUser.id,
      metadata: { userId: dbUser.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] error:", err);
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
