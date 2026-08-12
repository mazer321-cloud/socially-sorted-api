const ALLOWED_ORIGINS = new Set([
  "https://www.sociallysortedbyamy.co.uk",
  "https://sociallysortedbyamy.co.uk"
]);

export function cors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    cors(req, res);
    res.status(204).end();
    return true;
  }
  return false;
}

export function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

async function getFirebaseProfile(idToken) {
  const projectId = "sociallysortedportal";
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`;

  const identityRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyBkfNZSbcMmUf47rYpL4lMuLGESqbPjgJY`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );

  if (!identityRes.ok) throw new Error("Invalid Firebase session");
  const identity = await identityRes.json();
  const user = identity.users?.[0];
  if (!user?.localId) throw new Error("Firebase user not found");

  const profileRes = await fetch(`${url}/${encodeURIComponent(user.localId)}`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });

  if (!profileRes.ok) throw new Error("Portal profile not found");
  const raw = await profileRes.json();

  const fields = raw.fields || {};
  const getString = (name) => fields[name]?.stringValue || "";

  return {
    uid: user.localId,
    role: getString("role"),
    clientId: getString("clientId"),
    name: getString("name"),
    email: getString("email")
  };
}

export async function requirePortalUser(req, { adminOnly = false } = {}) {
  const idToken = getBearerToken(req);
  if (!idToken) throw new Error("Missing Firebase session");

  const profile = await getFirebaseProfile(idToken);

  if (adminOnly && profile.role !== "admin") {
    throw new Error("Admin access required");
  }

  if (!["admin", "client"].includes(profile.role)) {
    throw new Error("Portal access denied");
  }

  return profile;
}

export async function getDropboxAccessToken() {
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;

  if (!appKey || !appSecret || !refreshToken) {
    throw new Error("Dropbox environment variables are incomplete");
  }

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret
    })
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    console.error("Dropbox token error:", data);
    throw new Error("Could not refresh Dropbox access token");
  }

  return data.access_token;
}

export function safeDropboxName(value = "") {
  return String(value)
    .trim()
    .replace(/[\\/]/g, "-")
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120) || "file";
}

export function assertClientPath(profile, path) {
  if (profile.role === "admin") return;
  const allowedPrefix = `/clients/${profile.clientId}/`;
  if (!path.startsWith(allowedPrefix)) {
    throw new Error("You do not have access to this file");
  }
}
