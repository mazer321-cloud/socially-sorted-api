import {
  cors,
  handleOptions,
  requirePortalUser,
  getDropboxAccessToken,
  safeDropboxName
} from "./_shared.js";

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requirePortalUser(req, { adminOnly: true });

    const { clientId, fileName } = req.body || {};
    if (!clientId || !fileName) {
      return res.status(400).json({ error: "clientId and fileName are required" });
    }

    const cleanName = `${Date.now()}-${safeDropboxName(fileName)}`;
    const path = `/clients/${safeDropboxName(clientId)}/${cleanName}`;

    const accessToken = await getDropboxAccessToken();

    const response = await fetch(
      "https://api.dropboxapi.com/2/files/get_temporary_upload_link",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          commit_info: {
            path,
            mode: "add",
            autorename: true,
            mute: false,
            strict_conflict: false
          },
          duration: 14400
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.link) {
      console.error("Dropbox upload link error:", data);
      return res.status(502).json({ error: "Could not create Dropbox upload link" });
    }

    return res.status(200).json({
      uploadUrl: data.link,
      filePath: path
    });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: error.message || "Not authorised" });
  }
}
