# Milestone 3 — How It Works
## IT 4403 Individual Project — DJENKEU EDOU Livyo Kurtys

---

## Part 1: What Changed from Milestone 2

### Milestone 2 vs Milestone 3 — Side by Side

| | Milestone 2 | Milestone 3 |
|---|---|---|
| **Project name** | Google Books viewer | CineScope |
| **API used** | Google Books API | TMDB (The Movie Database) API |
| **Page structure** | Multiple HTML pages (`index.html`, `book-details.html`, `my-bookshelf.html`) | One single HTML page (`index.html`) |
| **Navigation** | Browser navigates to a new URL for each page | JavaScript swaps visible sections — URL never changes |
| **Detail view** | Separate page loaded via `?id=` URL parameter | Same page, detail section shown/hidden by JS |
| **Parallel requests** | No (M2 used sequential calls) | Yes — `$.when()` fires multiple API calls at once |
| **Popular content** | Hardcoded book IDs (My Bookshelf) | Live TMDB popular movies endpoint |

### What a Single-Page Application (SPA) Means

In Milestone 2, clicking a book title caused the browser to **navigate to a new URL** (`book-details.html?id=...`). The browser made a full round-trip: it requested a new HTML file from the server, unloaded the current page, and re-rendered from scratch.

In Milestone 3, **the browser never leaves `index.html`**. There is only one HTML file. All navigation — switching between Popular, Search, and Detail views — happens entirely in JavaScript:

```
User clicks "Search" tab
        ↓
JavaScript adds class="hidden" to #popular-section
        ↓
JavaScript removes class="hidden" from #search-section
        ↓
Browser re-renders what is visible — no server request, no page reload
```

The URL in the address bar stays the same throughout. This is the defining characteristic of a SPA.

---

## Part 2: How the TMDB API Works

### What TMDB Is

TMDB (The Movie Database) is a community-maintained movie and TV database. It exposes a public REST API that returns JSON — exactly the same communication pattern as the Google Books API in Milestone 2, but for movies.

### The Base URL and API Key

Every request goes to the same base URL:
```
https://api.themoviedb.org/3
```

And every request must include an `api_key` parameter:
```
https://api.themoviedb.org/3/movie/popular?api_key=YOUR_KEY&page=1
```

Without the key, TMDB returns a 401 Unauthorized error.

### The Three Endpoints Used

**1 — Popular Movies:**
```
GET /movie/popular?api_key=...&page=1
```
Returns a list of 20 currently popular movies. Each page returns 20 items, so fetching pages 1, 2, and 3 gives up to 60 movies.

**2 — Movie Search:**
```
GET /search/movie?api_key=...&query=inception&page=1
```
Searches TMDB's database for movies matching the query string. Also returns 20 results per page.

**3 — Movie Details:**
```
GET /movie/{movie_id}?api_key=...&append_to_response=credits
```
Returns full details for one specific movie — title, overview, genres, runtime, rating, poster path. The `append_to_response=credits` parameter tells TMDB to include cast/crew data in the same response instead of requiring a second call.

### Poster Images

TMDB does not embed image data in the JSON. Instead, it returns a **path string**:
```json
"poster_path": "/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg"
```

To get a usable image URL, the path is prefixed with the image base URL and a size:
```javascript
var IMG_BASE = 'https://image.tmdb.org/t/p/w500';

var posterUrl = IMG_BASE + movie.poster_path;
// → https://image.tmdb.org/t/p/w500/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg
```

`w500` means 500px wide. TMDB also supports `w200`, `w342`, `original`, and others. The card grid uses `w500` — large enough for a detail view, small enough to load fast in a grid.

If `poster_path` is `null` (some movies have no poster), the code renders a placeholder `<div class="no-poster">No Image</div>` instead of a broken `<img>` tag.

---

## Part 3: How Popular Movies Load

### The Flow

When the page first loads, `$(document).ready()` fires and immediately calls `loadPopular()`:

```
Page loads
        ↓
$(document).ready() triggers
        ↓
loadPopular() called
        ↓
Three $.getJSON calls fire simultaneously (pages 1, 2, 3)
        ↓
$.when() waits for all three to complete
        ↓
Results merged into one array of 60 movies
        ↓
forEach loop builds a card for each movie
        ↓
Cards appended to #popular-results grid
```

### Why Three Parallel Calls Instead of One

TMDB returns exactly **20 movies per page**. Fetching 60 requires 3 pages. These three calls are **independent** — page 2 does not depend on page 1 finishing first. So they fire simultaneously using `$.when()`:

```javascript
var requests = [
    $.getJSON(TMDB_BASE + '/movie/popular', { api_key: TMDB_API_KEY, page: 1 }),
    $.getJSON(TMDB_BASE + '/movie/popular', { api_key: TMDB_API_KEY, page: 2 }),
    $.getJSON(TMDB_BASE + '/movie/popular', { api_key: TMDB_API_KEY, page: 3 })
];

$.when.apply($, requests).done(function (r1, r2, r3) {
    var movies = [].concat(r1[0].results, r2[0].results, r3[0].results);
    // render all 60 cards
});
```

`$.when()` acts as a synchronization point — the `.done()` callback only runs **after all three requests have completed**. This is faster than sequential calls:

```
Sequential (M2 pattern):      Parallel (M3 pattern):
Call 1 → wait → Call 2        Call 1 ──┐
         → wait → Call 3      Call 2 ──┤─→ $.when() → .done()
Total: ~900ms                 Call 3 ──┘
                               Total: ~300ms
```

### What Each Response Looks Like

```json
{
  "page": 1,
  "results": [
    {
      "id": 1184918,
      "title": "The Wild Robot",
      "poster_path": "/wTnV3PCVW5O92JMrFvvrRcV39RU.jpg",
      "release_date": "2024-09-12",
      "vote_average": 8.5,
      "overview": "After a shipwreck, an intelligent robot..."
    },
    ...19 more
  ],
  "total_results": 40000,
  "total_pages": 2000
}
```

Only `results` is used. The three `results` arrays are merged with `.concat()` into one flat array of 60 movie objects.

---

## Part 4: How Search and Pagination Work

### The Search Flow

```
User types "inception" and presses Enter (or clicks Search)
        ↓
doSearch("inception") called
        ↓
allSearchResults = [] (cleared from previous search)
        ↓
Three $.getJSON calls fire simultaneously:
  /search/movie?query=inception&page=1
  /search/movie?query=inception&page=2
  /search/movie?query=inception&page=3
        ↓
$.when() waits for all three
        ↓
Results concatenated → capped at 50
        ↓
renderSearchPage(1) called → shows items 0–9
        ↓
Pagination buttons rendered
```

### Why Results Are Capped at 50

The three parallel search calls fetch up to 60 results (3 × 20). But the displayed cap is 50. This means a maximum of 5 pages × 10 items:

```javascript
allSearchResults = allSearchResults.slice(0, 50);
var totalPages = Math.min(5, Math.ceil(allSearchResults.length / PAGE_SIZE));
```

If a search returns fewer than 50 results (e.g. only 23 movies found), `totalPages` adjusts automatically:
```
Math.ceil(23 / 10) = 3 pages
```

### How Client-Side Pagination Works

Once all results are stored in `allSearchResults`, pagination never makes another API call. It simply slices the in-memory array:

```javascript
var start = (page - 1) * PAGE_SIZE;   // page 2: (2-1)*10 = 10
var slice = allSearchResults.slice(start, start + PAGE_SIZE);
// page 2 → items [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
```

The grid is cleared and rebuilt with just that slice:

```
Page 1: allSearchResults.slice(0, 10)
Page 2: allSearchResults.slice(10, 20)
Page 3: allSearchResults.slice(20, 30)
Page 4: allSearchResults.slice(30, 40)
Page 5: allSearchResults.slice(40, 50)
```

### Pagination Buttons

`renderPagination()` builds two identical sets of pagination controls — one above the grid (`#search-pagination`) and one below (`#search-pagination-bottom`). Each set contains:

- A **Prev** button — disabled when on page 1
- **Numbered buttons** (1 through totalPages) — active page gets `.active` class
- A **Next** button — disabled when on the last page

Both sets are rebuilt from scratch every time the page changes. This avoids stale event listeners accumulating on old buttons.

---

## Part 5: How the Detail View Works

### The Problem This Solves

In Milestone 2, clicking a book navigated to a separate `book-details.html` page. In a SPA, there is no second page. Instead, the detail view is a hidden `<section>` in the same HTML file that gets shown when a card is clicked.

### The Flow

```
User clicks a movie card
        ↓
showDetail(movieId, fromSection) called
        ↓
#popular-section and #search-section hidden
        ↓
#detail-section shown with "Loading details..." placeholder
        ↓
$.getJSON fires:
  /movie/{movieId}?api_key=...&append_to_response=credits
        ↓
TMDB responds with full movie data
        ↓
HTML built from data (title, rating, year, runtime, genres, overview, poster)
        ↓
#detail-content updated with built HTML
        ↓
User clicks ← Back
        ↓
#detail-section hidden
        ↓
Whichever section was active before (popular or search) is shown again
```

### The `fromSection` Parameter

When `showDetail()` is called, it records which section the user came from:

```javascript
var sectionBeforeDetail = 'popular'; // default

function showDetail(movieId, fromSection) {
    sectionBeforeDetail = fromSection;
    // ...
}
```

The Back button uses this to return the user to the right place:

```javascript
$('#detail-back').on('click', function () {
    if (sectionBeforeDetail === 'search') {
        // show search section, mark Search tab active
    } else {
        // show popular section, mark Popular tab active
    }
});
```

Without this, clicking Back from a movie found via search would incorrectly return to Popular.

### The `append_to_response` Parameter

The detail call uses:
```
/movie/{id}?api_key=...&append_to_response=credits
```

`append_to_response` is a TMDB feature that bundles additional data into the same response. Instead of making two separate calls (one for movie info, one for credits), TMDB returns both in a single response. This saves a network round-trip.

### XSS Protection

Movie titles and overviews from external APIs are **untrusted text**. If a title contained `<script>alert('xss')</script>`, injecting it directly into HTML would execute the script. The code prevents this by using jQuery's `.text()` method to escape any HTML characters before inserting into the DOM:

```javascript
$('<div>').text(movie.title).html()
```

This converts `movie.title` to safe escaped text (e.g. `<` becomes `&lt;`) before it is placed in the HTML string.

---

## Part 6: How SPA Navigation Works

### The Three Sections

The HTML has three `<section>` elements:

```html
<section id="search-section" class="section hidden">...</section>
<section id="popular-section" class="section">...</section>
<section id="detail-section" class="section hidden">...</section>
```

`popular-section` starts visible. The others start with `class="hidden"` which applies `display: none !important` via CSS. Showing/hiding is done entirely by adding or removing the `hidden` class.

### The `showSection()` Function

```javascript
function showSection(name) {
    $searchSection.addClass('hidden');
    $popularSection.addClass('hidden');
    $detailSection.addClass('hidden');
    $('.nav-link').removeClass('active');

    if (name === 'search') {
        $searchSection.removeClass('hidden');
        $('#nav-search').addClass('active');
    } else {
        $popularSection.removeClass('hidden');
        $('#nav-popular').addClass('active');
    }
}
```

Every call hides all three sections first, then reveals the one requested. This avoids any scenario where two sections are visible at once.

### Why No URL Changes

In a traditional multi-page site, the URL always reflects what the user is looking at. In this SPA, the URL stays at `/milestone3/index.html` regardless of which section is active. This is a trade-off:

| | Multi-page (M2) | SPA (M3) |
|---|---|---|
| Can bookmark a specific movie | Yes (`book-details.html?id=...`) | No |
| Can use browser Back button | Yes | No (Back button implemented manually) |
| Page load on navigation | Yes (full reload) | No (instant switch) |
| Server requests on navigation | One per page | Zero after initial load |

A full SPA implementation would use the **History API** (`window.history.pushState`) to update the URL without reloading, enabling bookmarking and native back/forward. This was not implemented in Milestone 3.

---

## Part 7: The `buildCard()` Function

Both Popular and Search use the same card builder, ensuring visual consistency:

```javascript
function buildCard(movie) {
    var posterUrl = movie.poster_path
        ? IMG_BASE + movie.poster_path
        : null;

    var year = movie.release_date
        ? movie.release_date.substring(0, 4)   // "2024-09-12" → "2024"
        : 'N/A';

    var rating = movie.vote_average
        ? '&#9733; ' + movie.vote_average.toFixed(1)   // ★ 8.5
        : '';
    // ...
}
```

`release_date` is a full ISO date string (`"2024-09-12"`). `.substring(0, 4)` extracts just the year. `toFixed(1)` rounds the rating to one decimal place (e.g. `8.476` → `"8.5"`).

The returned value is a **jQuery object** (`$(...)`) not a raw HTML string. This allows `.on('click', ...)` to be chained directly on it before appending to the DOM.

---

## Part 8: Errors Encountered During Milestone 3

---

### Error 1 — `$.when()` Response Structure Differs for Single vs Multiple Requests

**What happened:** When `$.when()` is called with a single deferred object, the `.done()` callback receives the response arguments directly. When called with multiple deferred objects, each argument to `.done()` is an array `[data, status, jqXHR]`. Writing code that assumed the multi-argument format broke when only one search result page existed.

**Root cause:** jQuery's `$.when()` has inconsistent argument passing depending on how many deferreds are passed. With multiple deferreds, each `.done()` argument is `[data, status, jqXHR]`, so `r1[0]` is the response data. With a single deferred, the arguments are spread directly.

**Fix:** Added a guard in the search result handler:
```javascript
pages.forEach(function (r) {
    var data = Array.isArray(r) ? r[0] : r;
    if (data && data.results) {
        allSearchResults = allSearchResults.concat(data.results);
    }
});
```
This normalizes the response regardless of whether it arrived as an array or directly.

---

### Error 2 — Clicking Back from Detail Returned to the Wrong Section

**What happened:** If a user found a movie via Search, clicked into its detail view, then clicked Back, they were returned to the Popular section instead of back to their search results.

**Root cause:** The Back button handler originally always showed the Popular section — it did not track where the user came from.

**Fix:** Added the `sectionBeforeDetail` variable. Every call to `showDetail()` passes the originating section name (`'popular'` or `'search'`), which is stored and used by the Back button to restore the correct section.

---

### Error 3 — Movies With No Poster Caused Broken Image Icons

**What happened:** Some movies in TMDB have no poster — their `poster_path` field is `null`. Setting `<img src="null">` or `<img src="https://image.tmdb.org/t/p/w500null">` resulted in a broken image icon displayed in the card.

**Root cause:** The initial code unconditionally built an `<img>` tag from `poster_path` without checking if it was null.

**Fix:** Added a conditional in `buildCard()`:
```javascript
var posterHtml = posterUrl
    ? '<img src="' + posterUrl + '" alt="..." loading="lazy" />'
    : '<div class="no-poster">No Image</div>';
```
If `poster_path` is null, a styled placeholder div is shown instead.

---

### Error 4 — Search Input Not Cleared Between Searches

**What happened:** Running a search, then running a different search, caused results from both searches to appear in the grid simultaneously — new results were appended to old ones.

**Root cause:** `allSearchResults` was concatenated without being reset between searches, and `#search-results` was not emptied before rendering the new page.

**Fix:** At the start of every `doSearch()` call:
```javascript
allSearchResults = [];
currentSearchPage = 1;
$('#search-results').empty();
```
This ensures a clean slate before fetching and rendering new results.

---

### Error 5 — Pagination Buttons Accumulating Duplicate Event Listeners

**What happened:** Clicking through several pages caused each subsequent page change to fire the click handler multiple times — page 3 would jump erratically because the button had three separate listeners attached from three previous renders.

**Root cause:** `renderPagination()` appended new buttons without removing the old ones first. Each render added a fresh set of listeners on top of the existing ones.

**Fix:** Both pagination containers are emptied before new buttons are appended:
```javascript
$('#search-pagination').empty().append(buildPagination());
$('#search-pagination-bottom').empty().append(buildPagination());
```
`.empty()` removes all child elements and their associated event listeners before the new buttons are added.

---

## Full Data Flow Summary — Milestone 3

```
┌──────────────────────────────────────────────────────────────┐
│                     USER'S BROWSER                           │
│                  (single page: index.html)                   │
│                                                              │
│  #popular-section        #search-section    #detail-section  │
│  (visible on load)       (hidden by default)(hidden by def.) │
│         │                       │                  │         │
│  loadPopular()            doSearch(query)    showDetail(id)  │
│         │                       │                  │         │
│  $.when(page1,          $.when(page1,        $.getJSON       │
│   page2, page3)          page2, page3)       /movie/{id}     │
└─────────┼───────────────────────┼────────────────┼──────────┘
          │                       │                │
          ▼                       ▼                ▼
┌──────────────────────────────────────────────────────────────┐
│                     TMDB API v3                              │
│   /movie/popular?page=N     → 20 movies per page             │
│   /search/movie?query=...   → 20 matches per page            │
│   /movie/{id}               → full details for one movie     │
│                                                              │
│   Returns JSON → jQuery parses →                             │
│   JS builds HTML → CSS styles → browser renders              │
└──────────────────────────────────────────────────────────────┘
```

---

## Key Concepts Summary

| Concept | What it means |
|---|---|
| **SPA** | Single-Page Application — one HTML file, JS swaps content without reloading |
| **`$.when()`** | jQuery utility that waits for multiple async calls to all complete before proceeding |
| **Parallel requests** | Multiple API calls fire at the same time, reducing total wait time |
| **Client-side pagination** | All results stored in memory; page changes slice the array — no new API calls |
| **`append_to_response`** | TMDB feature that bundles extra data (e.g. credits) into one response |
| **`display: none`** | CSS used to hide sections; toggled by adding/removing the `hidden` class via JS |
| **XSS protection** | Using `$('<div>').text(str).html()` to escape untrusted text before DOM insertion |
| **`poster_path`** | TMDB returns image paths, not full URLs — must be prefixed with the image base URL |
