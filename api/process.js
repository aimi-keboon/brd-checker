import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ================= PROMPT ================= */

const BRD_DIRECTION_PROMPT = `
You are helping an Operations Manager or Project Manager turn rough stakeholder notes into clear direction for writing a proper Business Requirement Document (BRD).

The input may be incomplete, messy, or ambiguous. That is expected.

Your job is NOT to write the BRD.
Your job is to provide clear, structured guidance on what must be defined before a BRD can be written.

Assumptions:
- Stakeholder notes are often incomplete or inconsistent
- Anything not explicitly stated may be missing
- Ambiguity equals delivery risk

---

What You Must Do

Based ONLY on the notes provided:

1. Infer the likely purpose of the initiative
   - Clearly state assumptions you are making

2. Identify the key areas that must be defined before writing a BRD
   - Scope
   - Users / roles
   - Success criteria
   - Constraints
   - Dependencies
   - Risks

3. List what is missing or unclear
   - Be concrete and specific
   - Group related gaps together

4. Provide a list of questions to take back to stakeholders
   - Each question should resolve a real risk or ambiguity
   - Questions must be specific and actionable

5. Suggest a BRD structure
   - List recommended sections
   - Explain what each section should clarify
   - Do NOT write the BRD content

---

Required Output Structure (MANDATORY)

1. Interpreted Initiative Overview
2. Key Areas That Must Be Defined
3. Missing or Unclear Information
4. Questions to Clarify with Stakeholders
5. Suggested BRD Structure

Tone:
- Clear
- Practical
- Professional
- No assumptions without stating them
- Focused on enabling the next step
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
      model: "gpt-4o",
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
