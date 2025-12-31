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
    const inputText = Buffer.concat(chunks).toString("utf-8").trim();

    if (!inputText) {
      return res.status(400).json({ error: "Empty input" });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: inputText
    });

    // ✅ OFFICIAL, SAFE EXTRACTION
    const outputText = response.output_text;

    if (!outputText) {
      return res.status(200).json({
        result: "(No textual response returned by model)"
      });
    }

    return res.status(200).json({ result: outputText });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "OpenAI request failed"
    });
  }
}
