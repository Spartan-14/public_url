/*
   CineScope — Milestone 4  |  app.js
   Stack: jQuery 3.7.1 + Mustache.js 4.2 + TMDB API v3
*/

var TMDB_API_KEY = '6e0f72f362c593ce968f1e4b320fb600';
var TMDB_BASE    = 'https://api.themoviedb.org/3';
var IMG_BASE     = 'https://image.tmdb.org/t/p/w500';

// --- State ---
var allSearchResults    = [];
var currentSearchPage  = 1;
var PAGE_SIZE          = 10;
var lastQuery          = '';
var sectionBeforeDetail = 'collection';

var collectionView = 'grid';
var searchView     = 'grid';

var activeCollectionTab = 'popular';
var collectionCache = { popular: null, toprated: null };

// Templates — read inside document.ready so the DOM is guaranteed ready
var TPL_CARD, TPL_LIST, TPL_DETAIL;

// ── Helpers ──────────────────────────────────────────────────────────────────

function posterUrl(path) {
  return path ? IMG_BASE + path : '';
}

function extractYear(dateStr) {
  return dateStr ? dateStr.substring(0, 4) : 'N/A';
}

function formatRating(avg) {
  return (avg && avg > 0) ? avg.toFixed(1) : '';
}

function movieVM(movie) {
  return {
    id:         movie.id,
    title:      movie.title || 'Untitled',
    year:       extractYear(movie.release_date),
    rating:     formatRating(movie.vote_average),
    poster_url: posterUrl(movie.poster_path),
    overview:   movie.overview
      ? movie.overview.substring(0, 200) + (movie.overview.length > 200 ? '…' : '')
      : ''
  };
}

// ── Navigation ───────────────────────────────────────────────────────────────

function showSection(name) {
  $('#collection-section, #search-section, #detail-section').addClass('hidden');
  $('.nav-link').removeClass('active');

  if (name === 'search') {
    $('#search-section').removeClass('hidden');
    $('#nav-search').addClass('active');
    $('#search-input').focus();
  } else {
    $('#collection-section').removeClass('hidden');
    $('#nav-collection').addClass('active');
  }
}

// ── View Toggle ──────────────────────────────────────────────────────────────

function applyView($container, view) {
  if (view === 'list') {
    $container.removeClass('card-grid').addClass('card-list');
  } else {
    $container.removeClass('card-list').addClass('card-grid');
  }
}

// ── Card / List Rendering via Mustache ───────────────────────────────────────

function renderMovies($container, movies, view, fromSection) {
  $container.empty();
  applyView($container, view);

  var tpl = (view === 'list') ? TPL_LIST : TPL_CARD;

  movies.forEach(function (movie) {
    var vm   = movieVM(movie);
    var html = Mustache.render(tpl, vm);
    var $el  = $($.parseHTML(html.trim())[0]);
    $el.on('click', function () { showDetail(movie.id, fromSection); });
    $container.append($el);
  });
}

// ── Detail View via Mustache ─────────────────────────────────────────────────

function showDetail(movieId, fromSection) {
  sectionBeforeDetail = fromSection;
  $('#collection-section, #search-section').addClass('hidden');
  $('.nav-link').removeClass('active');
  $('#detail-section').removeClass('hidden');

  $('#detail-content').html('<p class="loading-msg">Loading details...</p>');

  $.getJSON(
    TMDB_BASE + '/movie/' + movieId,
    { api_key: TMDB_API_KEY, append_to_response: 'credits' },
    function (data) {
      var vm = {
        id:         data.id,
        title:      data.title || 'Untitled',
        year:       extractYear(data.release_date),
        rating:     formatRating(data.vote_average),
        poster_url: posterUrl(data.poster_path),
        runtime:    data.runtime ? data.runtime + ' min' : '',
        language:   data.original_language ? data.original_language.toUpperCase() : '',
        genres:     data.genres || [],
        overview:   data.overview || 'No overview available.',
        tagline:    data.tagline || ''
      };

      var html = Mustache.render(TPL_DETAIL, vm);
      $('#detail-content').html(html);
    }
  ).fail(function () {
    $('#detail-content').html('<p class="error-msg">Could not load movie details. Please try again.</p>');
  });
}

// ── Collection (Popular / Top-Rated) ─────────────────────────────────────────

function renderCollectionMovies(movies) {
  renderMovies($('#collection-results'), movies, collectionView, 'collection');
}

function loadCollection(type) {
  activeCollectionTab = type;

  $('#tab-popular, #tab-toprated').removeClass('active');
  $('#tab-' + (type === 'toprated' ? 'toprated' : 'popular')).addClass('active');

  if (collectionCache[type]) {
    renderCollectionMovies(collectionCache[type]);
    return;
  }

  $('#collection-loading').show();
  $('#collection-results').empty();

  var endpoint = (type === 'toprated') ? '/movie/top_rated' : '/movie/popular';

  var requests = [
    $.getJSON(TMDB_BASE + endpoint, { api_key: TMDB_API_KEY, page: 1 }),
    $.getJSON(TMDB_BASE + endpoint, { api_key: TMDB_API_KEY, page: 2 }),
    $.getJSON(TMDB_BASE + endpoint, { api_key: TMDB_API_KEY, page: 3 })
  ];

  $.when.apply($, requests).done(function (r1, r2, r3) {
    var movies = [].concat(r1[0].results, r2[0].results, r3[0].results);
    collectionCache[type] = movies;
    $('#collection-loading').hide();
    renderCollectionMovies(movies);
  }).fail(function () {
    $('#collection-loading').text('Failed to load movies. Please refresh.');
  });
}

// ── Search & Pagination ───────────────────────────────────────────────────────

function renderSearchPage(page) {
  currentSearchPage = page;
  var start = (page - 1) * PAGE_SIZE;
  var slice = allSearchResults.slice(start, start + PAGE_SIZE);
  renderMovies($('#search-results'), slice, searchView, 'search');
  renderPagination();
}

function renderPagination() {
  var totalPages = Math.min(5, Math.ceil(allSearchResults.length / PAGE_SIZE));

  function buildPagination() {
    var $wrap = $('<div class="pagination"></div>');

    var $prev = $('<button class="page-btn">« Prev</button>');
    if (currentSearchPage === 1) $prev.prop('disabled', true);
    $prev.on('click', function () { renderSearchPage(currentSearchPage - 1); });
    $wrap.append($prev);

    $wrap.append($('<span class="page-info">Page ' + currentSearchPage + ' of ' + totalPages + '</span>'));

    for (var i = 1; i <= totalPages; i++) {
      (function (pageNum) {
        var $btn = $('<button class="page-btn">' + pageNum + '</button>');
        if (pageNum === currentSearchPage) $btn.addClass('active');
        $btn.on('click', function () { renderSearchPage(pageNum); });
        $wrap.append($btn);
      })(i);
    }

    var $next = $('<button class="page-btn">Next »</button>');
    if (currentSearchPage === totalPages || totalPages === 0) $next.prop('disabled', true);
    $next.on('click', function () { renderSearchPage(currentSearchPage + 1); });
    $wrap.append($next);

    return $wrap;
  }

  $('#search-pagination').empty().append(buildPagination());
  $('#search-pagination-bottom').empty().append(buildPagination());
}

function doSearch(query) {
  if (!query) return;
  lastQuery = query;
  allSearchResults  = [];
  currentSearchPage = 1;

  $('#search-results').empty();
  $('#search-results-wrap').addClass('hidden');
  $('#search-empty').addClass('hidden');
  $('#search-btn').prop('disabled', true).text('Searching...');
  $('#search-heading').text('Results for "' + query + '"');

  var requests = [
    $.getJSON(TMDB_BASE + '/search/movie', { api_key: TMDB_API_KEY, query: query, page: 1 }),
    $.getJSON(TMDB_BASE + '/search/movie', { api_key: TMDB_API_KEY, query: query, page: 2 }),
    $.getJSON(TMDB_BASE + '/search/movie', { api_key: TMDB_API_KEY, query: query, page: 3 })
  ];

  $.when.apply($, requests).done(function (r1, r2, r3) {
    [r1, r2, r3].forEach(function (r) {
      var data = Array.isArray(r) ? r[0] : r;
      if (data && data.results) {
        allSearchResults = allSearchResults.concat(data.results);
      }
    });

    allSearchResults = allSearchResults.slice(0, 50);
    $('#search-btn').prop('disabled', false).text('Search');

    if (allSearchResults.length === 0) {
      $('#search-empty').removeClass('hidden');
    } else {
      $('#search-results-wrap').removeClass('hidden');
      renderSearchPage(1);
    }
  }).fail(function () {
    $('#search-btn').prop('disabled', false).text('Search');
    $('#search-results').html('<p class="error-msg">Search failed. Please try again.</p>');
    $('#search-results-wrap').removeClass('hidden');
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

$(document).ready(function () {
  // Read templates after DOM is fully ready
  TPL_CARD   = $('#tpl-card').html();
  TPL_LIST   = $('#tpl-list-item').html();
  TPL_DETAIL = $('#tpl-detail').html();

  // Wire up nav
  $('#nav-collection').on('click', function (e) {
    e.preventDefault();
    showSection('collection');
  });

  $('#nav-search').on('click', function (e) {
    e.preventDefault();
    showSection('search');
  });

  // Back button
  $('#detail-back').on('click', function () {
    $('#detail-section').addClass('hidden');
    if (sectionBeforeDetail === 'search') {
      $('#search-section').removeClass('hidden');
      $('#nav-search').addClass('active');
      $('#nav-collection').removeClass('active');
    } else {
      $('#collection-section').removeClass('hidden');
      $('#nav-collection').addClass('active');
      $('#nav-search').removeClass('active');
    }
  });

  // View toggles — collection
  $('#view-grid-collection').on('click', function () {
    collectionView = 'grid';
    $(this).addClass('active');
    $('#view-list-collection').removeClass('active');
    renderCollectionMovies(collectionCache[activeCollectionTab] || []);
  });

  $('#view-list-collection').on('click', function () {
    collectionView = 'list';
    $(this).addClass('active');
    $('#view-grid-collection').removeClass('active');
    renderCollectionMovies(collectionCache[activeCollectionTab] || []);
  });

  // View toggles — search
  $('#view-grid-search').on('click', function () {
    searchView = 'grid';
    $(this).addClass('active');
    $('#view-list-search').removeClass('active');
    renderSearchPage(currentSearchPage);
  });

  $('#view-list-search').on('click', function () {
    searchView = 'list';
    $(this).addClass('active');
    $('#view-grid-search').removeClass('active');
    renderSearchPage(currentSearchPage);
  });

  // Sub-tabs
  $('#tab-popular').on('click', function () { loadCollection('popular'); });
  $('#tab-toprated').on('click', function () { loadCollection('toprated'); });

  // Search
  $('#search-btn').on('click', function () {
    doSearch($('#search-input').val().trim());
  });

  $('#search-input').on('keydown', function (e) {
    if (e.key === 'Enter') doSearch($(this).val().trim());
  });

  // Load initial data
  loadCollection('popular');
});
