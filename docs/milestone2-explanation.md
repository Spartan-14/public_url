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
