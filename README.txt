# Dropbox OAuth connection

Upload the `api` folder to the root of the `socially-sorted-api` GitHub repository.

Your repo should look like:

socially-sorted-api/
  api/
    dropbox-auth.js
    dropbox-callback.js

Then redeploy on Vercel.

Before testing, add this exact redirect URI in the Dropbox developer app:

https://socially-sorted-api.vercel.app/api/dropbox-callback

Then visit:

https://socially-sorted-api.vercel.app/api/dropbox-auth

Approve Dropbox access.

The callback page will display a Dropbox refresh token. Do not send it to anyone.
Add it directly to Vercel as:

DROPBOX_REFRESH_TOKEN

Set it for Production and Preview, with Sensitive enabled.
