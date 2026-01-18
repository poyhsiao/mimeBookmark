import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCustomerPortalSession } from "@/lib/stripe/server";

// Shared fallback URL constant to ensure consistency across isValidUrl and defaultReturnUrl
const APP_URL_FALLBACK = "http://localhost:3000";

// Get the app URL with consistent fallback
function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || APP_URL_FALLBACK;
}

// Helper to validate URL - prevents open redirect vulnerabilities
function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    // Only allow URLs from our app's domain
    const appUrl = new URL(getAppUrl());
    return url.hostname === appUrl.hostname;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { returnUrl?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { returnUrl } = body;

    // Validate returnUrl to prevent open redirect attacks
    const appUrl = getAppUrl();
    const defaultReturnUrl = `${appUrl}/settings/billing`;
    const validatedReturnUrl =
      returnUrl && isValidUrl(returnUrl) ? returnUrl : defaultReturnUrl;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 400 },
      );
    }

    const session = await createCustomerPortalSession(
      profile.stripe_customer_id,
      validatedReturnUrl,
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Portal session error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 },
    );
  }
}
