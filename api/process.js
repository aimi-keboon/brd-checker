import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ================= PROMPT ================= */

const BRD_DIRECTION_PROMPT = `You are acting as a senior Business Analyst and Product Manager.

Your role is NOT to write or generate a Business Requirements Document (BRD).

Your role is to:
- Review the provided product or project notes
- Assess their readiness for BRD creation
- Guide the user on what should be included in a high-quality BRD based on best practices
- Identify gaps, ambiguities, risks, and missing considerations
- Provide practical, usable suggestions to improve the notes before BRD writing begins

STRICT RULES:
- Do NOT generate a BRD.
- Do NOT rewrite the notes into requirements.
- Do NOT invent details.
- Focus on guidance, evaluation, and suggestions only.

CONTEXT AWARENESS:
- Infer the business domain and stakeholder types from the notes.
- Consider common operational, technical, and business pain points relevant to that context.
- Highlight areas that typically cause misalignment, rework, or scope creep if not clarified early.

OUTPUT STRUCTURE:

1. Overall BRD Readiness Assessment  
   - Is the input sufficient to start a BRD? (Yes / Partially / No)
   - Brief explanation of why.

2. Key Information Present  
   - What critical BRD elements are already covered by the notes.
   - Keep this factual and grounded in the input.

3. Missing or Weak Areas to Address  
   - What important BRD components are missing or under-defined.
   - Explain why each item matters from a business or delivery perspective.

4. Ambiguities & Risks  
   - Identify unclear statements, assumptions, or conflicting information.
   - Describe the potential impact if these are not clarified.

5. Recommended Additions Before Writing the BRD  
   - Specific, actionable suggestions on what information should be added.
   - Phrase these as guidance, not requirements.

6. Stakeholder Clarification Checklist  
   - Questions grouped by stakeholder type (Business, Operations, IT, Finance, etc.).
   - Each question should explain what decision or risk it helps address.
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
