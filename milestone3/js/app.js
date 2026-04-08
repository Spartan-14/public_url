/* 
   CineScope — Milestone 3  |  app.js
   Stack: jQuery 3.7.1 + TMDB API v3
    */

var TMDB_API_KEY = '6e0f72f362c593ce968f1e4b320fb600';
var TMDB_BASE    = 'https://api.themoviedb.org/3';
var IMG_BASE     = 'https://image.tmdb.org/t/p/w500';

// Search state
var allSearchResults = [];   // up to 60 results stored after fetching 3 TMDB pages
var currentSearchPage = 1;   // which page-view (1–5) is shown
var PAGE_SIZE = 10;          // items per page-view
var lastQuery = '';

// Section references
var $searchSection  = $('#search-section');
var $popularSection = $('#popular-section');
var $detailSection  = $('#detail-section');

// NAV — toggle between Search and Popular sections
    
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

$('#nav-popular').on('click', function (e) {
  e.preventDefault();
  showSection('popular');
});

$('#nav-search').on('click', function (e) {
  e.preventDefault();
  showSection('search');
  $('#search-input').focus();
});

//    BACK BUTTON — returns to whichever section was active before

var sectionBeforeDetail = 'popular';

$('#detail-back').on('click', function () {
  $detailSection.addClass('hidden');
  if (sectionBeforeDetail === 'search') {
    $searchSection.removeClass('hidden');
    $('#nav-search').addClass('active');
    $('#nav-popular').removeClass('active');
  } else {
    $popularSection.removeClass('hidden');
    $('#nav-popular').addClass('active');
    $('#nav-search').removeClass('active');
  }
});

// CARD BUILDER — shared by search and popular sections
  
function buildCard(movie) {
  var posterUrl = movie.poster_path
    ? IMG_BASE + movie.poster_path
    : null;

  var year = movie.release_date
    ? movie.release_date.substring(0, 4)
    : 'N/A';

  var rating = movie.vote_average
    ? '&#9733; ' + movie.vote_average.toFixed(1)
    : '';

  var posterHtml = posterUrl
    ? '<img src="' + posterUrl + '" alt="' + $('<div>').text(movie.title).html() + ' poster" loading="lazy" />'
    : '<div class="no-poster">No Image</div>';

  return $(
    '<div class="movie-card" data-id="' + movie.id + '">' +
      posterHtml +
      '<div class="card-body">' +
        '<div class="card-title">' + $('<div>').text(movie.title).html() + '</div>' +
        '<div class="card-year">' + year + '</div>' +
        (rating ? '<div class="card-rating">' + rating + '</div>' : '') +
      '</div>' +
    '</div>'
  );
}

// DETAIL VIEW — fetch full movie info and render
   
function showDetail(movieId, fromSection) {
  sectionBeforeDetail = fromSection;

  // hide current section, show detail
  $searchSection.addClass('hidden');
  $popularSection.addClass('hidden');
  $('.nav-link').removeClass('active');
  $detailSection.removeClass('hidden');

  $('#detail-content').html('<p class="loading-msg">Loading details...</p>');

  $.getJSON(
    TMDB_BASE + '/movie/' + movieId,
    { api_key: TMDB_API_KEY, append_to_response: 'credits' },
    function (data) {
      var posterHtml = data.poster_path
        ? '<img src="' + IMG_BASE + data.poster_path + '" alt="' + $('<div>').text(data.title).html() + ' poster" />'
        : '<div class="detail-no-poster">No Image</div>';

      var year = data.release_date ? data.release_date.substring(0, 4) : 'N/A';

      var genres = data.genres && data.genres.length
        ? data.genres.map(function (g) { return '<span class="tag">' + g.name + '</span>'; }).join('')
        : '';

      var runtime = data.runtime ? data.runtime + ' min' : '';

      var overview = data.overview || 'No overview available.';

      var html =
        '<div class="detail-card">' +
          posterHtml +
          '<div class="detail-body">' +
            '<h1 class="detail-title">' + $('<div>').text(data.title).html() + '</h1>' +
            '<div class="detail-meta">' +
              (data.vote_average ? '<span class="badge">&#9733; ' + data.vote_average.toFixed(1) + '</span>' : '') +
              '<span>' + year + '</span>' +
              (runtime ? '<span>' + runtime + '</span>' : '') +
              genres +
            '</div>' +
            '<p class="detail-overview">' + $('<div>').text(overview).html() + '</p>' +
          '</div>' +
        '</div>';

      $('#detail-content').html(html);
    }
  ).fail(function () {
    $('#detail-content').html('<p class="error-msg">Could not load movie details. Please try again.</p>');
  });
}

//  POPULAR MOVIES — fetch on page load, display all results
  
function loadPopular() {
  $('#popular-loading').show();
  $('#popular-results').empty();

  // Fetch 3 pages of popular movies (20 each = 60 total) then show all
  var requests = [
    $.getJSON(TMDB_BASE + '/movie/popular', { api_key: TMDB_API_KEY, page: 1 }),
    $.getJSON(TMDB_BASE + '/movie/popular', { api_key: TMDB_API_KEY, page: 2 }),
    $.getJSON(TMDB_BASE + '/movie/popular', { api_key: TMDB_API_KEY, page: 3 })
  ];

  $.when.apply($, requests).done(function (r1, r2, r3) {
    var movies = [].concat(r1[0].results, r2[0].results, r3[0].results);
    $('#popular-loading').hide();

    movies.forEach(function (movie) {
      var $card = buildCard(movie);
      $card.on('click', function () { showDetail(movie.id, 'popular'); });
      $('#popular-results').append($card);
    });
  }).fail(function () {
    $('#popular-loading').text('Failed to load popular movies. Please refresh.');
  });
}

//  SEARCH — fetch up to 3 TMDB pages (60 results), paginate 10/page
  
function renderSearchPage(page) {
  currentSearchPage = page;
  var start = (page - 1) * PAGE_SIZE;
  var slice = allSearchResults.slice(start, start + PAGE_SIZE);

  $('#search-results').empty();

  slice.forEach(function (movie) {
    var $card = buildCard(movie);
    $card.on('click', function () { showDetail(movie.id, 'search'); });
    $('#search-results').append($card);
  });

  renderPagination();
}

function renderPagination() {
  var totalPages = Math.min(5, Math.ceil(allSearchResults.length / PAGE_SIZE));

  function buildPagination() {
    var $wrap = $('<div class="pagination"></div>');

    // Prev button
    var $prev = $('<button class="page-btn">&laquo; Prev</button>');
    if (currentSearchPage === 1) $prev.prop('disabled', true);
    $prev.on('click', function () { renderSearchPage(currentSearchPage - 1); });
    $wrap.append($prev);

    // Numbered buttons
    for (var i = 1; i <= totalPages; i++) {
      (function (pageNum) {
        var $btn = $('<button class="page-btn">' + pageNum + '</button>');
        if (pageNum === currentSearchPage) $btn.addClass('active');
        $btn.on('click', function () { renderSearchPage(pageNum); });
        $wrap.append($btn);
      })(i);
    }

    // Next button
    var $next = $('<button class="page-btn">Next &raquo;</button>');
    if (currentSearchPage === totalPages) $next.prop('disabled', true);
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
  allSearchResults = [];
  currentSearchPage = 1;

  $('#search-results').empty();
  $('#search-results-wrap').addClass('hidden');
  $('#search-empty').addClass('hidden');
  $('#search-btn').prop('disabled', true).text('Searching...');
  $('#search-heading').text('Results for "' + query + '"');

  // Fetch 3 pages from TMDB to get up to 60 results
  var requests = [
    $.getJSON(TMDB_BASE + '/search/movie', { api_key: TMDB_API_KEY, query: query, page: 1 }),
    $.getJSON(TMDB_BASE + '/search/movie', { api_key: TMDB_API_KEY, query: query, page: 2 }),
    $.getJSON(TMDB_BASE + '/search/movie', { api_key: TMDB_API_KEY, query: query, page: 3 })
  ];

  $.when.apply($, requests).done(function (r1, r2, r3) {
    // Each response is [data, status, jqXHR]
    // When only one page of results exists, some responses may be the same structure
    var pages = [r1, r2, r3];
    pages.forEach(function (r) {
      var data = Array.isArray(r) ? r[0] : r;
      if (data && data.results) {
        allSearchResults = allSearchResults.concat(data.results);
      }
    });

    // Cap at 50 results per requirements
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

// Search button click
$('#search-btn').on('click', function () {
  var query = $('#search-input').val().trim();
  doSearch(query);
});

// Enter key in search input
$('#search-input').on('keydown', function (e) {
  if (e.key === 'Enter') {
    var query = $(this).val().trim();
    doSearch(query);
  }
});

// INIT — load popular movies on page load

$(document).ready(function () {
  loadPopular();
});
