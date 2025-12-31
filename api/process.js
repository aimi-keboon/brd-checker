import OpenAI from "openai";
import pdf from "pdf-parse";
import JSZip from "jszip";

/* ================= CONFIG ================= */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// token ≈ 4 chars (safe estimate)
const TOKENS_PER_CHAR = 1 / 4;
const MAX_TOKENS_PER_CHUNK = 2500;
const THROTTLE_MS = 7000;

const CHUNK_MODEL = "gpt-4o-mini";
const FINAL_MODEL = "gpt-4.1";

/* ================= PROMPT ================= */

const BRD_REVIEW_PROMPT = `
You are reviewing a Business Requirement Document (BRD) as a Project Manager and Development Manager before any development starts.

Your feedback is written for the Business Analyst, so it must be clear, specific, and actionable.

Assume:
• Anything not clearly documented is missing
• Developers will not ask clarifying questions
• Ambiguity equals delivery risk

---

What You Must Do

1. Decide whether the BRD is:
• READY FOR DEVELOPMENT
• NOT READY FOR DEVELOPMENT

There is no conditional status.
If anything material is missing or unclear, the BRD is NOT READY.

2. Clearly explain why.
3. Clearly list what must be improved or added.
4. Ask specific questions the BRD must answer.

Do not rewrite the BRD.
Do not assume missing context.

---

What You Must Review

• Business objectives and success criteria
• In-scope and out-of-scope definitions
• Functional requirements
• Non-functional requirements
• End-to-end flows
• Edge cases
• Module scope and dependencies
• Integrations and data flow
• Data ownership and lifecycle
• Security, access, audit, compliance
• Terminology consistency

---

Required Response Format (MANDATORY)

1. BRD Readiness Decision
2. What Is Clear and Well-Defined
3. What Is Missing or Unclear
4. Blocking Issues
5. Questions the BRD Must Answer

Tone:
• Direct
• Professional
• No assumptions
• Ambiguity is a defect
`;

/* ================= HELPERS ================= */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

/* ================= HANDLER ================= */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    /* ---- read upload ---- */
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (!buffer.length) {
      return res.status(400).json({ error: "Empty upload" });
    }

    /* ---- extract text ---- */
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

    text = text.trim();
    if (!text) {
      return res.status(400).json({ error: "No extractable text" });
    }

    /* ---- chunk doc ---- */
    const docChunks = splitIntoChunks(text);
    const partialResults = [];

    /* ---- analyze chunks ---- */
    for (let i = 0; i < docChunks.length; i++) {
      const response = await openai.responses.create({
        model: CHUNK_MODEL,
        input: `
${BRD_REVIEW_PROMPT}

You are reviewing PART ${i + 1} of ${docChunks.length}.
Analyze ONLY this part.

--- START ---
${docChunks[i]}
--- END ---
`
      });

      if (response.output_text) {
        partialResults.push(
          `### Part ${i + 1}\n${response.output_text}`
        );
      }

      await sleep(THROTTLE_MS);
    }

    /* ---- merge ---- */
    const finalResponse = await openai.responses.create({
      model: FINAL_MODEL,
      input: `
${BRD_REVIEW_PROMPT}

The following are partial analyses of the SAME BRD.
Merge them into ONE final response.
Remove duplicates and resolve overlaps.

${partialResults.join("\n\n")}
`
    });

    return res.status(200).json({
      result: finalResponse.output_text || "(No output)"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Processing failed"
    });
  }
}
