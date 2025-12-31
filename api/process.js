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

  // 🔥 KEY CHECK
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is MISSING in this environment"
    });
  }

  return res.status(200).json({
    ok: true,
    message: "OPENAI_API_KEY is present"
  });
}
