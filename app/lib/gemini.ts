import { GoogleGenerativeAI } from "@google/generative-ai";

const api_token = process.env.GEMINI_API_KEY!;
const account_id = "424609b50dfe49b156a6ec4a85c9ae88";
const gateway_name = "matome-box-gemini";

const genAI = new GoogleGenerativeAI(api_token);
export const model = genAI.getGenerativeModel(
  { model: "gemini-2.5-flash-preview-04-17" },
  {
    baseUrl: `https://gateway.ai.cloudflare.com/v1/${account_id}/${gateway_name}/google-ai-studio`,
  }
);