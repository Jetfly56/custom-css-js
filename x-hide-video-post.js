(function () {
  if (window.__xHideVideoPosts) return;
  window.__xHideVideoPosts = true;

  var MARK = "data-x-video-hidden";
  var STYLE_ID = "x-hide-video-style";
  var VIDEO_URL = /ext_tw_video|amplify_video|tweet_video|video\.twimg\.com/i;
  var FIND = [
    "video",
    '[data-testid="videoPlayer"]',
    '[data-testid="videoComponent"]',
    'img[src*="ext_tw_video"]',
    'img[src*="amplify_video"]',
    'img[src*="tweet_video"]',
    'img[srcset*="ext_tw_video"]',
    'img[srcset*="amplify_video"]',
    'img[srcset*="tweet_video"]',
    'source[src*="ext_tw_video"]',
    'source[src*="amplify_video"]',
    'source[src*="tweet_video"]',
    '[style*="ext_tw_video"]',
    '[style*="amplify_video"]',
    '[style*="tweet_video"]',
    ".aspect-video button[aria-label]",
    '[data-testid="tweetPhoto"] button[aria-label]'
  ].join(",");

  // Current x.com posts are <li><article> and the player is a <video> or a
  // poster image. Older x.com used cellInnerDiv / videoPlayer. Hide the row
  // for either shape. :has() covers posts added after this script runs.
  var CSS = [
    "[" + MARK + '="1"]',
    '[data-testid="cellInnerDiv"]:has(video)',
    '[data-testid="cellInnerDiv"]:has([data-testid="videoPlayer"])',
    '[data-testid="cellInnerDiv"]:has([data-testid="videoComponent"])',
    '[data-testid="cellInnerDiv"]:has(img[src*="ext_tw_video"])',
    '[data-testid="cellInnerDiv"]:has(img[src*="amplify_video"])',
    '[data-testid="cellInnerDiv"]:has(img[src*="tweet_video"])',
    "li:has(article):has(video)",
    'li:has(article):has([data-testid="videoPlayer"])',
    'li:has(article):has([data-testid="videoComponent"])',
    'li:has(article):has(img[src*="ext_tw_video"])',
    'li:has(article):has(img[src*="amplify_video"])',
    'li:has(article):has(img[src*="tweet_video"])',
    'li:has(article):has([style*="ext_tw_video"])',
    'li:has(article):has([style*="amplify_video"])',
    'li:has(article):has([style*="tweet_video"])',
    "li:has(article):has(.aspect-video button[aria-label])",
    "article:not(li article):has(video)",
    'article:not(li article):has([data-testid="videoPlayer"])',
    'article:not(li article):has([data-testid="videoComponent"])',
    'article:not(li article):has(img[src*="ext_tw_video"])',
    'article:not(li article):has(img[src*="amplify_video"])',
    'article:not(li article):has(img[src*="tweet_video"])',
    "article:not(li article):has(.aspect-video button[aria-label])"
  ].join(",") + "{display:none !important;}";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function rootFor(el) {
    var cell = el.closest('[data-testid="cellInnerDiv"]');
    if (cell) return cell;
    var article = el.closest("article");
    if (article) {
      var li = article.closest("li");
      if (li) return li;
      var top = article;
      var outer = top.parentElement && top.parentElement.closest("article");
      while (outer) {
        top = outer;
        outer = top.parentElement && top.parentElement.closest("article");
      }
      return top;
    }
    return el.closest(".aspect-video") || el;
  }

  function pause(video) {
    try {
      video.pause();
    } catch (e) {}
  }

  function refresh() {
    ensureStyle();
    var roots = [];
    var nodes = document.querySelectorAll(FIND);
    for (var i = 0; i < nodes.length; i++) {
      var root = rootFor(nodes[i]);
      if (roots.indexOf(root) === -1) roots.push(root);
    }
    var marked = document.querySelectorAll("[" + MARK + "]");
    for (var j = 0; j < marked.length; j++) {
      if (roots.indexOf(marked[j]) === -1) marked[j].removeAttribute(MARK);
    }
    for (var k = 0; k < roots.length; k++) {
      if (roots[k].getAttribute(MARK) !== "1") roots[k].setAttribute(MARK, "1");
    }
    var videos = document.getElementsByTagName("video");
    for (var n = 0; n < videos.length; n++) pause(videos[n]);
  }

  var timer = 0;
  function schedule() {
    if (timer) return;
    timer = setTimeout(function () {
      timer = 0;
      try {
        refresh();
      } catch (e) {}
    }, 50);
  }

  function start() {
    ensureStyle();
    refresh();
    document.addEventListener(
      "play",
      function (event) {
        if (event.target && event.target.tagName === "VIDEO") pause(event.target);
      },
      true
    );
    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
          var target = mutation.target;
          if (target && target.getAttribute && VIDEO_URL.test(target.getAttribute("style") || "")) {
            schedule();
            return;
          }
          continue;
        }
        schedule();
        return;
      }
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcset", "poster", "style", "aria-label", "data-testid"]
    });
  }

  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
