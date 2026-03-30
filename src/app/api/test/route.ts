import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("project") || "pagepulse";
  
  const master = createClient(
    process.env.MASTER_SUPABASE_URL!,
    process.env.MASTER_SUPABASE_KEY!
  );
  
  const { data, error } = await master
    .from("projects")
    .select("*")
    .eq("project_id", projectId)
    .single();
  
  if (error) {
    return NextResponse.json({ 
      status: "error", 
      message: "Master DB connection failed",
      error: error.message,
      env: {
        master_url_set: !!process.env.MASTER_SUPABASE_URL,
        master_key_set: !!process.env.MASTER_SUPABASE_KEY
      }
    }, { status: 500 });
  }
  
  if (!data) {
    return NextResponse.json({ 
      status: "not_found", 
      message: `Project '${projectId}' not found in Master DB`,
      available_projects: await master.from("projects").select("project_id,name")
    }, { status: 404 });
  }
  
  return NextResponse.json({
    status: "ok",
    message: "Master DB connected and project found",
    project: {
      id: data.project_id,
      name: data.name,
      supabase_url: data.supabase_url ? "✓ configured" : "✗ missing",
      supabase_key: data.supabase_key ? "✓ configured" : "✗ missing"
    }
  });
}
