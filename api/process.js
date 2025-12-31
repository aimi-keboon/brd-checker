import OpenAI from "openai";
import pdf from "pdf-parse";
import JSZip from "jszip";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Rough token estimate: 1 token ≈ 4 chars for English-ish text
function estimateTokens(str) {
  return Math.ceil((str || "").length / 4);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (!buffer.length) return res.status(400).json({ error: "Empty file" });

    const contentType = req.headers["content-type"] || "";
    let text = "";

    if (contentType.includes("text/plain")) {
      text = buffer.toString("utf-8");
    } else if (contentType.includes("application/pdf")) {
      const data = await pdf(buffer);
      text = data.text;
    } else if (
      contentType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ) {
      const zip = await JSZip.loadAsync(buffer);
      const xml = await zip.file("word/document.xml").async("string");
      text = xml.replace(/<[^>]+>/g, " ");
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    text = (text || "").trim();
    if (!text) return res.status(400).json({ error: "No extractable text found in file" });

    // ✅ Guardrail against context window overflow
    const estTokens = estimateTokens(text);

    // Conservative safe limit so we leave room for the model's output.
    // If you later change models, adjust this number.
    const MAX_INPUT_TOKENS_EST = 50000;

    if (estTokens > MAX_INPUT_TOKENS_EST) {
      return res.status(400).json({
        error:
          `Document too long for a single request.\n` +
          `Estimated tokens: ${estTokens}.\n` +
          `Please upload a shorter file or split it into smaller parts.`
      });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: text
    });

    return res.status(200).json({
      result: response.output_text || "(No text output)"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Processing failed" });
  }
}
