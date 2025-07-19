import { Env, ChatMessage } from "./types";

// Model ID for Workers AI (still used for /api/chat)
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    console.log("Request URL:", url.href);

    // 1. Serve frontend assets for the root path or anything not under /api
    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }
    if (url.pathname === "/api/story" && request.method === "POST") {
      return handleStoryRequest(request, env);
    }


    // 4. Default 404 for unmatched routes
    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;

async function handleStoryRequest(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const { prompt, history = [] } = body;

    console.log("Incoming body:", body);

    const SYSTEM_PROMPT = `
You are a choose-your-own-adventure game engine.

Return the next scene as a raw JSON object. Do NOT use markdown or code blocks.

{
  "text": "Scene text here",
  "choices": [
    { "text": "Option A", "next": "node_id_1" },
    { "text": "Option B", "next": "node_id_2" }
  ]
}

Only return JSON. Do not include markdown, explanations, or commentary.
`.trim();

    const messages = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `
HISTORY:
${history.map((entry, i) => `Scene ${i + 1}:\n${entry.scene}\nPlayer chose: "${entry.content}"\n`).join("\n")}

Continue the story from the last scene. Return ONLY a JSON object like this:
{
  "text": "Scene text here",
  "choices": [
    { "text": "Option A", "next": "node_id_1" },
    { "text": "Option B", "next": "node_id_2" }
  ]
}
Do NOT include markdown, prose, commentary, or code blocks.
`.trim()
      }
    ];

    console.log(messages);


    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        //model: "gpt-3.5-turbo",
        //model: "gpt-4.1-mini",
        model: "gpt-4.1-mini",
        messages,
        temperature: 0.85,
        max_tokens: 1024,
      }),
    });

    const data = await aiResponse.json();

    if (!aiResponse.ok) {
      console.error("OpenAI API error:", data);
      return new Response(JSON.stringify({ error: "OpenAI API error" }), {
        status: aiResponse.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const content = data.choices?.[0]?.message?.content;
    console.log("Raw content from OpenAI:", content);

    const parsed = JSON.parse(content); // assuming content is valid JSON

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Error in handleStoryRequest:", err);
    return new Response(JSON.stringify({ error: "Story generation failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
