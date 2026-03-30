import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MASTER_SUPABASE_URL = process.env.MASTER_SUPABASE_URL!;
const MASTER_SUPABASE_KEY = process.env.MASTER_SUPABASE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    
    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Get LinkedIn token from Master DB
    const master = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_KEY);
    
    const { data: tokenData, error: tokenError } = await master
      .from("linkedin_tokens")
      .select("access_token")
      .eq("user_id", "mello")
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({ 
        error: "LinkedIn not authorized", 
        details: tokenError?.message 
      }, { status: 401 });
    }

    // Get user profile to obtain correct URN
    const profileResponse = await fetch("https://api.linkedin.com/v2/me", {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });

    if (!profileResponse.ok) {
      return NextResponse.json({ 
        error: "Failed to get LinkedIn profile", 
        details: await profileResponse.text()
      }, { status: 500 });
    }

    const profile = await profileResponse.json();
    const authorUrn = `urn:li:person:${profile.id}`;

    // Post to LinkedIn
    const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: authorUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: text,
            },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      }),
    });

    if (!postResponse.ok) {
      const errorData = await postResponse.json();
      return NextResponse.json({ 
        error: "LinkedIn post failed", 
        details: errorData 
      }, { status: 500 });
    }

    const result = await postResponse.json();
    
    return NextResponse.json({
      success: true,
      message: "Posted to LinkedIn",
      post_id: result.id,
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: "LinkedIn post error", 
      details: error.message 
    }, { status: 500 });
  }
}
