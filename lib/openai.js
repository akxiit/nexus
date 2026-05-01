import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function extractResponseText(response) {
  if (response?.output_text) return response.output_text.trim();

  const output = Array.isArray(response?.output) ? response.output : [];
  for (const item of output) {
    const contents = Array.isArray(item?.content) ? item.content : [];
    for (const content of contents) {
      if (content?.type === "output_text" && typeof content?.text === "string") {
        const text = content.text.trim();
        if (text) return text;
      }
    }
  }

  return "";
}

export async function generateWithOpenAI(prompt) {
  try {
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      max_output_tokens: 2048,
      input: prompt,
    });

    const text = extractResponseText(response);
    if (!text) {
      throw new Error("OpenAI returned an empty response");
    }

    return text;
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw error;
  }
}

export async function generateWithOpenAIStream(prompt) {
  try {
    const stream = await openai.responses.stream({
      model: "gpt-4o-mini",
      max_output_tokens: 2048,
      input: prompt,
    });

    return stream;
  } catch (error) {
    console.error("OpenAI Streaming Error:", error);
    throw error;
  }
}
