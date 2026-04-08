import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "nexus",
  name: "Nexus",
  credentials: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
    },
  },
});