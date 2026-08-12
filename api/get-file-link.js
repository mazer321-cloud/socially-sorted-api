import {
  cors,
  handleOptions,
  requirePortalUser,
  getDropboxAccessToken,
  assertClientPath
} from "./_shared.js";

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const profile = await requirePortalUser(req);
    const { filePath } = req.body || {};

    if (!filePath) {
      return res.status(400).json({ error: "filePath is required" });
    }

    assertClientPath(profile, filePath);

    const accessToken = await getDropboxAccessToken();

    const response = await fetch(
      "https://api.dropboxapi.com/2/files/get_temporary_link",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ path: filePath })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.link) {
      console.error("Dropbox file link error:", data);
      return res.status(502).json({ error: "Could not create file preview link" });
    }

    return res.status(200).json({ url: data.link });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: error.message || "Not authorised" });
  }
}
