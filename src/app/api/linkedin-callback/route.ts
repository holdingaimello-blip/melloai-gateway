import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET!;

// MelloAi Master DB
const MASTER_SUPABASE_URL = process.env.MASTER_SUPABASE_URL!;
const MASTER_SUPABASE_KEY = process.env.MASTER_SUPABASE_KEY!;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json({ error: "LinkedIn auth failed", details: error }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "No authorization code" }, { status: 400 });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: "https://melloai-gateway.vercel.app/api/linkedin-callback",
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return NextResponse.json({ 
        error: "Token exchange failed", 
        details: tokenData 
      }, { status: 500 });
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Get user info via OpenID (urn:li:person:id)
    const userinfoResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        "Authorization": `Bearer ${access_token}`,
      },
    });

    let linkedinUrn = "mello_linkedin_global";
    let linkedinId = "unknown";

    if (userinfoResponse.ok) {
      const userinfo = await userinfoResponse.json();
      linkedinId = userinfo.sub; // OpenID subject = LinkedIn person ID
      linkedinUrn = `urn:li:person:${linkedinId}`;
    }

    // Save tokens to Master DB (global LinkedIn profile for Mello)
    const master = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_KEY);

    const { error: dbError } = await master
      .from("linkedin_tokens")
      .upsert({
        user_id: "mello", // Global MelloAi profile
        linkedin_id: linkedinId,
        linkedin_urn: linkedinUrn,
        access_token: access_token,
        refresh_token: refresh_token,
        expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id"
      });

    if (dbError) {
      return NextResponse.json({ 
        error: "Failed to save tokens", 
        details: dbError.message 
      }, { status: 500 });
    }

    // Redirect to PagePulse success page
    return NextResponse.redirect("https://pagepulse.eu/dashboard?linkedin=connected");

  } catch (error: any) {
    return NextResponse.json({ 
      error: "LinkedIn callback failed", 
      details: error.message 
    }, { status: 500 });
  }
}
