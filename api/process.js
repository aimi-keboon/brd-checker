import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read raw body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString("utf-8").trim();

    if (!text) {
      return res.status(400).json({ error: "Empty input" });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: text
    });

    // Extract text safely
    let outputText = "No output";
    for (const item of response.output || []) {
      for (const part of item.content || []) {
        if (part.type === "output_text") {
          outputText = part.text;
        }
      }
    }

    return res.status(200).json({ result: outputText });

  } catch (err) {
    console.error("OPENAI ERROR:", err);

    // 🔥 TEMP DEBUG RESPONSE
    return res.status(500).json({
      errorType: err?.name,
      errorMessage: err?.message,
      errorStatus: err?.status,
      errorCode: err?.code
    });
  }
}
