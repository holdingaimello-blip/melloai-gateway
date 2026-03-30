import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// MelloAi Master Database - central configuration
const MASTER_SUPABASE_URL = process.env.MASTER_SUPABASE_URL!;
const MASTER_SUPABASE_KEY = process.env.MASTER_SUPABASE_KEY!;

interface ProjectConfig {
  project_id: string;
  name: string;
  supabase_url: string;
  supabase_key: string;
  stripe_webhook_secret?: string;
}

async function getProjectConfig(projectId: string): Promise<ProjectConfig | null> {
  const master = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_KEY);
  
  const { data, error } = await master
    .from("projects")
    .select("*")
    .eq("project_id", projectId)
    .single();
  
  if (error || !data) return null;
  return data as ProjectConfig;
}

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  // Verify with universal webhook secret
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2023-10-16",
  });

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Extract project_id from metadata
  const eventData = event.data.object as any;
  const projectId = eventData.metadata?.project_id;

  if (!projectId) {
    console.error("No project_id in event metadata");
    return NextResponse.json({ error: "Missing project_id" }, { status: 400 });
  }

  // Fetch project configuration dynamically
  const config = await getProjectConfig(projectId);
  
  if (!config) {
    console.error("Project not found:", projectId);
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Connect to project-specific Supabase
  const projectSupabase = createClient(config.supabase_url, config.supabase_key);

  // Process event based on type
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        await projectSupabase.from("subscriptions").insert({
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          plan: session.metadata?.plan || "unknown",
          status: "active",
          project_id: projectId,
          created_at: new Date().toISOString(),
        });
        
        console.log(`✅ Subscription created for ${projectId}`);
        break;
      }
      
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        
        await projectSupabase.from("subscriptions").update({
          status: "active",
          last_payment_at: new Date().toISOString(),
        }).eq("stripe_subscription_id", invoice.subscription);
        
        console.log(`✅ Payment succeeded for ${projectId}`);
        break;
      }
      
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        
        await projectSupabase.from("subscriptions").update({
          status: "past_due",
        }).eq("stripe_subscription_id", invoice.subscription);
        
        console.log(`⚠️ Payment failed for ${projectId}`);
        break;
      }
      
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        
        await projectSupabase.from("subscriptions").update({
          status: subscription.status,
          updated_at: new Date().toISOString(),
        }).eq("stripe_subscription_id", subscription.id);
        
        console.log(`📝 Subscription updated for ${projectId}`);
        break;
      }
      
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        
        await projectSupabase.from("subscriptions").update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        }).eq("stripe_subscription_id", subscription.id);
        
        console.log(`❌ Subscription cancelled for ${projectId}`);
        break;
      }
      
      default: {
        console.log(`ℹ️ Unhandled event type: ${event.type} for ${projectId}`);
      }
    }

    return NextResponse.json({ 
      received: true, 
      project: projectId,
      event: event.type 
    });
    
  } catch (error: any) {
    console.error(`Error processing event for ${projectId}:`, error.message);
    return NextResponse.json({ 
      error: "Processing failed", 
      details: error.message 
    }, { status: 500 });
  }
}
