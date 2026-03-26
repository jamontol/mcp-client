import {
    CopilotRuntime,
    copilotRuntimeNextJSAppRouterEndpoint,
    langGraphPlatformEndpoint,
    LangChainAdapter
} from "@copilotkit/runtime";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph"; // Import this!
import { NextRequest } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenRouter } from "@langchain/openrouter";

const langsmithApiKey = process.env.LANGSMITH_API_KEY as string;

const runtime = new CopilotRuntime({
  // Use 'agents' instead of 'remoteEndpoints'
  agents: {
    mcp_agent: new LangGraphAgent({
      deploymentUrl: process.env.AGENT_DEPLOYMENT_URL || "http://localhost:8123",
      langsmithApiKey,
      graphId: "mcp_agent",
    }),
    }
});

export const POST = async (req: NextRequest) => {
    // Extract the user's API key from the request headers
    // const openaiApiKey = req.headers.get("x-openai-api-key");
    
    // // Create model with the API key from headers
    const model = new ChatOpenAI({
        modelName: "gpt-4o-mini",
        temperature: 0,
        apiKey: openaiApiKey || process.env["OPENAI_API_KEY"],
    });

    
    // const model = new ChatGoogleGenerativeAI({
    //     modelName: "gemini-2.5-flash", 
    //     apiKey: process.env.GOOGLE_API_KEY,
    //     temperature: 0,
    // });
    
    // Create service adapter with the model
    // const serviceAdapter = new LangChainAdapter({
    //     chainFn: async ({ messages, tools }) => {
    //         return model.bindTools(tools, { strict: true }).stream(messages);
    //     },
    // });

    const serviceAdapter = new LangChainAdapter({
        chainFn: async ({ messages, tools }) => {
            // We manually bind tools and stream the response
            return model.bindTools(tools).stream(messages);
        },
    });

    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
        runtime,
        serviceAdapter,
        endpoint: "/api/copilotkit",
    });

    return handleRequest(req);
};

// This allows the frontend to "see" your agents via a GET request
export const GET = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: undefined, // GET requests don't need the LLM adapter
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};