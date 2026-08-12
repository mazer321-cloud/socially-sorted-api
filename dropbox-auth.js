export default async function handler(req, res) {
  const { code, error, error_description } = req.query;

  if (error) {
    return res
      .status(400)
      .send(`Dropbox authorisation failed: ${error_description || error}`);
  }

  if (!code) {
    return res.status(400).send("No Dropbox authorisation code was supplied.");
  }

  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;

  if (!appKey || !appSecret) {
    return res
      .status(500)
      .send("Dropbox environment variables are missing in Vercel.");
  }

  const redirectUri =
    "https://socially-sorted-api.vercel.app/api/dropbox-callback";

  try {
    const tokenResponse = await fetch(
      "https://api.dropboxapi.com/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          client_id: appKey,
          client_secret: appSecret,
          redirect_uri: redirectUri
        })
      }
    );

    const data = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error(data);
      return res
        .status(500)
        .send("Dropbox token exchange failed. Check the Vercel logs.");
    }

    if (!data.refresh_token) {
      return res.status(500).send(
        "Dropbox connected, but no refresh token was returned. Re-authorise using /api/dropbox-auth."
      );
    }

    const safeToken = String(data.refresh_token)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    res.setHeader("Content-Type", "text/html; charset=utf-8");

    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dropbox connected</title>
<style>
body{
  margin:0;
  min-height:100vh;
  display:grid;
  place-items:center;
  font-family:Arial,sans-serif;
  background:#f1e9df;
  color:#171313;
}
.card{
  width:min(620px,calc(100% - 36px));
  background:#fff;
  border-radius:26px;
  padding:30px;
  box-shadow:0 24px 70px rgba(0,0,0,.12);
}
h1{margin-top:0}
code{
  display:block;
  margin:18px 0;
  padding:16px;
  border-radius:14px;
  background:#f7f3ef;
  overflow-wrap:anywhere;
  user-select:all;
}
strong{color:#c96148}
</style>
</head>
<body>
  <div class="card">
    <h1>Dropbox connected ♡</h1>
    <p>Your refresh token is below.</p>
    <p><strong>Do not send this token to anyone.</strong></p>
    <p>Copy it and add it to Vercel as an environment variable named:</p>
    <code>DROPBOX_REFRESH_TOKEN</code>
    <p>Your token:</p>
    <code>${safeToken}</code>
    <p>Once it is saved in Vercel, you can close this page.</p>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Unexpected Dropbox connection error.");
  }
}
