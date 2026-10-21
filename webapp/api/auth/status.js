import { fail, getSession, hasGoogleConfig, json, methodNotAllowed } from "../../lib/server.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const session = await getSession(req);
    return json(res, 200, {
      connected: Boolean(session),
      configured: hasGoogleConfig(),
      provider: session?.row.provider || null,
      email: session?.row.user_email || null
    });
  } catch (error) { return fail(res, error); }
}
