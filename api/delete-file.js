import {
  cors,
  handleOptions,
  requirePortalUser,
  getDropboxAccessToken
} from "./_shared.js";

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requirePortalUser(req, { adminOnly: true });

    const incoming = req.body?.filePaths || (req.body?.filePath ? [req.body.filePath] : []);
    const filePaths = incoming.filter(Boolean);

    if (!filePaths.length) {
      return res.status(400).json({ error: "filePaths are required" });
    }

    const accessToken = await getDropboxAccessToken();

    for (const path of filePaths) {
      const response = await fetch(
        "https://api.dropboxapi.com/2/files/delete_v2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ path })
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok && !JSON.stringify(data).includes("not_found")) {
        console.error("Dropbox delete error:", data);
        return res.status(502).json({ error: "Could not delete all Dropbox files" });
      }
    }

    return res.status(200).json({ ok: true, deleted: filePaths.length });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: error.message || "Not authorised" });
  }
}
