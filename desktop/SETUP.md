# Desktop App Launch Checklist

This is the **one-page playbook** you follow to ship Mind-Mapper as a real
downloadable desktop app for Windows / macOS / Linux. Most steps are
one-time only.

> **Time to first download link**: ~90 minutes spread over a day, mostly
> waiting on Apple to issue your certificate.

---

## 🚀 Ship-unsigned-first path (no Apple cert needed today)

The CI workflow is built so **steps 1-3 + 6 + 7 alone produce a working
release** — Mac signing/notarisation is OPTIONAL.  When the four Apple
secrets (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`,
`MAC_CERTS` + `MAC_CERTS_PASSWORD`) are missing, the macOS build runs
unsigned, and Windows + Linux ship as normal.

**What unsigned means for users on macOS:**
- First launch shows "Mind-Mapper is from an unidentified developer"
- Workaround = **right-click the .app → Open → Open**.  Once approved,
  every future launch is silent — Gatekeeper remembers the approval.
- This is fine for early adopters / testers / private beta.  Anyone
  comfortable installing a side-loaded app already knows this dance.

**When you're ready to sign**, do steps 4-5 (cert + secrets) and tag a
new version — the next CI run automatically signs and notarises.  No
workflow edit needed.

---

## 1. Create the GitHub repo (5 min · one-time)

You'll publish releases here — installers, auto-updates, version history.

1. Go to **https://github.com/new**
2. **Owner**: your GitHub username (or an org if you have one)
3. **Repository name**: `mind-mapper`
4. **Visibility**: **Public** (makes downloads frictionless — no token to
   share around) OR **Private** (releases can still be public, but you
   need to grant access to anyone who pushes commits).
5. **Do NOT** tick "Initialize with README" — Emergent will push existing
   code into a fresh repo.
6. Click **Create repository**

GitHub will show you a URL like:
```
https://github.com/your-username/mind-mapper.git
```
**Copy that.** You'll need it in step 2.

---

## 2. Push the codebase to your new repo (one-time)

In the Emergent project chat, click the **"Save to GitHub"** button (usually
top-right of the chat panel) and follow the prompts. It connects your
GitHub account to Emergent and pushes the whole project tree, preserving
the existing `.git` history.

If you don't see the button, ask in chat: *"How do I push this project to my
GitHub repo?"* — Emergent's support agent has the current UI path.

After it's done, refresh `https://github.com/your-username/mind-mapper` —
you should see all the folders (`backend`, `frontend`, `desktop`, etc.)
plus the `.github/workflows/desktop-release.yml` file.

---

## 3. Wire the frontend to your repo (1 min)

Add this line to `/app/frontend/.env` (in **Emergent**, then re-save in the
**production secrets panel** so the live `mind-mapper.com` picks it up):

```
REACT_APP_DESKTOP_GITHUB_REPO=your-username/mind-mapper
```

After the next deploy, the `/download` page on `mind-mapper.com` will
auto-link to the latest release on your repo.

---

## 4. Apple Developer signing setup (~30 min · one-time)

Only macOS users will be affected if you skip this — they'll see a
"can't be opened because it is from an unidentified developer" warning.
Worth doing properly.

### 4a. Generate the certificate

1. Open **Keychain Access** on your Mac
2. Menu: **Keychain Access → Certificate Assistant → Request a Certificate
   from a Certificate Authority…**
3. **User Email**: your Apple ID email
4. **Common Name**: `Mind-Mapper Code Signing`
5. **Saved to disk** → click Continue → save the `.certSigningRequest` file
   to your Desktop
6. Go to **https://developer.apple.com/account/resources/certificates**
7. Click the **+** button → choose **"Developer ID Application"** → Continue
8. Upload the `.certSigningRequest` file → Continue → Download the `.cer`
9. **Double-click** the downloaded `.cer` to install it in Keychain

### 4b. Export it as a .p12 for GitHub Actions

1. In Keychain Access → **My Certificates** tab
2. Find **"Developer ID Application: Your Name (TEAM_ID)"**
3. **Right-click → Export…** → save as `MindMapperCert.p12`
4. **Set a strong password** — write it down, you'll paste it into GitHub
   in step 5.

### 4c. Convert the .p12 to base64 (so it can live in a GitHub secret)

Open Terminal:
```bash
base64 -i ~/Desktop/MindMapperCert.p12 | pbcopy
```
The base64 string is now on your clipboard.

### 4d. Generate an app-specific password

This is **NOT** your Apple ID password — Apple wants a separate one for
notarising automation.

1. Go to **https://appleid.apple.com**
2. **Sign-In and Security → App-Specific Passwords**
3. **Generate** → label it `mind-mapper-notarize` → copy the 19-character
   password (looks like `xxxx-xxxx-xxxx-xxxx`)

### 4e. Find your Team ID

1. Go to **https://developer.apple.com/account**
2. **Membership Details** → copy the 10-character **Team ID** (e.g. `A1B2C3D4E5`)

---

## 5. Add GitHub repo secrets (5 min · one-time)

1. Go to your repo: **Settings → Secrets and variables → Actions**
2. Click **"New repository secret"** for each row below:

| Name | Value |
|---|---|
| `APPLE_ID` | your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | the 19-char password from step 4d |
| `APPLE_TEAM_ID` | the 10-char team ID from step 4e |
| `MAC_CERTS` | the base64 string from step 4c (one long line) |
| `MAC_CERTS_PASSWORD` | the password you set when exporting the .p12 |

Total: 5 secrets. None of them are visible to anyone except your GitHub
Actions runs.

---

## 6. Run a dry-run build (free · 10 min · DO THIS FIRST)

**Always do a dry-run before cutting a real release** — that way if something
goes wrong (missing secret, install error, etc.), you find out without burning
a `v0.1.0` tag on a broken build.

1. On GitHub: **Actions tab → desktop-release → Run workflow → Run workflow**
2. Wait ~10 min while three runners (mac/win/linux) build in parallel
3. If any runner goes red 🔴, click into it → expand the failed step →
   read the last 30-50 lines of log. The most common failures:
   - **`yarn install` fails** → out-of-date lockfile. Re-run `yarn install`
     locally on the failing platform's lockfile, commit, push, retry.
   - **`electron-builder` says "missing identity"** on Mac → the unsigned
     fallback isn't working. Confirm `MAC_CERTS` secret is **not set at all**
     (delete it if it exists empty) and retry.
   - **`Cannot find module '...'`** → a dependency was added without a lockfile
     update. Run `yarn install` locally, commit `yarn.lock`, push, retry.
4. When all three runners are green ✅, click into the run → scroll to
   **Artifacts** at the bottom. Download each artifact zip → unzip → install
   → open. Smoke-test that the app launches and the UI loads.

If the macOS build opens **without** a Gatekeeper warning, your signing
+ notarisation worked. 🎉  If it shows "unidentified developer", you're on
the **unsigned-first** path — that's expected until you finish step 4.

---

## 7. Cut your first real release (5 min)

When the dry-run is happy you have **two ways** to cut `v0.1.0` — pick whichever
is easier for you. Both produce identical results.

### Option A — From GitHub Web UI (zero terminal, easiest)

1. Go to your repo → **Releases** (right sidebar of the repo home page) → **"Draft a new release"**
2. Click **"Choose a tag"** → type `v0.1.0` → click **"Create new tag: v0.1.0 on publish"**
3. **Release title**: `v0.1.0 — first public build`
4. **Description**: e.g. *"First downloadable Mind-Mapper desktop build. Unsigned macOS DMG (right-click → Open on first launch). Windows + Linux work as normal."*
5. Click **Publish release**

Publishing the release **creates the tag** which fires the `desktop-release`
workflow. Watch it in the **Actions** tab — three runners (mac/win/linux) take ~10
min in parallel. When they're green, the installers appear back in the
**Releases** view, attached to your `v0.1.0` release.

### Option B — From a local git clone (if you have one)

```bash
# from your local clone
git tag v0.1.0
git push origin v0.1.0
```

### After it publishes

~10 min later, the download links on `https://mind-mapper.com/download` go live
automatically — no further deploy needed (the page reads the GitHub `latest`
redirect).

You can edit the release notes anytime at
`https://github.com/your-username/mind-mapper/releases`.

---

## 8. Test the auto-updater (5 min)

`electron-updater` is already wired in `desktop/src/main.js`. Once your v0.1.0
is live:

1. Install v0.1.0 on your Mac
2. Bump `desktop/package.json` to `0.1.1`, commit, tag, push
3. Wait for the new release to publish
4. Quit and re-launch the installed app — it'll detect the new version,
   download silently, and prompt you to relaunch

If that works, you have a fully self-updating product. 🪄

---

## Future: Windows code-signing (optional · ~$200/year)

Windows users currently see a SmartScreen "Unknown publisher" warning the
first time they run the installer. Reputation builds with downloads (after
~3000 installs SmartScreen usually backs off automatically). You can pay
for an EV certificate to skip the wait — the providers worth comparing:

- **DigiCert** — premium, ~$500/yr, gold-standard trust
- **Sectigo / Comodo** — ~$200/yr, fine for indie apps
- **SSL.com** — ~$250/yr, excellent docs

Add the cert as a `.pfx` base64 secret called `WIN_CERTS` plus
`WIN_CERTS_PASSWORD` and uncomment the relevant block in
`desktop/electron-builder.yml`.

---

## Cost summary

| Item | One-off | Recurring |
|---|---|---|
| GitHub account | $0 | $0 (public repo) |
| Apple Developer Program | – | $99 / year (you already have this) |
| Domain (already paid) | – | – |
| Spaceship hosting (already paid) | – | – |
| Windows code-signing cert | – | $0–500 / year (skip until launch traction) |
| GitHub Actions minutes | – | Free for public repos · 2000 min/mo for private |

**Total to go live**: $0 today + the $99 Apple thing you've already paid.

---

## Questions / stuck?

The `desktop/README.md` file has more detail. If a step doesn't match the
GitHub or Apple UI exactly (they change docs around), search for the same
phrase in their docs — the underlying procedure is stable.
