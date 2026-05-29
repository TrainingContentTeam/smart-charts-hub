import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const MAX_MESSAGE_LENGTH = 4000;
    const MAX_HISTORY_ITEMS = 20;
    const MAX_HISTORY_ITEM_LENGTH = 4000;

    const { message, history = [] } = await req.json();
    if (!message || typeof message !== "string" || message.length === 0 || message.length > MAX_MESSAGE_LENGTH) {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(history) || history.length > MAX_HISTORY_ITEMS) {
      return new Response(JSON.stringify({ error: "Invalid history" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    for (const h of history) {
      if (
        !h ||
        typeof h !== "object" ||
        typeof h.role !== "string" ||
        typeof h.content !== "string" ||
        h.content.length > MAX_HISTORY_ITEM_LENGTH ||
        (h.role !== "user" && h.role !== "assistant" && h.role !== "model")
      ) {
        return new Response(JSON.stringify({ error: "Invalid history item" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const geminiKey = Deno.env.get("GOOGLE_GEMINI_KEY");
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "Gemini API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the user's client (respects RLS) to fetch only their data from the new canonical raw tables
    const [projectsRes, timeLogsRes] = await Promise.all([
      userClient.from("raw_project_import_rows").select("raw_course_name, reporting_year, course_type, authoring_tool, vertical_raw, id_assigned_raw, project_total_minutes"),
      userClient.from("raw_time_log_rows").select("raw_course_name, minutes").limit(2000),
    ]);

    const projects = projectsRes.data || [];
    const timeLogs = timeLogsRes.data || [];

    // Build context
    const projectSummary = projects
      .map(
        (p: any) =>
          `- ${p.raw_course_name}${p.authoring_tool ? ` | Tool: ${p.authoring_tool}` : ""}${p.vertical_raw ? ` | Vertical: ${p.vertical_raw}` : ""}${p.course_type ? ` | Type: ${p.course_type}` : ""}${p.id_assigned_raw ? ` | Assigned: ${p.id_assigned_raw}` : ""}${p.reporting_year ? ` | Year: ${p.reporting_year}` : ""}`
      )
      .join("\n");

    const minutesByCourse: Record<string, number> = {};
    timeLogs.forEach((e: any) => {
      const name = e.raw_course_name || "Unknown";
      minutesByCourse[name] = (minutesByCourse[name] || 0) + Number(e.minutes || 0);
    });
    const hoursSummary = Object.entries(minutesByCourse)
      .sort((a, b) => b[1] - a[1])
      .map(([name, minutes]) => `- ${name}: ${Math.round((minutes / 60) * 100) / 100}h`)
      .join("\n");

    const totalHours = timeLogs.reduce((s: number, e: any) => s + Number(e.minutes || 0), 0) / 60;

    const systemPrompt = `You are an analytics assistant for a project time tracking application. You help analyze course development time data.

Here is the current data:

## Projects (${projects.length} total):
${projectSummary || "No projects yet."}

## Hours by Course (${Math.round(totalHours * 100) / 100} total hours):
${hoursSummary || "No time entries yet."}

## Time Entries: ${timeLogs.length} entries across ${Object.keys(minutesByCourse).length} courses.

Answer questions about this data concisely. Use specific numbers. If asked about trends or comparisons, reference the actual data. Format responses with markdown.`;

    const contents = [
      ...history.map((h: any) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${geminiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error:", errText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(geminiRes.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Chat function error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
