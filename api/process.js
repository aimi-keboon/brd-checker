import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ================= PROMPT ================= */

const BRD_DIRECTION_PROMPT = `You are acting as a senior Business Analyst.

Your role is NOT to write a Business Requirements Document (BRD).

Your role is to generate a concise, context-aware guidance checklist that helps PMs and BAs prepare to write a BRD, based strictly on the provided notes, regardless of industry or domain.

STRICT RULES:
- Do NOT generate a BRD.
- Do NOT explain general BA theory.
- Do NOT invent business context beyond what can be reasonably inferred from the notes.
- Use short, directive bullet points only.
- Each bullet must clearly relate to the specific notes provided.
- Avoid generic statements that could apply to any project.

OUTPUT STYLE:
- Brief, concrete, and practical
- One line per bullet
- No questions; use guidance statements instead

OUTPUT STRUCTURE:

Business Objective (derived from notes)
- State the core problem the initiative is addressing
- Clarify the primary outcome the business expects

Key Pain Points the BRD Must Solve
- List specific operational, financial, or process issues evident from the notes

Stakeholders & Decision Ownership
- Identify decision owners implied by the notes
- Clarify approval authority for critical actions

Core Areas to Clarify Before BRD
- Data or entities that must be managed
- Processes or workflows that must be supported
- Rules or calculations that must be defined

Rules & Exceptions
- Identify approvals, overrides, or special cases implied by the notes

Scope Boundaries
- Confirm what is included in the initial scope
- Explicitly state what is excluded or uncertain

Data, Access & Audit
- Define access control needs implied by the notes
- Identify audit or traceability requirements

Integrations & Constraints
- Identify system dependencies or integrations mentioned
- Clarify timeline, budget, or technical constraints

Reporting & Visibility
- Identify visibility or reporting gaps mentioned
- Define what information must be surfaced to address them

Open Items to Resolve Before BRD
- Highlight unclear decisions, assumptions, or missing details from the notes
`;

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
    // Read raw text
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const notes = Buffer.concat(chunks).toString("utf-8").trim();

    if (!notes) {
      return res.status(400).json({ error: "Empty input" });
    }

    // Safety guard (keep it fast & cheap)
    if (notes.length > 20_000) {
      return res.status(400).json({
        error:
          "Notes are too long for this tool.\n" +
          "Please upload shorter stakeholder notes or summaries."
      });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: `
${BRD_DIRECTION_PROMPT}

--- STAKEHOLDER NOTES ---
${notes}
--- END ---
`
    });

    return res.status(200).json({
      result: response.output_text || "(No output generated)"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Processing failed"
    });
  }
}
