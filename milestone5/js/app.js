/*
   CineScope — Milestone 5  |  app.js
   Stack: jQuery 3.7.1 + Mustache.js 4.2 + Bootstrap 5 + TMDB API v3
*/

var TMDB_API_KEY = '6e0f72f362c593ce968f1e4b320fb600';
var TMDB_BASE    = 'https://api.themoviedb.org/3';
var IMG_BASE     = 'https://image.tmdb.org/t/p/w500';

// --- State ---
var allSearchResults   = [];
var currentSearchPage  = 1;
var PAGE_SIZE          = 10;
var lastQuery          = '';

var collectionView = 'grid';
var searchView     = 'grid';

var activeCollectionTab = 'popular';
var collectionCache = { popular: null, toprated: null };

// Templates — populated inside document.ready
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
  $('#collection-section, #search-section').addClass('hidden');
  $('.navbar-nav .nav-link').removeClass('active');

  if (name === 'search') {
    $('#search-section').removeClass('hidden');
    $('#nav-search').addClass('active');
    $('#search-input').focus();
  } else {
    $('#collection-section').removeClass('hidden');
    $('#nav-collection').addClass('active');
  }
}

// ── View / Container Class Toggling ──────────────────────────────────────────

function applyView($container, view) {
  if (view === 'list') {
    $container.attr('class', 'list-group');
  } else {
    $container.attr('class', 'row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-6 g-3');
  }
}

// ── Card / List Rendering via Mustache ───────────────────────────────────────

function renderMovies($container, movies, view) {
  $container.empty();
  applyView($container, view);

  var tpl = (view === 'list') ? TPL_LIST : TPL_CARD;

  movies.forEach(function (movie) {
    var vm   = movieVM(movie);
    var html = Mustache.render(tpl, vm);
    var $el  = $($.parseHTML(html.trim())[0]);
    $el.on('click', function () { showDetail(movie.id); });
    $container.append($el);
  });
}

// ── Detail Modal via Bootstrap + Mustache ────────────────────────────────────

function showDetail(movieId) {
  var $modalBody  = $('#modal-body-content');
  var $modalTitle = $('#modal-movie-title');

  $modalBody.html('<p class="text-muted">Loading details...</p>');
  $modalTitle.text('Loading…');

  var detailModal = new bootstrap.Modal(document.getElementById('detail-modal'));
  detailModal.show();

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

      $modalTitle.text(vm.title + (vm.year !== 'N/A' ? ' (' + vm.year + ')' : ''));
      $modalBody.html(Mustache.render(TPL_DETAIL, vm));
    }
  ).fail(function () {
    $modalTitle.text('Error');
    $modalBody.html('<p class="text-danger">Could not load movie details. Please try again.</p>');
  });
}

// ── Collection (Popular / Top-Rated) ─────────────────────────────────────────

function renderCollectionMovies(movies) {
  renderMovies($('#collection-results'), movies, collectionView);
}

function loadCollection(type) {
  activeCollectionTab = type;

  $('#tab-popular, #tab-toprated').removeClass('active');
  $('#tab-' + type).addClass('active');

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
  renderMovies($('#search-results'), slice, searchView);
  renderPagination();
}

function renderPagination() {
  var totalPages = Math.min(5, Math.ceil(allSearchResults.length / PAGE_SIZE));

  function buildPagination() {
    var $ul = $('<ul class="pagination pagination-sm mb-0"></ul>');

    // Prev
    var $prevLi = $('<li class="page-item"></li>');
    if (currentSearchPage === 1) $prevLi.addClass('disabled');
    var $prevA = $('<a class="page-link" href="#">&laquo;</a>');
    $prevA.on('click', function (e) {
      e.preventDefault();
      if (currentSearchPage > 1) renderSearchPage(currentSearchPage - 1);
    });
    $prevLi.append($prevA);
    $ul.append($prevLi);

    // Page numbers
    for (var i = 1; i <= totalPages; i++) {
      (function (pageNum) {
        var $li = $('<li class="page-item"></li>');
        if (pageNum === currentSearchPage) $li.addClass('active');
        var $a = $('<a class="page-link" href="#">' + pageNum + '</a>');
        $a.on('click', function (e) {
          e.preventDefault();
          renderSearchPage(pageNum);
        });
        $li.append($a);
        $ul.append($li);
      })(i);
    }

    // Next
    var $nextLi = $('<li class="page-item"></li>');
    if (currentSearchPage === totalPages || totalPages === 0) $nextLi.addClass('disabled');
    var $nextA = $('<a class="page-link" href="#">&raquo;</a>');
    $nextA.on('click', function (e) {
      e.preventDefault();
      if (currentSearchPage < totalPages) renderSearchPage(currentSearchPage + 1);
    });
    $nextLi.append($nextA);
    $ul.append($nextLi);

    return $ul;
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
  $('#search-btn').prop('disabled', true).text('Searching…');
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
  TPL_CARD   = $('#tpl-card').html();
  TPL_LIST   = $('#tpl-list-item').html();
  TPL_DETAIL = $('#tpl-detail').html();

  // Nav
  $('#nav-collection').on('click', function (e) {
    e.preventDefault();
    showSection('collection');
  });

  $('#nav-search').on('click', function (e) {
    e.preventDefault();
    showSection('search');
  });

  // Collection view toggles
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

  // Search view toggles
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

  // Collection sub-tabs
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
