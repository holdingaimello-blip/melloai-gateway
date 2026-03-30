import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MASTER_SUPABASE_URL = process.env.MASTER_SUPABASE_URL!;
const MASTER_SUPABASE_KEY = process.env.MASTER_SUPABASE_KEY!;

// Post templates
const POSTS = [
  {
    time: "09:00",
    text: "How many sales do you lose because competitors change prices and you notice too late?\n\nThe MelloAi team built PagePulse for 340+ e-commerce stores: real-time competitor monitoring that alerts you in minutes, not days.\n\nTry it free → https://pagepulse.eu\n\n#ecommerce #competitorintelligence #MelloAi"
  },
  {
    time: "15:00",
    text: "Your competitor just dropped prices by 20%. While you were in meetings.\n\nPagePulse alerts you in real-time. Never miss a move.\n\nProtect your margins → https://pagepulse.eu\n\n#ecommerce #MelloAi"
  },
  {
    time: "21:00",
    text: "340+ e-commerce teams trust PagePulse to track competitor moves.\n\nAverage response time: 47 minutes.\n\nWhat will you know tomorrow?\n\nJoin them → https://pagepulse.eu\n\n#competitorintelligence #MelloAi"
  }
];

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { time } = await request.json();
    const post = POSTS.find(p => p.time === time) || POSTS[0];

    // Get LinkedIn token
    const master = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_KEY);
    const { data: tokenData } = await master
      .from("linkedin_tokens")
      .select("access_token,linkedin_urn")
      .eq("user_id", "mello")
      .single();

    if (!tokenData) {
      return NextResponse.json({ error: "LinkedIn not authorized" }, { status: 401 });
    }

    // Post to LinkedIn
    const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: tokenData.linkedin_urn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: post.text },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: "LinkedIn post failed", details: error }, { status: 500 });
    }

    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      post_id: result.id,
      time: post.time,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
