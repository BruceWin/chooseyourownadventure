import { Env, ChatMessage } from "./types";

// Model ID for Workers AI (still used for /api/chat)
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// System prompt for LLM chat (if needed)
const SYSTEM_PROMPT = `
You are a choose-your-own-adventure game engine.

Given a current scene and the player's choice (if any), return the next scene as a JSON object:

{
  "text": "Scene text here",
  "choices": [
    { "text": "Option A", "next": "node_id_1" },
    { "text": "Option B", "next": "node_id_2" }
  ]
}

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
  console.log("Handling story generation request...");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a text adventure game engine. Generate a short choose-your-own-adventure story tree in JSON format. Structure it like this: { nodeId: { text: string, choices: [ { text: string, next: nodeId }, ... ] }, ... }. Respond with ONLY the JSON — no commentary, no markdown, no explanation."
    },
    {
      role: "user",
      content:
        "Start the story with the player waking up in a mysterious forest. Include 5-6 total nodes, with at least two endings."
    }
  ];

  try {
    const aiResponse = await env.AI.run(
      MODEL_ID,
      { messages, max_tokens: 1024 },
      { returnRawResponse: true }
    );

    //var responseText = await response.text();
    const rawText = await aiResponse.text(); // stringified object
    const response = JSON.parse(rawText); // has .response   
    console.log("Handling story generation request done");
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error generating story:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate story" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
