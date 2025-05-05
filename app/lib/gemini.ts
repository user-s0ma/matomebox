import { GoogleGenAI } from "@google/genai";

const api_token = process.env.GEMINI_API_KEY!;
const account_id = "424609b50dfe49b156a6ec4a85c9ae88";
const gateway_name = "nectnews-ai";

export const ai = new GoogleGenAI({
  apiKey: api_token,
  httpOptions: { baseUrl: `https://gateway.ai.cloudflare.com/v1/${account_id}/${gateway_name}/google-ai-studio` },
});