import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const PROJECT_CONFIGS: Record<string, { 
  name: string; 
  url: string;
  supabaseUrl: string;
  supabaseKey: string;
}> = {
  pagepulse: {
    name: "PagePulse",
    url: "https://pagepulse-v2.vercel.app",
    supabaseUrl: process.env.PAGEPULSE_SUPABASE_URL || "",
    supabaseKey: process.env.PAGEPULSE_SUPABASE_KEY || "",
  },
  // Future projects added here
};

export async function POST(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("project");
  
  if (!projectId || !PROJECT_CONFIGS[projectId]) {
    return NextResponse.json({ error: "Invalid project_id" }, { status: 400 });
  }

  const config = PROJECT_CONFIGS[projectId];
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2023-10-16",
  });

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // Route to project-specific handler
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      
      await supabase.from("subscriptions").insert({
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        plan: session.metadata?.plan || "unknown",
        status: "active",
        project: projectId,
      });
      
      break;
    }
    
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      
      await supabase.from("subscriptions").update({
        status: "past_due",
      }).eq("stripe_subscription_id", invoice.subscription);
      
      break;
    }
    
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      
      await supabase.from("subscriptions").update({
        status: "cancelled",
      }).eq("stripe_subscription_id", subscription.id);
      
      break;
    }
  }

  return NextResponse.json({ received: true, project: projectId });
}
