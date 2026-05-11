# Desktop release setup — Marvex Studio

**Goal**: ship Windows / macOS / Linux binaries TODAY, zero new spend. Apple signing comes later when you have Mac access.

---

## Phase 1 — Ship today (5 minutes, $0)

Everything you need is already in the repo:
- ✅ Icons (`desktop/build/icon.{png,ico,icns}`)
- ✅ File-type icons (`desktop/build/file-icon-*.{png,ico,icns}`)
- ✅ Entitlements file (`desktop/build/entitlements.mac.plist`)
- ✅ electron-builder config (`desktop/electron-builder.yml`)
- ✅ CI workflow that auto-falls-back to unsigned when secrets are missing (`.github/workflows/desktop-release.yml`)

You just need to cut a release.

### Step 1 — Verify your GitHub repo path

Open `/app/frontend/src/pages/Download.jsx` and confirm the `RELEASE_BASE` constant points at YOUR GitHub repo:

```js
const RELEASE_BASE = "https://github.com/YOUR-ORG/YOUR-REPO/releases/latest/download";
```

If it's pointing at a placeholder, fix it now or `/download` will 404 after release.

### Step 2 — Tag and push

```bash
cd /path/to/your/local/clone
git tag v0.1.0
git push origin v0.1.0
```

That's it. GitHub Actions will:
1. Spin up 3 runners (macOS, Windows, Linux) in parallel
2. Build the renderer + Electron app on each
3. Detect that `MAC_CERTS` / `WIN_CSC_LINK` secrets are MISSING → fall back to unsigned binaries on all three OSes
4. Publish the .dmg / .exe / .AppImage / .deb / .rpm to `github.com/YOUR-REPO/releases/tag/v0.1.0`
5. Update `latest-mac.yml` / `latest.yml` / `latest-linux.yml` so the auto-updater can find future versions

Total runtime: ~12-18 minutes. No babysitting needed.

### Step 3 — Tell users

`/download` already shows the right "first-time install" instructions for each OS:
- **macOS**: amber notice → right-click → Open the first time
- **Windows**: amber notice → SmartScreen → More info → Run anyway
- **Linux**: no warnings, but `chmod +x` for AppImage

Email your fam67 testers, post on Reddit/HN/PH, you're shipped.

---

## Phase 2 — Add Apple signing (later, when convenient)

Triggers for doing this:
- You see Mac install drop-off in PostHog (compare `download_clicked{platform=mac}` to actual usage)
- A reviewer complains about the Gatekeeper warning in writing
- You finally get access to a Mac for 30 minutes

You have three options to generate the cert. Cheapest first:

### Option A — Rent a Mac for 30 minutes (~£0-3)
- **MacStadium Sandbox**: 24-hour free trial → [macstadium.com/sandbox](https://www.macstadium.com)
- **MacInCloud Pay-As-You-Go**: $1/hr → [macincloud.com/pay-as-you-go](https://www.macincloud.com)
- **Scaleway Apple Silicon M1**: €0.11/hr (24h minimum) → [scaleway.com/en/apple-silicon](https://www.scaleway.com/en/apple-silicon/)

Follow Apple's standard Keychain flow:
1. Open **Keychain Access** → Certificate Assistant → Request a Certificate from a Certificate Authority → save `.certSigningRequest`
2. **[developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates)** → `+` → Developer ID Application → upload the CSR → download the `.cer`
3. Double-click `.cer` to add to Keychain → expand → right-click the **private key** → Export → save as `developer-id.p12` with a password
4. Base64-encode: `base64 -i developer-id.p12 | pbcopy`
5. Generate an App-Specific Password at [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords
6. Note your 10-char Team ID from [developer.apple.com/account](https://developer.apple.com/account) → Membership

### Option B — Pure-Linux openssl path (free, slightly fiddly)

If you're allergic to renting a Mac:
```bash
# generate a private key + CSR locally
openssl genrsa -out marvex-dev-id.key 2048
openssl req -new -key marvex-dev-id.key -out marvex-dev-id.csr \
  -subj "/emailAddress=YOUR_APPLE_EMAIL/CN=Marvex Developer ID/C=GB"
```
Then upload `marvex-dev-id.csr` to the same Apple Developer portal page. Apple returns a `.cer`. Convert to `.p12` with openssl:
```bash
openssl x509 -inform DER -in developer_id_application.cer -out developer_id.pem
openssl pkcs12 -export -inkey marvex-dev-id.key -in developer_id.pem \
  -out developer-id.p12 -password pass:YOUR_CHOSEN_PASSWORD
base64 developer-id.p12 > developer-id.p12.b64
```
Caveat: 1-2% chance Apple's notary rejects a non-Keychain-generated cert later. If that happens, redo via Option A.

### Step 7 — Add 5 GitHub secrets

**Repo → Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|---|---|
| `APPLE_ID` | Your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | 19-char password from `appleid.apple.com` |
| `APPLE_TEAM_ID` | 10-char team ID from `developer.apple.com/account` |
| `MAC_CERTS` | Entire base64 blob from above |
| `MAC_CERTS_PASSWORD` | The password you set on the .p12 |

> Leave `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` empty — Windows stays unsigned for now. Add them later when you hit ~$500 MRR and a £200/yr cert is worth it.

### Step 8 — Tag v0.2.0

```bash
git tag v0.2.0 && git push origin v0.2.0
```

GH Actions auto-detects the new secrets and signs + notarises the Mac builds on this run. Your `/download` page should also flip the Mac badge from amber "unsigned" to emerald "signed & notarised" (you can do that swap with one search-replace in `Download.jsx` when you're ready).

---

## When does signing actually matter?

| Cohort | Cares about signing? |
|---|---|
| Fam67 testers | No — they'll trust the warning |
| Indie hackers / r/PKMS power users | No — used to unsigned tools |
| Mac users buying $200 lifetime | **Yes** — moderate friction risk |
| Corporate buyers / IT admins | **Hard yes** — usually a deal-breaker without it |
| Students / casual signups | No — will follow the right-click instructions |

For v0.1 launch, unsigned is the right call. Get the binaries out, learn from real download data, add signing when the data tells you to.

---

## Troubleshooting

**Q: GitHub Actions failed with "Resource not accessible by integration"**
A: Settings → Actions → General → Workflow permissions → "Read and write permissions" + tick "Allow GitHub Actions to create and approve pull requests"

**Q: My .exe / .dmg / .AppImage didn't appear on the Releases page**
A: Check the workflow log. The `Upload dry-run artifacts` step only runs on manual dispatches — for real tag pushes, the artifacts upload via electron-builder's `--publish always` directly to the GitHub release.

**Q: Auto-update doesn't trigger**
A: Common cause: `latest-mac.yml` (or `latest.yml`) missing from the release. This means electron-builder didn't fire its publish step. Usually a permissions issue — re-check workflow permissions above.

---

## File map

```
/app/desktop/
├── electron-builder.yml         # cross-platform packaging config
├── package.json                 # electron + electron-builder deps
├── src/
│   ├── main.js                  # Electron entry point
│   └── preload.js               # secure bridge to renderer
├── scripts/
│   └── build-renderer.sh        # builds the React bundle into ./renderer/
└── build/
    ├── source.jpeg              # 1024×1024 brand mark (input)
    ├── generate_app_icons.py    # idempotent icon builder
    ├── icon.png / icon.ico / icon.icns
    ├── file-icon-mmap.{png,ico,icns}
    ├── file-icon-mmlib.{png,ico,icns}
    └── entitlements.mac.plist

/app/.github/workflows/
└── desktop-release.yml          # CI — handles signed AND unsigned paths
```
