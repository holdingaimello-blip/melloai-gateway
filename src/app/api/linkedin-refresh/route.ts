import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET!;
const MASTER_SUPABASE_URL = process.env.MASTER_SUPABASE_URL!;
const MASTER_SUPABASE_KEY = process.env.MASTER_SUPABASE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Get current token from Master DB
    const master = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_KEY);
    
    const { data: tokenData, error: tokenError } = await master
      .from("linkedin_tokens")
      .select("*")
      .eq("user_id", "mello")
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: "No token found" }, { status: 404 });
    }

    // If no refresh token, can't refresh
    if (!tokenData.refresh_token) {
      return NextResponse.json({ 
        error: "No refresh token available. Re-authorization required." 
      }, { status: 400 });
    }

    // Refresh token
    const refreshResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenData.refresh_token,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }),
    });

    const refreshData = await refreshResponse.json();

    if (!refreshResponse.ok) {
      return NextResponse.json({ 
        error: "Token refresh failed", 
        details: refreshData 
      }, { status: 500 });
    }

    // Update token in DB
    const { error: updateError } = await master
      .from("linkedin_tokens")
      .update({
        access_token: refreshData.access_token,
        expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", "mello");

    if (updateError) {
      return NextResponse.json({ 
        error: "Failed to update token", 
        details: updateError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Token refreshed",
      expires_in: refreshData.expires_in,
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: "Refresh error", 
      details: error.message 
    }, { status: 500 });
  }
}
