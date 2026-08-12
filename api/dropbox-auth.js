export default async function handler(req, res) {
  const appKey = process.env.DROPBOX_APP_KEY;

  if (!appKey) {
    return res.status(500).send("DROPBOX_APP_KEY is missing in Vercel.");
  }

  const redirectUri =
    "https://socially-sorted-api.vercel.app/api/dropbox-callback";

  const params = new URLSearchParams({
    client_id: appKey,
    response_type: "code",
    token_access_type: "offline",
    redirect_uri: redirectUri
  });

  return res.redirect(
    302,
    `https://www.dropbox.com/oauth2/authorize?${params.toString()}`
  );
}
