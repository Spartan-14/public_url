# Milestone 1 — Full Explanation
## IT 4403 Individual Project — DJENKEU EDOU Livyo Kurtys

---

## Part 1: Why Deployment Was Broken

### What Azure Static Web Apps Does

When you create an Azure Static Web App and link it to a GitHub repo, Azure sets up a deployment pipeline:

```
You push code to GitHub
        ↓
GitHub Actions workflow (.yml file) runs automatically
        ↓
The workflow authenticates with Azure using a secret token
        ↓
Azure pulls your files and publishes them to a live URL
```

The secret token is the key that proves to Azure that your GitHub repo is allowed to deploy to your specific Azure app. Without a valid token, Azure rejects the deployment entirely.

### What Went Wrong

The old Azure app (`salmon-desert-0afeed21e`) no longer existed — it was either deleted or expired. But the GitHub repo still had:

- The old workflow file (`.github/workflows/azure-static-web-apps-salmon-desert-0afeed21e.yml`) pointing to a dead resource
- The old secret (`AZURE_STATIC_WEB_APPS_API_TOKEN_SALMON_DESERT_0AFEED21E`) with a token for a resource that no longer existed

Every time code was pushed, GitHub ran that workflow, sent the token to Azure, and Azure responded:

```
"No matching Static Web App was found or the api key was invalid"
```

Because there was nothing on Azure's side to match it to.

### What Changed to Fix It

| Before | After |
|--------|-------|
| Azure app `salmon-desert-0afeed21e` — deleted/gone | New Azure app `purple-water-001713d1e` — active |
| Old workflow file referencing dead resource | New workflow file Azure generated automatically |
| Invalid deployment token | Fresh valid token stored as new GitHub secret |

When the new Azure Static Web App was created, Azure automatically:
1. Added a new secret to the GitHub repo
2. Created a new workflow file (`.github/workflows/azure-static-web-apps-purple-water-001713d1e.yml`)

The old broken workflow file was then deleted to prevent conflicts.

---

## Part 2: How the Deployment Pipeline Works

Every time you run `git push`, this chain of events happens:

```
1. git push → your code reaches GitHub

2. GitHub sees the .yml workflow file in .github/workflows/
   and automatically starts a "runner" (a virtual machine)

3. The runner checks out your code, reads the secret token,
   and calls the Azure Static Web Apps Action

4. The Action zips up your files (index.html, google-book.html,
   google-books-search.html, JSON files, milestone2/ folder, etc.)
   and uploads them to Azure

5. Azure unpacks the files and serves them at:
   https://purple-water-001713d1e.6.azurestaticapps.net/
```

This is called **CI/CD** — Continuous Integration / Continuous Deployment.
You write code locally → push → live within ~2 minutes automatically.

---

## Part 3: How the Milestone 1 Website Works

### Page 1 — `index.html` (Home Page)

This is **pure static HTML**. No data loading, no API calls, no JavaScript logic (except setting the footer year).

```
Browser requests index.html
        ↓
Azure sends back the raw HTML file
        ↓
Browser reads the HTML top to bottom and renders the page
        ↓
Small <script> at the bottom sets the footer year:
document.getElementById('footer-year').textContent = new Date().getFullYear();
```

Every section (nav, header, About, Disclaimer, Lab Work, Individual Project Work, footer) is hardcoded directly in the HTML. Nothing dynamic happens.

---

### Page 2 — `google-book.html` (Single Book)

This page reads a **local JSON file** and builds the page content dynamically using jQuery.

**Sequence of events when the page loads:**

```
Step 1 — Browser loads google-book.html
         Reads the HTML structure (nav, header, empty main, footer)
         Applies embedded CSS → page is styled but main is empty

Step 2 — Browser reaches the <script> tags at the bottom
         Loads jQuery from the CDN (code.jquery.com)

Step 3 — jQuery's $(function(){...}) fires
         Meaning: "run this code once the page is fully loaded"

Step 4 — $.getJSON('google-books-book.json', function(data){...})
         jQuery sends an HTTP GET request to google-books-book.json
         Azure responds with the raw JSON text

Step 5 — jQuery automatically parses the JSON text into
         a JavaScript object called `data`

Step 6 — Code reads properties from data:
         var info = data.volumeInfo;
         var title = info.title;
         var authors = info.authors;
         var description = info.description;

Step 7 — Code builds HTML strings and injects them into the page:
         $('#book-title').text(info.title);
         $('#cover-img').attr('src', info.imageLinks.thumbnail);

Step 8 — Browser renders the new DOM elements
         The page now shows the full book details
```

**Why no loop?**
`google-books-book.json` contains exactly one book. The `volumeInfo` object is a single flat structure — one title, one array of authors, one description. There is nothing to iterate over.

**Key concept — `http://` vs `https://`:**
The cover image URLs in the JSON start with `http://`. The site is served over `https://`. Browsers block insecure `http://` images on a secure `https://` page (called a **mixed content error**). That is why the `secureUrl()` function exists:

```javascript
function secureUrl(url) {
    return url ? url.replace(/^http:\/\//i, 'https://') : '';
}
```

It upgrades every image URL from `http://` to `https://` before rendering.

---

### Page 3 — `google-books-search.html` (Search Results)

Same loading mechanism as the single book page, but the JSON file contains **an array of 10 books**, so a loop is required.

**Steps 1–5 are identical** (load page → load jQuery → fire on ready → getJSON → parse JSON).

```
Step 6 — Code reads data.items
         This is an array: [ book1, book2, book3, ... book10 ]

Step 7 — $.each(items, function(i, item) { ... })
         jQuery's loop — for EACH item in the array:
         - Read item.volumeInfo (title, authors, etc.)
         - Build an HTML card string
         - Append it to #book-grid on the page

Step 8 — After the loop all 10 cards exist in the DOM
         $('#book-grid').show() makes them visible
         $('#status-message').hide() removes the "Loading..." text
```

**What a single loop iteration looks like:**

```
item = {
  id: "abc123",
  volumeInfo: {
    title: "JavaScript: The Good Parts",
    authors: ["Douglas Crockford"],
    publisher: "O'Reilly",
    publishedDate: "2008",
    description: "...",
    imageLinks: { thumbnail: "http://..." }
  }
}

→ Produces this HTML card:
<div class="book-card">
  <div class="card-thumb"><img src="https://..." /></div>
  <div class="card-body">
    <p class="card-title">JavaScript: The Good Parts</p>
    <p class="card-authors">Douglas Crockford</p>
    <p class="card-meta">O'Reilly • 2008 • 176 pages</p>
  </div>
</div>

→ Appended to #book-grid
```

This runs 10 times, producing 10 cards.

---

## Part 4: What the Restyling Changed

Only **visual presentation** was changed — no logic was touched.

| What changed | Old value | New value | Why |
|---|---|---|---|
| Primary color (nav, headings) | `#1a3a5c` navy | `#06402B` dark green | Chosen palette |
| Active nav item | `#2e86c1` blue, white text | `#FFCE1B` gold, `#030057` indigo text | Accent contrast |
| Nav hover | `#24507a` | `#0a5c38` medium green | Consistent hover |
| Header gradient | navy → blue | dark green → bright green | Palette consistency |
| Nav link text | `#cce0f5` light blue | `#c8e6d4` light green | Readable on dark green |
| Light backgrounds / tints | `#eaf3fb`, `#d0e6f7` | `#e8f5ee`, `#c8e6d4` | Green tints |
| Font | System default | Lato (Google Fonts) | More distinctive |
| Footer text | Course name first | `© year Name — IT 4403 Individual Project — KSU` | Personal branding |

The JavaScript logic, JSON reading, loop structure, and DOM injection are **identical** to before the restyling.

---

## Key Concepts Summary

| Concept | What it means |
|---|---|
| **Static Web App** | A site made of plain HTML/CSS/JS files — no server-side code runs |
| **CI/CD pipeline** | Push code → automatic build and deploy via GitHub Actions |
| **Deployment token** | Secret key that authorizes GitHub to publish files to your Azure app |
| **$.getJSON()** | jQuery method that fetches a JSON file and parses it automatically |
| **$(function(){})** | jQuery's "wait for page to finish loading, then run this" |
| **$.each()** | jQuery's loop — runs a function once per item in an array |
| **Mixed content** | Browser blocks `http://` resources on an `https://` page |
| **DOM injection** | Using JavaScript to insert or modify HTML after the page has loaded |

---

## Part 5: Errors Encountered During Milestone 1

This section documents every real error that was hit during development, what caused it, and how it was resolved. Commits are referenced for traceability.

---

### Error 1 — Azure Build Failure on First Deploy

**Commit:** `707a073`

**What happened:** The very first push to Azure failed. GitHub Actions ran the workflow but Azure could not deploy the site. The build step reported an error because it expected a compiled output directory.

**Root cause:** The default Azure workflow configuration had:
```yaml
output_location: "/"
skip_app_build: false   # (default — not written, but assumed true)
```
This tells Azure "run a build process and look for the output in `/`". Since this is a pure static site with no npm build, no `node_modules`, and no build step, Azure failed trying to find build output that did not exist.

**Fix:**
```yaml
output_location: ""      # empty = no build output expected
skip_app_build: true     # do not attempt to build anything
```
Telling Azure to serve the source files directly with no build step.

---

### Error 2 — Missing Link to `google-book.html` on the Homepage

**Commit:** `457dc9c`

**What happened:** `google-book.html` was created and pushed, but navigating to the homepage gave no way to reach it. The page existed on Azure but was unreachable through the UI.

**Root cause:** The `<a>` tag linking to `google-book.html` was simply never added to `index.html` before committing.

**Fix:** Added the navigation link to `index.html` in a follow-up commit.

---

### Error 3 — `google-book.html` Loaded But Showed Nothing

**Commit:** `a337e1f`

**What happened:** `google-book.html` rendered the page shell (nav, header, footer) but the main content area was completely empty — no book data appeared.

**Root cause:** The `<script>` tag containing the jQuery `$.getJSON()` call was never added to the HTML file. The page had the HTML structure and CSS styling but no JavaScript to fetch and inject the book data.

**Fix:** Added the full data-loading script block to `google-book.html`, along with the JSON data files (`google-books-book.json`, `google-books-search.json`).

---

### Error 4 — `$.getJSON()` Failing to Load the Local JSON File (3 Attempts)

**Commits:** `c2e202d`, `5f6acae`, `8cf1c9d`

**What happened:** Even after adding the script, the book page would show "Loading…" indefinitely or display the error fallback message. The JSON file was sitting in the same directory as the HTML but `$.getJSON()` could not read it. This took three separate attempts to fully resolve.

**Root cause (two separate issues):**

**Issue A — File protocol restriction:**
When the HTML file is opened directly from your computer (using `file://` in the browser), browsers block all AJAX requests as a security policy. `$.getJSON()` is an AJAX call. The fix: the file must be served over HTTP, not opened as a local file. This worked fine once deployed to Azure.

**Issue B — JSON MIME type not declared:**
Azure Static Web Apps was not serving `.json` files with the correct content type (`application/json`). The browser received the file but jQuery rejected it because the MIME type was wrong or missing.

**Fix for Issue A:** Serve the file from a proper server (Azure or a local dev server like VS Code Live Server) — never open it with `file://`.

**Fix for Issue B (commit `8cf1c9d`):** Created `staticwebapp.config.json` at the root to explicitly declare the MIME type:
```json
{
  "mimeTypes": {
    ".json": "application/json"
  }
}
```
This tells Azure to always serve `.json` files with the correct content type header.

---

### Error 5 — Cover Images Not Displaying (Mixed Content Error)

**What happened:** Book cover images appeared as broken image icons even though the `src` attribute was set correctly from the JSON data. This was visible in the browser console as a mixed content warning.

**Root cause:** The Google Books API returns image URLs starting with `http://`:
```
http://books.google.com/books/content?id=...&img=1
```
The site is served over `https://`. Browsers enforce a security policy called **mixed content blocking** — they refuse to load `http://` resources on an `https://` page because it could expose users to man-in-the-middle attacks.

**Fix:** Added the `secureUrl()` helper function, applied to every image URL before setting the `src`:
```javascript
function secureUrl(url) {
    return url ? url.replace(/^http:\/\//i, 'https://') : '';
}
```
This upgrades all image URLs from `http://` to `https://` at render time.

---

### Error 6 — Entire Deployment Pipeline Dead After Azure App Deletion

**Commits:** `7a6de6e`, `cb2c5b7`

**What happened:** At some point the original Azure Static Web App (`salmon-desert-0afeed21e`) was deleted or expired. After this, every single push to GitHub triggered the workflow and failed with:
```
Error: No matching Static Web App was found or the api key was invalid.
```
The site was completely un-deployable.

**Root cause:** Three things were simultaneously broken:
1. The Azure app resource no longer existed
2. The GitHub Actions workflow file still referenced the dead app by name
3. The deployment secret token (`AZURE_STATIC_WEB_APPS_API_TOKEN_SALMON_DESERT_0AFEED21E`) was invalid because there was nothing to authenticate against

**Fix:**
1. Created a new Azure Static Web App (`purple-water-001713d1e`)
2. Azure automatically added a new valid deployment secret to the GitHub repo
3. Azure automatically generated a new workflow file (`azure-static-web-apps-purple-water-001713d1e.yml`)
4. Manually deleted the old broken workflow file to prevent conflicts

---

### Error 7 — `package.json` Causing Confusion with Azure Build Detection

**Commits:** `1ddaeda`, `b0e490c`

**What happened:** A `package.json` file existed at the repo root. Azure's deployment system detected it and assumed the project needed a Node.js build process — triggering npm install and a build step that would always fail on a pure static site.

**Root cause:** The `package.json` was a leftover file not needed for the project. Azure uses file presence to auto-detect the project type and build strategy.

**Fix:** Moved `package.json` into the `basic_website/` subfolder (commit `1ddaeda`), then removed it entirely (commit `b0e490c`) since it served no purpose for a static site.
