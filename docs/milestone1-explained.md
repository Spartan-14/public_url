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
