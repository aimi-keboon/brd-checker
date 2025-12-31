import OpenAI from "openai";
import pdf from "pdf-parse";
import JSZip from "jszip";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ---------- helpers ----------

// very safe approximation
// 1 token ≈ 4 characters
const TOKENS_PER_CHAR = 1 / 4;

// keep this conservative to leave room for system prompt + output
const MAX_TOKENS_PER_CHUNK = 12000;

function splitIntoChunks(text) {
  const maxChars = Math.floor(MAX_TOKENS_PER_CHUNK / TOKENS_PER_CHAR);
  const chunks = [];

  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + maxChars));
    start += maxChars;
  }

  return chunks;
}

// ---------- handler ----------

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ---- read body ----
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (!buffer.length) {
      return res.status(400).json({ error: "Empty upload" });
    }

    // ---- extract text ----
    const contentType = req.headers["content-type"] || "";
    let text = "";

    if (contentType.includes("text/plain")) {
      text = buffer.toString("utf-8");
    } else if (contentType.includes("application/pdf")) {
      const data = await pdf(buffer);
      text = data.text;
    } else if (
      contentType.includes(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ) {
      const zip = await JSZip.loadAsync(buffer);
      const xml = await zip.file("word/document.xml").async("string");
      text = xml.replace(/<[^>]+>/g, " ");
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    text = (text || "").trim();
    if (!text) {
      return res.status(400).json({ error: "No extractable text found" });
    }

    // ---- chunk document ----
    const docChunks = splitIntoChunks(text);

    // ---- run checker on each chunk ----
    const partialResults = [];

    for (let i = 0; i < docChunks.length; i++) {
      const chunkText = docChunks[i];

      const response = await openai.responses.create({
        model: "gpt-4.1",
        input: `
You are processing PART ${i + 1} of ${docChunks.length} of a larger document.

Analyze ONLY the content below and produce your normal BRD checking output.
Do not assume knowledge of other parts.

--- START OF PART ${i + 1} ---
${chunkText}
--- END OF PART ${i + 1} ---
        `
      });

      if (response.output_text) {
        partialResults.push(
          `### Analysis for Part ${i + 1}\n${response.output_text}`
        );
      }
    }

    // ---- merge results ----
    const mergedInput = `
The following are analyses of different parts of the SAME document.

Your task:
- Merge them into ONE coherent final BRD review
- Remove duplicates
- Resolve overlaps
- Produce a single, clean result

${partialResults.join("\n\n")}
    `;

    const finalResponse = await openai.responses.create({
      model: "gpt-4.1",
      input: mergedInput
    });

    return res.status(200).json({
      result: finalResponse.output_text || "(No final output generated)"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Processing failed"
    });
  }
}
