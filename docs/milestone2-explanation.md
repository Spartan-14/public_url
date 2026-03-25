# Milestone 2 — How It Works

## Part 1: How the Google Books API Works

### What an API Is

In Milestone 1, the pages read **local JSON files** sitting in the same folder on Azure. The data was fixed — same 10 books every time.

In Milestone 2, instead of a local file, the pages talk to **Google's servers** and ask for live, real-time data. That communication happens through an **API** (Application Programming Interface) — a set of URLs that Google exposes so developers can request data programmatically.

```
Milestone 1:                    Milestone 2:
Browser → Azure → local file    Browser → Google's servers → live data
(fixed data)                    (real-time data)
```

### How You Talk to the API

You communicate with the Google Books API by constructing a **URL with parameters**. Think of it like filling out a search form — except instead of clicking a button, you embed your choices directly in the URL.

**Example — searching for "javascript":**
```
https://www.googleapis.com/books/v1/volumes
    ?q=javascript          ← search term
    &maxResults=40         ← how many books to return
    &startIndex=0          ← start from the first result
    &key=YOUR_API_KEY      ← your identity credential
```

Google reads those parameters, queries its database, and sends back a JSON response — the exact same JSON structure as `google-books-search.json` from Milestone 1, but with live results.

**Example — fetching one specific book:**
```
https://www.googleapis.com/books/v1/volumes/P_zMW3EHnTEC
    ?key=YOUR_API_KEY
```

Google looks up that exact volume ID and returns full details for that one book — same structure as `google-books-book.json`.

### What the API Key Does

The API key is your identity tag. Google uses it to:
- Know which project/developer is making the request
- Enforce rate limits (prevent abuse)
- Block requests from unauthorized domains (because it is restricted)

Without a key, Google either rejects the request or rate-limits it very aggressively.

### Why the Key Is Restricted

The key has two restrictions set in Google Cloud Console:

**1. HTTP Referrer Restriction**
```
Allowed domains:
  https://purple-water-001713d1e.6.azurestaticapps.net/*
  http://localhost/*
  http://127.0.0.1/*
```
If someone views the page source, copies the API key, and tries to use it from their own website — Google will **reject their request** because their domain is not on the allowed list.

**2. API Restriction**
The key is restricted to the **Books API only**. Even if someone bypassed the referrer check, they could not use the key to call Google Maps, YouTube, or any other Google API.

---

## Part 2: How Search and Pagination Work

### The Problem

The Google Books API returns **a maximum of 40 results per call**. But the requirement says display up to 60. So one API call is not enough.

### The Solution — Two Sequential API Calls

```
User types "javascript" and clicks Search
        ↓
Call 1: fetch results 1–40
        ?q=javascript&maxResults=40&startIndex=0
        ↓
Call 2: fetch results 41–60
        ?q=javascript&maxResults=20&startIndex=40
        ↓
Combine both arrays into one master array (up to 60 items)
        ↓
Store in allResults variable
        ↓
Display page 1 (items 0–9 from allResults)
```

In code terms:

```javascript
var allResults = [];

// First call
$.getJSON(url + '&startIndex=0', function(data) {
    allResults = data.items || [];

    // Second call only if more results exist
    if (data.totalItems > 40) {
        $.getJSON(url + '&startIndex=40&maxResults=20', function(data2) {
            allResults = allResults.concat(data2.items || []);
            showPage(1);
        });
    } else {
        showPage(1);
    }
});
```

**Why sequential, not parallel?**
Call 2 uses `startIndex=40` which only makes sense after Call 1 has fetched 0–39. Also, you need to know `totalItems` from Call 1 before deciding whether Call 2 is even needed.

### How Pagination Works

Once all results are in `allResults`, pagination is **entirely client-side** — no more API calls happen when you change pages.

```
allResults = [book0, book1, book2, ... book59]  ← stored in memory

resultsPerPage = 10
currentPage = 1

Page 1 shows: allResults.slice(0, 10)   → items 0–9
Page 2 shows: allResults.slice(10, 20)  → items 10–19
Page 3 shows: allResults.slice(20, 30)  → items 20–29
...and so on
```

The formula:
```javascript
var start = (currentPage - 1) * resultsPerPage;  // page 2: (2-1)*10 = 10
var end   = start + resultsPerPage;               // 10 + 10 = 20
var pageItems = allResults.slice(start, end);
```

The **dropdown** is built dynamically based on how many results came back:
```javascript
var totalPages = Math.ceil(allResults.length / resultsPerPage);
// 60 results → Math.ceil(60/10) = 6 pages
// 23 results → Math.ceil(23/10) = 3 pages
```

When you pick a page from the dropdown or click Prev/Next, `currentPage` updates and `showPage()` re-renders the grid with the new slice — no reload, no new API call.

---

## Part 3: How the Book Details Page Gets the Right Book

### The Problem

When a user clicks a book title on the search results page, they need to land on a details page showing **that specific book**. But `book-details.html` is one single file — it has to serve details for any book. How does it know which one?

### The Solution — URL Parameters

When a book title is clicked on the search page, the link looks like this:

```html
<a href="book-details.html?id=P_zMW3EHnTEC">The Modern Web</a>
```

The `?id=P_zMW3EHnTEC` part is a **URL parameter** — data attached to the URL itself. It is not visible on the page, but JavaScript can read it.

On `book-details.html`, the first thing the script does is extract that ID:

```javascript
var params = new URLSearchParams(window.location.search);
// window.location.search = "?id=P_zMW3EHnTEC"

var bookId = params.get('id');
// bookId = "P_zMW3EHnTEC"
```

Then it uses that ID to construct the API URL and fetch that specific book:

```javascript
var apiUrl = 'https://www.googleapis.com/books/v1/volumes/' + bookId + '?key=API_KEY';

$.getJSON(apiUrl, function(data) {
    // data is the full book object
    // render title, authors, description, cover, etc.
});
```

**What if there is no ID in the URL?**
If someone navigates directly to `book-details.html` with no `?id=`, `bookId` is `null` and the page shows an error message instead of crashing.

### The Full Flow

```
Search page: user clicks "The Modern Web"
        ↓
Browser navigates to: book-details.html?id=P_zMW3EHnTEC
        ↓
book-details.html loads, CSS applies, page structure renders
        ↓
Script runs: reads ?id=P_zMW3EHnTEC from the URL
        ↓
Constructs: googleapis.com/books/v1/volumes/P_zMW3EHnTEC?key=...
        ↓
$.getJSON fires → Google responds with full book data
        ↓
Script renders: cover, title, authors, publisher, description,
                categories, rating, price (if available), links
        ↓
"Back" button uses history.back() to return to search results
```

---

## Part 4: How the My Bookshelf Page Fetches Books

### The Approach

Rather than calling a bookshelf endpoint, the page uses a **hardcoded list of volume IDs** — the three books manually added to the Google Books shelf:

```javascript
var shelfBooks = [
    'kRqeDwAAQBAJ',
    'UTGnopblxt8C',
    'P_zMW3EHnTEC'
];
```

For each ID, the page makes an individual API call to the same Volumes endpoint that `book-details.html` uses:

```
googleapis.com/books/v1/volumes/kRqeDwAAQBAJ?key=...
googleapis.com/books/v1/volumes/UTGnopblxt8C?key=...
googleapis.com/books/v1/volumes/P_zMW3EHnTEC?key=...
```

These three calls fire in a loop:

```javascript
$.each(shelfBooks, function(i, volumeId) {
    $.getJSON('https://www.googleapis.com/books/v1/volumes/' + volumeId + '?key=...',
    function(data) {
        // build card for this book
        // append to #book-grid
    });
});
```

### Important: Calls Are Asynchronous

All three API calls fire **at the same time** (not one after the other). Each one completes independently whenever Google responds. This means:

```
Call for kRqeDwAAQBAJ fires ──────────────→ card appears when Google responds
Call for UTGnopblxt8C fires ──────────→ card appears when Google responds
Call for P_zMW3EHnTEC fires ──────────────────→ card appears when Google responds
```

The cards may appear in a **different order** than the array depending on which API call responds first. This is normal behavior for asynchronous requests — it is not a bug.

---

## Part 5: Errors Encountered During Milestone 2

This section documents every real error hit during Milestone 2 development, what caused it, and how it was resolved.

---

### Error 1 — API Key Exposed in Source Code (Security Risk Caught Before Damage)

**What happened:** The Google Books API key was initially written directly into the JavaScript source files. Since the source of a static web app is fully visible to anyone who views the page source or inspects the network tab, the key was publicly readable.

**Root cause:** There is no server-side layer to hide credentials — every byte of a static web app is sent to the browser.

**Fix (two-layer mitigation):**

**Layer 1 — HTTP Referrer Restriction:**
In Google Cloud Console, the key was restricted to specific domains:
```
https://purple-water-001713d1e.6.azurestaticapps.net/*
http://localhost/*
http://127.0.0.1/*
```
If someone copies the key and tries to use it from their own domain, Google rejects the request because the `Referer` header does not match.

**Layer 2 — API Restriction:**
The key was restricted to the Books API only. Even if the referrer check was bypassed, the key cannot be used to call Google Maps, YouTube, or any other Google service.

The key is still visible in source — but it is now useless outside the authorized domains.

---

### Error 2 — API Returns No Results for Edge-Case Queries

**What happened:** Searching for certain terms returned a response with `totalItems: 0` and no `items` array at all — causing a JavaScript crash when the code tried to access `data.items` directly.

**Root cause:** The Google Books API omits the `items` field entirely from the response when there are no results, instead of returning an empty array. Code that assumed `data.items` always existed would throw `TypeError: Cannot read property 'length' of undefined`.

**Fix:** Used the `|| []` fallback everywhere `items` is accessed:
```javascript
allResults = data.items || [];
```
This means "use `data.items` if it exists, otherwise use an empty array." The UI then shows a "no results found" message instead of crashing.

---

### Error 3 — Second API Call Fired Even When Results Were Fewer Than 40

**What happened:** The pagination logic always made two API calls — one for results 0–39 and one for results 40–59. For queries returning fewer than 40 books, the second call used `startIndex=40` which returned an empty or irrelevant response, sometimes overwriting valid first-call data.

**Root cause:** The second call was not conditional on whether enough results actually existed.

**Fix:** Added a guard based on `totalItems` before firing the second call:
```javascript
if (data.totalItems > 40) {
    // only fetch page 2 if there are more than 40 results
    $.getJSON(url + '&startIndex=40&maxResults=20', function(data2) {
        allResults = allResults.concat(data2.items || []);
        showPage(1);
    });
} else {
    showPage(1);
}
```

---

### Error 4 — `book-details.html` Crashed When Opened Without a URL Parameter

**What happened:** Navigating directly to `book-details.html` (without a `?id=` parameter in the URL) caused the script to pass `null` as the volume ID to the API. The API call either failed with a 404 or returned unexpected data, and the page crashed without a useful message.

**Root cause:** `params.get('id')` returns `null` when the parameter is absent. The code did not check for this before constructing the API URL.

**Fix:** Added a null check at the top of the script. If no `id` is found, the page shows a clear error message and stops:
```javascript
var bookId = params.get('id');
if (!bookId) {
    $('#status-message').text('Error: No book ID provided in the URL.');
    return;
}
```

---

### Error 5 — Bookshelf Cards Appearing Out of Order

**What happened:** The three books on `my-bookshelf.html` appeared in a different order on each page load. The order in the array was `[kRqeDwAAQBAJ, UTGnopblxt8C, P_zMW3EHnTEC]` but the cards sometimes rendered in a completely different sequence.

**Root cause:** All three `$.getJSON()` calls fire simultaneously (asynchronously). Whichever Google server responds fastest appends its card first. Network latency varies, so the order is non-deterministic.

**This was accepted as expected behavior**, not a bug. It is documented in Part 4 of this file. A fix would require collecting all responses into an array and rendering them in index order after all calls complete — but for three curated books displayed as a simple shelf, the ordering requirement did not exist.

---

### Error 6 — Old Broken Azure Deployment Blocked Milestone 2 from Going Live

**What happened:** Milestone 2 code was written and committed, but when pushed, the GitHub Actions pipeline failed immediately — so the M2 pages never appeared on the live site.

**Root cause:** This was the same broken pipeline from Milestone 1 (the `salmon-desert` app deletion). The new M2 code was ready but couldn't deploy through the dead pipeline.

**Fix:** This was resolved at the same time as the M1 deployment fix — creating the new `purple-water` Azure app, installing the new deployment token, and replacing the old workflow file. Once the pipeline was fixed, both M1 and M2 deployed together.

---

## Full Data Flow Summary — Milestone 2

```
┌─────────────────────────────────────────────────────┐
│                  USER'S BROWSER                     │
│                                                     │
│  index.html          book-details.html   my-bookshelf.html
│  (search page)       (details page)      (shelf page)
│       │                    │                  │
│  User types query    Reads ?id= from URL  Loops over
│  clicks Search       builds API URL      3 volume IDs
│       │                    │                  │
│  $.getJSON ×2         $.getJSON ×1       $.getJSON ×3
└───────┼────────────────────┼──────────────────┼──────┘
        │                    │                  │
        ▼                    ▼                  ▼
┌─────────────────────────────────────────────────────┐
│              GOOGLE BOOKS API                       │
│   googleapis.com/books/v1/volumes?q=...             │
│   googleapis.com/books/v1/volumes/{id}              │
│                                                     │
│   Returns JSON → jQuery parses it →                 │
│   JavaScript builds HTML → browser renders cards    │
└─────────────────────────────────────────────────────┘
```
