import {
  cors,
  handleOptions,
  requirePortalUser,
  getBearerToken,
  getDropboxAccessToken,
  assertClientPath
} from "./_shared.js";

const PROJECT_ID = "sociallysortedportal";

function fieldString(fields, name) {
  return fields?.[name]?.stringValue || "";
}

function recordFilePaths(fields) {
  const paths = [];

  const legacy = fieldString(fields, "filePath");
  if (legacy) paths.push(legacy);

  const values = fields?.mediaFiles?.arrayValue?.values || [];
  for (const value of values) {
    const path = value?.mapValue?.fields?.filePath?.stringValue || "";
    if (path) paths.push(path);
  }

  return [...new Set(paths)];
}

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const profile = await requirePortalUser(req);
    const idToken = getBearerToken(req);
    const { itemId } = req.body || {};
    const incoming = req.body?.filePaths || (req.body?.filePath ? [req.body.filePath] : []);
    const filePaths = incoming.filter(Boolean);

    if (!itemId || !filePaths.length) {
      return res.status(400).json({ error: "itemId and filePaths are required" });
    }

    for (const path of filePaths) {
      assertClientPath(profile, path);
    }

    const recordResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/content/${encodeURIComponent(itemId)}`,
      {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      }
    );

    if (!recordResponse.ok) {
      return res.status(403).json({ error: "Could not verify the approval record" });
    }

    const record = await recordResponse.json();
    const fields = record.fields || {};
    const recordClientId = fieldString(fields, "clientId");
    const status = fieldString(fields, "status");
    const allowedPaths = recordFilePaths(fields);

    if (status !== "approved") {
      return res.status(403).json({ error: "Media can only be removed after approval" });
    }

    if (profile.role !== "admin" && recordClientId !== profile.clientId) {
      return res.status(403).json({ error: "You do not have access to this content" });
    }

    if (filePaths.some(path => !allowedPaths.includes(path))) {
      return res.status(403).json({ error: "One or more files do not match this approval record" });
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
        console.error("Dropbox approved-file delete error:", data);
        return res.status(502).json({ error: "Could not remove all approved media from Dropbox" });
      }
    }

    return res.status(200).json({ ok: true, deleted: filePaths.length });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: error.message || "Not authorised" });
  }
}
