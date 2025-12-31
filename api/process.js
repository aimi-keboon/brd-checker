import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  // --- CORS HEADERS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // --- HANDLE PREFLIGHT ---
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --- ONLY ALLOW POST ---
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read raw request body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const text = Buffer.concat(chunks).toString("utf-8");

    if (!text.trim()) {
      return res.status(400).json({ error: "Empty input" });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: text
    });

    return res.status(200).json({
      result: response.output_text
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
