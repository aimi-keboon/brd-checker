import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const inputText = Buffer.concat(chunks).toString("utf-8").trim();

    const aiResponse = await openai.responses.create({
      model: "gpt-4.1",
      input: inputText
    });

    // 🔥 TEMP: return EVERYTHING
    return res.status(200).json({
      raw: aiResponse
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
