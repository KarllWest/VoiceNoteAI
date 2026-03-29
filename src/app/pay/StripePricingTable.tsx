"use client";

import Script from "next/script";
import React from "react";

// Cast the custom element to avoid TS errors with web components
const PricingTable = "stripe-pricing-table" as unknown as React.ComponentType<{
  "pricing-table-id": string;
  "publishable-key": string;
  "client-reference-id"?: string;
  "customer-email"?: string;
  "success-url"?: string;
}>;

interface StripePricingTableProps {
  userId: string;
  email: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export default function StripePricingTable({ userId, email }: StripePricingTableProps) {
  return (
    <>
      <Script async src="https://js.stripe.com/v3/pricing-table.js" />
      <PricingTable
        pricing-table-id="prctbl_1TFeyXKDOpumQMNrAE0W5eml"
        publishable-key={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
        client-reference-id={userId}
        customer-email={email}
        success-url={`${APP_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`}
      />
    </>
  );
}
