import { Env, ChatMessage } from "./types";

// Model ID for Workers AI (still used for /api/chat)
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";


const SYSTEM_PROMPT = `
You are a utopian, pleasant, choose-your-own-adventure game engine.

Given a current scene and the player's choice (if any), return the next scene as a JSON object:

{
  "text": "Scene text here",
  "choices": [
    { "text": "Option A", "next": "node_id_1" },
    { "text": "Option B", "next": "node_id_2" }
  ]
}

Always return exactly two choices. Each choice must lead to a different scene. Do not return more or fewer than two.

Only return JSON. Do not include markdown, explanations, or commentary.
`.trim();



export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Serve frontend assets for the root path or anything not under /api
    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/story" && request.method === "GET") {
      return await handleStoryRequest(request, env);
    }
    if (url.pathname === "/api/story" && request.method === "POST") {
      return handleStoryRequest(request, env);
    }



    // 3. Existing chat route (optional)
    if (url.pathname === "/api/chat") {
      if (request.method === "POST") {
        return handleChatRequest(request, env);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    // 4. Default 404 for unmatched routes
    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;

async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  console.log("Handling chat request...");
  try {
    const { messages = [] } = (await request.json()) as { messages: ChatMessage[] };

    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    const response = await env.AI.run(
      MODEL_ID,
      { messages, max_tokens: 1024 },
      { returnRawResponse: true }
    );

    return response;
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(JSON.stringify({ error: "Failed to process request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function handleStoryRequest(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const userPrompt = body.prompt || null;

    const messages = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: userPrompt
          ? `Begin a choose-your-own-adventure story using this prompt: "${userPrompt}". Return only the first node.`
          : `Begin the story. Generate the first node.`,
      },
    ];

    const aiResponse = await env.AI.run(
      MODEL_ID,
      { messages, max_tokens: 1024 },
      { returnRawResponse: true }
    );

    const rawText = await aiResponse.text();
    const parsed = JSON.parse(rawText);

    return new Response(JSON.stringify(parsed.response || parsed), {
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
