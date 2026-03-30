import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Test endpoint - simulates Stripe event without signature verification
export async function POST(request: NextRequest) {
  try {
    const event = await request.json();
    
    // Extract project_id from metadata
    const eventData = event.data?.object;
    const projectId = eventData?.metadata?.project_id;
    
    if (!projectId) {
      return NextResponse.json({ 
        error: "Missing project_id in metadata",
        received: event 
      }, { status: 400 });
    }
    
    // Connect to Master DB
    const master = createClient(
      process.env.MASTER_SUPABASE_URL!,
      process.env.MASTER_SUPABASE_KEY!
    );
    
    // Get project config
    const { data: config, error: configError } = await master
      .from("projects")
      .select("*")
      .eq("project_id", projectId)
      .single();
    
    if (configError || !config) {
      return NextResponse.json({ 
        error: "Project not found",
        project_id: projectId,
        config_error: configError?.message 
      }, { status: 404 });
    }
    
    // Log to webhook_events
    const { data: logEntry, error: logError } = await master
      .from("webhook_events")
      .insert({
        project_id: projectId,
        stripe_event_id: event.id,
        event_type: event.type,
        status: "processed"
      })
      .select()
      .single();
    
    if (logError) {
      return NextResponse.json({ 
        error: "Failed to log event",
        details: logError.message 
      }, { status: 500 });
    }
    
    // Connect to project Supabase
    const projectSupabase = createClient(config.supabase_url, config.supabase_key);
    
    // Insert subscription (simulated)
    const { data: sub, error: subError } = await projectSupabase
      .from("subscriptions")
      .insert({
        stripe_customer_id: eventData.customer,
        stripe_subscription_id: eventData.subscription,
        plan: eventData.metadata?.plan || "unknown",
        status: "active",
        project_id: projectId
      })
      .select()
      .single();
    
    return NextResponse.json({
      success: true,
      message: "Test event processed successfully",
      project: {
        id: config.project_id,
        name: config.name
      },
      log_entry: logEntry,
      subscription: subError ? { error: subError.message } : sub
    });
    
  } catch (error: any) {
    return NextResponse.json({
      error: "Test failed",
      details: error.message
    }, { status: 500 });
  }
}
