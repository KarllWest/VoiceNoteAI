import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  const { prisma } = await import("./prisma");

  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;

  const customer = await stripe.customers.create({ email });

  await prisma.subscription.upsert({
    where: { userId },
    update: { stripeCustomerId: customer.id },
    create: { userId, stripeCustomerId: customer.id, status: "inactive" },
  });

  return customer.id;
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const { prisma } = await import("./prisma");
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return false;

  const isActive =
    sub.status === "active" &&
    sub.stripeCurrentPeriodEnd != null &&
    sub.stripeCurrentPeriodEnd > new Date();

  return isActive;
}
