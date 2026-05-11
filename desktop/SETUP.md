# Desktop release setup — Marvex Studio

You already paid for Apple Developer. This guide is the **15-minute, one-time setup** that turns that $99/yr into shipped, signed macOS binaries on every git tag — plus unsigned Windows + Linux binaries, also published to GitHub Releases automatically.

Total **new** spend: **£0**.

---

## What ships out of the box

Once you complete this guide and push a tag like `v0.1.0`:

| Platform | Output | Signing status | Cost |
|---|---|---|---|
| macOS Apple Silicon | `Marvex-Studio-arm64.dmg` | ✅ Signed + Notarised by Apple | $0 (your existing Apple Dev) |
| macOS Intel | `Marvex-Studio-x64.dmg` | ✅ Signed + Notarised by Apple | $0 |
| Windows x64 | `Marvex-Studio-Setup-x64.exe` | ❌ Unsigned (SmartScreen warning first launch) | $0 |
| Windows ARM64 | `Marvex-Studio-Setup-arm64.exe` | ❌ Unsigned | $0 |
| Windows portable | `Marvex-Studio-Portable-x64.exe` | ❌ Unsigned | $0 |
| Linux AppImage | `Marvex-Studio-x86_64.AppImage` | n/a (Linux doesn't expect signing) | $0 |
| Linux .deb | `Marvex-Studio-amd64.deb` | n/a | $0 |
| Linux .rpm | `Marvex-Studio-x86_64.rpm` | n/a | $0 |

Auto-update is enabled — installed apps will fetch every future release automatically from your GitHub Releases.

---

## Step 1 — Generate the Apple signing materials (~10 min, one-time)

You need access to **any Mac** (yours, a friend's, a Mac mini in Cloud, or 30 mins on MacInCloud / Scaleway Apple Silicon for ~$1 if you don't own one).

1. **Open Keychain Access** on the Mac.
2. **Certificate Assistant → Request a Certificate from a Certificate Authority**.
   - Email: your Apple ID email
   - Common name: `Marvex Developer ID`
   - Saved to disk → tick "Let me specify key pair information"
   - Save the `.certSigningRequest` file somewhere you can find it.
3. Go to **[developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates)**.
4. Click **+** → **Developer ID Application** → upload the `.certSigningRequest` from step 2 → download the resulting `.cer` file.
5. **Double-click the `.cer`** to add it to Keychain Access. It appears under "My Certificates" as "Developer ID Application: Your Name (TEAM_ID)".
6. **Expand the certificate** in Keychain → right-click the **private key** beneath it → **Export** → save as `developer-id.p12` → set a password (write it down — this becomes `MAC_CERTS_PASSWORD`).
7. **Base64-encode** the `.p12` (this becomes `MAC_CERTS`):
   ```bash
   base64 -i developer-id.p12 | pbcopy   # copies to clipboard on Mac
   ```
   Or save to a file: `base64 -i developer-id.p12 -o developer-id.p12.b64`.

8. **Generate an App-Specific Password** (Apple requires this for notarisation):
   - Sign in at [appleid.apple.com](https://appleid.apple.com)
   - **Sign-In and Security → App-Specific Passwords → +**
   - Label it `Marvex Notarisation`, copy the 19-char password (looks like `abcd-efgh-ijkl-mnop`).

9. **Find your Team ID**:
   - [developer.apple.com/account](https://developer.apple.com/account) → **Membership** → copy the 10-char Team ID.

---

## Step 2 — Add 5 secrets to GitHub (~3 min)

Go to **your GitHub repo → Settings → Secrets and variables → Actions → New repository secret**, and add these five:

| Secret name | Value |
|---|---|
| `APPLE_ID` | Your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | The 19-char password from Step 1.8 |
| `APPLE_TEAM_ID` | The 10-char team ID from Step 1.9 |
| `MAC_CERTS` | The base64 string from Step 1.7 (entire blob, no quotes) |
| `MAC_CERTS_PASSWORD` | The password you set in Step 1.6 |

> Leave `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` **empty for now**. The workflow auto-detects their absence and ships Windows unsigned. When you eventually want to pay for a Windows cert (~£200/yr Certum Open Source or ~$199/yr SSL.com EV), add those two and the next CI run will sign Windows automatically — no workflow edit needed.

---

## Step 3 — Cut your first release (~1 min)

```bash
cd /path/to/your/marvex/clone
git tag v0.1.0
git push origin v0.1.0
```

That's it. GitHub Actions will:
1. Spin up 3 runners (macOS, Windows, Linux) in parallel
2. Build the renderer (React frontend → static bundle)
3. Run electron-builder on each OS
4. Sign + notarise the Mac binaries automatically (Apple's notary server takes ~3-5 min)
5. Publish all artefacts to **[github.com/YOUR-REPO/releases/tag/v0.1.0](https://github.com)** with auto-generated release notes
6. Update `latest-mac.yml` / `latest.yml` / `latest-linux.yml` so installed apps' auto-updater finds the new version

Total runtime: ~12-18 minutes.

---

## Step 4 — Verify the user-facing download links

The `/download` page in Marvex links straight at:
```
https://github.com/YOUR-REPO/releases/latest/download/Marvex-Studio-arm64.dmg
```

GitHub serves these from `releases/latest`, which automatically points at the most recent **non-prerelease** tag. So tagging `v0.1.0-beta` won't break the public download links — handy for soft launches with a handful of testers.

Double-check the `RELEASE_BASE` constant in `/app/frontend/src/pages/Download.jsx` matches your actual GitHub repo path before going live.

---

## Step 5 — Test the auto-updater (optional but recommended)

1. Tag and release `v0.1.0`.
2. Download the .dmg, install, launch Marvex.
3. Tag and release `v0.1.1` with a trivial change.
4. Within ~30 minutes the installed v0.1.0 should pop a "Marvex Studio update available" banner.
5. Click **Restart and install** → the app relaunches as v0.1.1.

If this doesn't work, check the autoupdater logs (in `~/Library/Logs/Marvex Studio/main.log` on Mac, `%APPDATA%/Marvex Studio/logs/main.log` on Windows) — the most common issue is `latest-mac.yml` being missing from the GitHub release, which usually means the workflow's `--publish always` flag didn't fire because the trigger wasn't a tag push.

---

## When to spend money later

| Decision | Trigger | Cost |
|---|---|---|
| Buy a Windows EV cert | When >5 sales/month are blocked by SmartScreen warnings | ~$200-400/yr |
| Submit to Mac App Store | If you want discoverability via App Store search | Free signup, 30% rev share, 1-6 week review |
| Mac on dedicated CI runner | If GH Actions macOS minutes run out (rare for indie scale) | $30-50/month elsewhere |
| Apple Notary acceleration | Never — Apple's notary is already free + fast | $0 |

---

## File map

These files were all generated for you and live in the repo:

```
/app/desktop/
├── electron-builder.yml         # cross-platform packaging config
├── package.json                 # electron + electron-builder deps
├── src/
│   ├── main.js                  # Electron entry point
│   └── preload.js               # secure bridge to renderer
├── scripts/
│   └── build-renderer.sh        # builds the React bundle into ./renderer/
└── build/                       # icons + entitlements (THIS IS WHAT WAS MISSING)
    ├── source.jpeg              # 1024×1024 brand mark (input)
    ├── generate_app_icons.py    # idempotent icon builder
    ├── icon.png                 # macOS + Linux app icon
    ├── icon.ico                 # Windows app icon (7 resolutions)
    ├── icon.icns                # macOS legacy icon (8 resolutions)
    ├── file-icon-mmap.{png,ico,icns}    # .mmap file association icons
    ├── file-icon-mmlib.{png,ico,icns}   # .mmlib file association icons
    └── entitlements.mac.plist   # hardened-runtime entitlements

/app/.github/workflows/
└── desktop-release.yml          # the CI that does all the work
```

---

## Troubleshooting

**Q: GitHub Actions failed on macos-latest with "errSecInternalComponent"**
A: Your `MAC_CERTS_PASSWORD` doesn't match the `.p12` you uploaded. Re-do Step 1.6 — export the cert again with a new password and update both secrets.

**Q: Notarisation hangs >15 min**
A: Apple's notary occasionally lags. Check status manually:
```bash
xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID"
```

**Q: The .dmg installs but the app crashes on launch ("damaged, move to trash")**
A: Signed but not notarised, or notarisation failed silently. Check the latest GitHub Actions log for `notarytool` output. Common cause: missing `com.apple.security.cs.allow-unsigned-executable-memory` in entitlements — but ours already has it.

**Q: Windows SmartScreen still warns after 1000+ downloads**
A: That's about the threshold; some installs only count if a user clicks "Run anyway". To accelerate, ask your fam67 testers to download + install + open the app, which generates the reputation signals Microsoft tracks. Or buy an EV cert (instant trust).

---

## Final sanity checklist before tagging v0.1.0

- [ ] All 5 Apple secrets added to GitHub
- [ ] `MAC_CERTS` is the **entire** base64 blob with no truncation
- [ ] Your Apple Developer account is **active** (i.e. annual fee paid + Apple Developer Program enrollment complete — verify at [developer.apple.com/account](https://developer.apple.com/account))
- [ ] Your GitHub repo has Actions enabled (Settings → Actions → General → "Allow all actions")
- [ ] You're tagging from `main` (not a side branch)

When in doubt, run a **manual dispatch** of the workflow first (Actions tab → desktop-release → Run workflow) — it'll build without publishing, so you can debug any cert issues without burning a real release tag.
