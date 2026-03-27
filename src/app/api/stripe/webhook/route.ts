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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = event.data.object as any;

  switch (event.type) {
    // ── Old API: checkout session ──────────────────────────────────────
    case "checkout.session.completed": {
      const session = obj as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session);
      break;
    }

    // ── Old API: recurring invoice ─────────────────────────────────────
    case "invoice.payment_succeeded": {
      await handleInvoicePaid(obj);
      break;
    }

    // ── New API (2026+): invoice_payment object ────────────────────────
    case "invoice_payment.paid": {
      await handleInvoicePaid(obj);
      break;
    }

    // ── Cancellation ───────────────────────────────────────────────────
    case "customer.subscription.deleted": {
      const sub = obj as Stripe.Subscription;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: { status: "canceled" },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const subId = session.subscription as string;
  if (!subId) return;

  const sub = await stripe.subscriptions.retrieve(subId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subData = sub as any;

  const userId =
    (session.client_reference_id as string) ?? session.metadata?.userId;
  if (!userId) return;

  await prisma.subscription.upsert({
    where: { userId },
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleInvoicePaid(inv: any) {
  // Get subscription id — location differs between old/new API
  const subId: string =
    inv.subscription ?? inv.lines?.data?.[0]?.subscription ?? null;

  if (!subId) return;

  const sub = await stripe.subscriptions.retrieve(subId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subData = sub as any;

  // Find existing subscription record by Stripe subscription id
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subId },
  });

  const periodEnd = subData.current_period_end
    ? new Date(subData.current_period_end * 1000)
    : null;
  const priceId = sub.items.data[0]?.price?.id ?? null;
  const customerId = inv.customer as string;

  if (existing) {
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subId },
      data: { stripeCurrentPeriodEnd: periodEnd, status: "active" },
    });
    return;
  }

  // No record yet — find userId via checkout session (Pricing Table sets client_reference_id)
  const sessions = await stripe.checkout.sessions.list({
    subscription: subId,
    limit: 1,
  });
  const userId = sessions.data[0]?.client_reference_id ?? null;

  if (!userId) return;

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: periodEnd,
      status: "active",
    },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: periodEnd,
      status: "active",
    },
  });
}
