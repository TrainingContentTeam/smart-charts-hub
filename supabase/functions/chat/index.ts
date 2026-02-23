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
    const { message, history = [] } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "No message provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiKey = Deno.env.get("GOOGLE_GEMINI_KEY");
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "Gemini API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch data from DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [projectsRes, entriesRes] = await Promise.all([
      supabase.from("projects").select("*"),
      supabase.from("time_entries").select("*, projects(name)").limit(500),
    ]);

    const projects = projectsRes.data || [];
    const entries = entriesRes.data || [];

    // Build context
    const projectSummary = projects
      .map(
        (p: any) =>
          `- ${p.name}${p.authoring_tool ? ` | Tool: ${p.authoring_tool}` : ""}${p.vertical ? ` | Vertical: ${p.vertical}` : ""}${p.course_type ? ` | Type: ${p.course_type}` : ""}${p.id_assigned ? ` | Assigned: ${p.id_assigned}` : ""}${p.reporting_year ? ` | Year: ${p.reporting_year}` : ""}`
      )
      .join("\n");

    // Aggregate hours by project
    const hoursByProject: Record<string, number> = {};
    entries.forEach((e: any) => {
      const name = e.projects?.name || "Unknown";
      hoursByProject[name] = (hoursByProject[name] || 0) + Number(e.hours);
    });
    const hoursSummary = Object.entries(hoursByProject)
      .sort((a, b) => b[1] - a[1])
      .map(([name, hours]) => `- ${name}: ${Math.round(hours * 100) / 100}h`)
      .join("\n");

    const totalHours = entries.reduce((s: number, e: any) => s + Number(e.hours), 0);

    const systemPrompt = `You are an analytics assistant for a project time tracking application. You help analyze course development time data.

Here is the current data:

## Projects (${projects.length} total):
${projectSummary || "No projects yet."}

## Hours by Project (${Math.round(totalHours * 100) / 100} total hours):
${hoursSummary || "No time entries yet."}

## Time Entries: ${entries.length} entries across ${Object.keys(hoursByProject).length} projects.

Answer questions about this data concisely. Use specific numbers. If asked about trends or comparisons, reference the actual data. Format responses with markdown.`;

    // Build Gemini messages
    const contents = [
      ...history.map((h: any) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    // Call Gemini API with streaming
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
      return new Response(JSON.stringify({ error: "AI service error", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream SSE response back
    return new Response(geminiRes.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Chat function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
