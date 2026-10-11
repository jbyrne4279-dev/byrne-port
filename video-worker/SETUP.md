# Video Library: storage setup (about 10 minutes)

The page at `josephbyrne.org/videos` stores videos in your own Cloudflare R2 bucket.
Files are kept byte-for-byte, so downloads are always the original quality.

## 1. Create a Cloudflare account
Sign up free at https://dash.cloudflare.com/sign-up.

## 2. Create the storage bucket
1. In the dashboard sidebar open **R2 Object Storage**. The first time, it asks you to
   add a payment card. The first 10 GB are free; after that it's about $0.015 per GB a month,
   and downloads are always free.
2. Click **Create bucket** and name it `video-library`, then click **Create bucket**.

## 3. Create the Worker (the small API)
1. Open **Workers & Pages** → **Create** → **Create Worker**.
2. Name it `video-library` and click **Deploy**.
3. Click **Edit code**, delete everything in the editor, paste the whole of
   `video-worker/worker.js` from this repo, and click **Deploy**.

## 4. Connect the bucket and set the passcode
In the Worker, open **Settings**:
1. Under **Bindings**, click **Add** → **R2 bucket**.
   Set the variable name to `VIDEOS` and pick the `video-library` bucket.
2. Under **Variables and Secrets**, click **Add** and create:
   - Type **Secret**, name `UPLOAD_PASSCODE`, value = the passcode your group will use to upload.
   - Type **Text**, name `ALLOWED_ORIGINS`, value `https://josephbyrne.org,https://www.josephbyrne.org`
3. Click **Deploy** if prompted.

## 5. Connect the page
Copy the Worker's address shown at the top, for example
`https://video-library.yourname.workers.dev`, and put it in `videos.html`:

```html
<meta name="video-api" content="https://video-library.yourname.workers.dev">
```

## Changing the passcode later
Worker → Settings → Variables and Secrets → edit `UPLOAD_PASSCODE`.
