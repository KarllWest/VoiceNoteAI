import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subId = session.subscription as string;
      const sub = await stripe.subscriptions.retrieve(subId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subData = sub as any;

      const userId = session.metadata?.userId;
      if (!userId) break;

      await prisma.subscription.upsert({
        where: { userId },
        update: {
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.items.data[0]?.price?.id ?? null,
          stripeCurrentPeriodEnd: subData.current_period_end
            ? new Date(subData.current_period_end * 1000)
            : null,
          status: "active",
        },
        create: {
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.items.data[0]?.price?.id ?? null,
          stripeCurrentPeriodEnd: subData.current_period_end
            ? new Date(subData.current_period_end * 1000)
            : null,
          status: "active",
        },
      });
      break;
    }

    case "invoice.payment_succeeded": {
      const inv = event.data.object as Stripe.Invoice;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invData = inv as any;
      const subId = invData.subscription as string;
      if (!subId) break;

      const sub = await stripe.subscriptions.retrieve(subId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subData = sub as any;

      await prisma.subscription.update({
        where: { stripeSubscriptionId: subId },
        data: {
          stripePriceId: sub.items.data[0]?.price?.id ?? null,
          stripeCurrentPeriodEnd: subData.current_period_end
            ? new Date(subData.current_period_end * 1000)
            : null,
          status: "active",
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await prisma.subscription.update({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: "canceled" },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
