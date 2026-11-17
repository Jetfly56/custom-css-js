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

  // Hide is applied only after the follow check, so a blanket :has(video)
  // rule would also remove videos from accounts you follow.
  var CSS = "[" + MARK + '="1"]{display:none !important;}';

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

  // "Follow" / "Follow @name" means you do not follow them.
  // "Following" / "Unfollow @name" means you do. Follower counts
  // ("1 Following", "60.6M Followers") are links, not this control.
  function followState(el) {
    var href = el.getAttribute("href") || "";
    if (/\/followers?\b|\/following\b|\/verified_followers\b/i.test(href)) return null;
    var testid = el.getAttribute("data-testid") || "";
    if (/-unfollow$/.test(testid)) return "following";
    if (/-follow$/.test(testid)) return "not-following";
    var icon = el.querySelector("[data-icon]");
    var iconName = icon ? icon.getAttribute("data-icon") || "" : "";
    if (iconName === "icon-person-following-fill") return "following";
    if (iconName === "icon-person-follow") return "not-following";
    var aria = (el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    var text = "";
    try {
      text = el.innerText;
    } catch (e) {}
    if (!text) {
      try {
        text = el.textContent || "";
      } catch (e2) {}
    }
    text = String(text).replace(/\s+/g, " ").trim();
    if (/^following\b/i.test(aria) || /^unfollow\b/i.test(aria)) return "following";
    if (/^follow(?: back)?(?: @|$)/i.test(aria)) return "not-following";
    if (/^following$/i.test(text) || /^unfollow$/i.test(text)) return "following";
    if (/^follow(?: back)?$/i.test(text)) return "not-following";
    return null;
  }

  function controlsIn(scope, article) {
    var nodes = scope.querySelectorAll('button, a[aria-label], [role="button"]');
    var state = null;
    for (var i = 0; i < nodes.length; i++) {
      if (article) {
        var owner = nodes[i].closest("article");
        if (owner && owner !== article) continue;
      }
      var next = followState(nodes[i]);
      if (next === "following") return "following";
      if (next === "not-following") state = "not-following";
    }
    return state;
  }

  // A profile page puts Follow/Following in the header, not on each post.
  function pageFollowState() {
    var main = document.querySelector("main") || document.body;
    var nodes = main.querySelectorAll('button, a[aria-label], [role="button"]');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].closest('article, ul, aside, nav, [data-testid="cellInnerDiv"], [data-testid="sidebarColumn"]')) continue;
      var state = followState(nodes[i]);
      if (state) return state;
    }
    return null;
  }

  function shouldHide(root) {
    var articles = root.querySelectorAll("article");
    var article = null;
    for (var i = 0; i < articles.length; i++) {
      var parentArticle = articles[i].parentElement && articles[i].parentElement.closest("article");
      if (!parentArticle || !root.contains(parentArticle)) {
        article = articles[i];
        break;
      }
    }
    var onPost = controlsIn(root, article);
    if (onPost === "following") return false;
    if (onPost === "not-following") return true;
    var onPage = pageFollowState();
    if (onPage === "following") return false;
    if (onPage === "not-following") return true;
    // Home timeline posts from accounts you follow have no Follow button.
    return false;
  }

  function refresh() {
    ensureStyle();
    var roots = [];
    var nodes = document.querySelectorAll(FIND);
    for (var i = 0; i < nodes.length; i++) {
      var root = rootFor(nodes[i]);
      if (roots.indexOf(root) === -1 && shouldHide(root)) roots.push(root);
    }
    var marked = document.querySelectorAll("[" + MARK + "]");
    for (var j = 0; j < marked.length; j++) {
      if (roots.indexOf(marked[j]) === -1) marked[j].removeAttribute(MARK);
    }
    for (var k = 0; k < roots.length; k++) {
      if (roots[k].getAttribute(MARK) !== "1") roots[k].setAttribute(MARK, "1");
      var clips = roots[k].querySelectorAll("video");
      for (var n = 0; n < clips.length; n++) pause(clips[n]);
    }
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
        var video = event.target;
        if (video && video.tagName === "VIDEO" && video.closest("[" + MARK + "]")) pause(video);
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
