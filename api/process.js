import OpenAI from "openai";
import pdf from "pdf-parse";
import JSZip from "jszip";

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
    // Read raw body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (!buffer.length) {
      return res.status(400).json({ error: "Empty file" });
    }

    const contentType = req.headers["content-type"] || "";
    let text = "";

    // TXT / MD
    if (contentType.includes("text/plain")) {
      text = buffer.toString("utf-8");
    }

    // PDF
    else if (contentType.includes("application/pdf")) {
      const data = await pdf(buffer);
      text = data.text;
    }

    // DOCX
    else if (
      contentType.includes(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ) {
      const zip = await JSZip.loadAsync(buffer);
      const xml = await zip.file("word/document.xml").async("string");
      text = xml.replace(/<[^>]+>/g, " ");
    }

    else {
      return res.status(400).json({
        error: "Unsupported file type"
      });
    }

    if (!text.trim()) {
      return res.status(400).json({
        error: "No extractable text found in file"
      });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: text
    });

    const outputText = response.output_text || "(No text output)";

    return res.status(200).json({ result: outputText });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Processing failed"
    });
  }
}
