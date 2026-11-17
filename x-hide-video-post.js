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

  var FOLLOW_CACHE = "data-x-follow";
  var FOLLOW_FOR = "data-x-follow-for";
  var PEEKING = "data-x-follow-peeking";
  var peekQueue = [];
  var peeking = false;

  // Hide is applied only after the follow check, so a blanket :has(video)
  // rule would also remove videos from accounts you follow. The peek
  // attribute hides the More menu while it is opened just long enough to read.
  var CSS =
    "[" + MARK + '="1"]{display:none !important;}' +
    'html[data-x-follow-peek] [role="menu"],' +
    'html[data-x-follow-peek] [data-slot="xds-menu-content"]{' +
    "visibility:hidden !important;pointer-events:none !important;}";

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
      if (nodes[i].closest('[role="menu"], [data-slot="xds-menu-content"]')) continue;
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
      if (nodes[i].closest('article, ul, aside, nav, [role="menu"], [data-slot="xds-menu-content"], [data-testid="cellInnerDiv"], [data-testid="sidebarColumn"]')) continue;
      var state = followState(nodes[i]);
      if (state) return state;
    }
    return null;
  }

  function outerArticle(root) {
    var articles = root.querySelectorAll("article");
    for (var i = 0; i < articles.length; i++) {
      var parentArticle = articles[i].parentElement && articles[i].parentElement.closest("article");
      if (!parentArticle || !root.contains(parentArticle)) return articles[i];
    }
    return null;
  }

  function statusKey(root) {
    var links = root.querySelectorAll('a[href*="/status/"]');
    for (var i = 0; i < links.length; i++) {
      var match = (links[i].getAttribute("href") || "").match(/\/status\/(\d+)/);
      if (match) return match[1];
    }
    return "";
  }

  function cachedFollow(root) {
    var cached = root.getAttribute(FOLLOW_CACHE);
    if (!cached) return null;
    var key = statusKey(root);
    var saved = root.getAttribute(FOLLOW_FOR) || "";
    if (key && saved && saved !== key) {
      root.removeAttribute(FOLLOW_CACHE);
      root.removeAttribute(FOLLOW_FOR);
      root.removeAttribute(PEEKING);
      return null;
    }
    return cached;
  }

  function rememberFollow(root, state) {
    root.setAttribute(FOLLOW_CACHE, state);
    var key = statusKey(root);
    if (key) root.setAttribute(FOLLOW_FOR, key);
  }

  // The post's More control. The opened menu is not in the post; it is
  // portaled to the end of the page and says "Follow @name" or "Unfollow @name".
  function moreButton(root, article) {
    var buttons = root.querySelectorAll(
      'button[aria-label="More"], button[aria-label="More options"], [data-testid="caret"]'
    );
    var fallback = null;
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      if (article) {
        var owner = button.closest("article");
        if (owner && owner !== article) continue;
      }
      if (button.closest('.aspect-video, [data-testid="videoPlayer"], [data-testid="videoComponent"]')) {
        if (!fallback) fallback = button;
        continue;
      }
      return button;
    }
    return fallback;
  }

  function itemFollow(el) {
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
    var blobs = aria && text && aria !== text ? [aria, text] : [aria || text];
    for (var i = 0; i < blobs.length; i++) {
      if (/^unfollow\b/i.test(blobs[i]) || /^following\b/i.test(blobs[i])) return "following";
      if (/^follow(?: back)?\b/i.test(blobs[i])) return "not-following";
    }
    return null;
  }

  function menuElement(button, allowFallback) {
    var id = button.getAttribute("aria-controls");
    if (id) {
      var byId = document.getElementById(id);
      if (byId) return byId;
    }
    if (!allowFallback) return null;
    var open = document.querySelectorAll('[role="menu"], [data-slot="xds-menu-content"]');
    return open.length ? open[open.length - 1] : null;
  }

  function readMenu(menu) {
    if (!menu) return null;
    var items = menu.querySelectorAll(
      '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [data-slot="xds-menu-item"]'
    );
    var state = null;
    for (var i = 0; i < items.length; i++) {
      var next = itemFollow(items[i]);
      if (next === "following") return "following";
      if (next === "not-following") state = "not-following";
    }
    if (!items.length) return null;
    return state || "unknown";
  }

  function closeMenu(button) {
    var eventInit = { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true };
    document.dispatchEvent(new KeyboardEvent("keydown", eventInit));
    document.dispatchEvent(new KeyboardEvent("keyup", eventInit));
    if (button.isConnected && button.getAttribute("aria-expanded") === "true") button.click();
  }

  function foreignMenuOpen(button) {
    var expanded = document.querySelectorAll('button[aria-expanded="true"], [data-testid="caret"][aria-expanded="true"]');
    for (var i = 0; i < expanded.length; i++) {
      if (expanded[i] !== button) return true;
    }
    var menus = document.querySelectorAll('[role="menu"], [data-slot="xds-menu-content"]');
    return menus.length > 0 && button.getAttribute("aria-expanded") !== "true";
  }

  function enqueuePeek(root, button) {
    if (root.getAttribute(PEEKING) === "1") return;
    for (var i = 0; i < peekQueue.length; i++) {
      if (peekQueue[i].root === root) return;
    }
    root.setAttribute(PEEKING, "1");
    peekQueue.push({ root: root, button: button });
    peekNext();
  }

  function finishPeek(root, state) {
    root.removeAttribute(PEEKING);
    if (state) rememberFollow(root, state);
    peeking = false;
    document.documentElement.removeAttribute("data-x-follow-peek");
    schedule();
    setTimeout(peekNext, 60);
  }

  function peekNext() {
    if (peeking) return;
    var job = peekQueue.shift();
    if (!job) return;
    var root = job.root;
    var button = job.button;
    if (!root.isConnected || !button.isConnected) {
      if (root.isConnected) root.removeAttribute(PEEKING);
      peekNext();
      return;
    }
    var ready = readMenu(menuElement(button, false));
    if (ready) {
      finishPeek(root, ready);
      return;
    }
    if (foreignMenuOpen(button)) {
      peekQueue.push(job);
      setTimeout(peekNext, 400);
      return;
    }
    peeking = true;
    document.documentElement.setAttribute("data-x-follow-peek", "1");
    try {
      button.click();
    } catch (e) {
      finishPeek(root, "unknown");
      return;
    }
    var tries = 0;
    function attempt() {
      if (!button.isConnected) {
        finishPeek(root, null);
        return;
      }
      var state = readMenu(menuElement(button, true));
      tries++;
      if (!state && tries < 10) {
        setTimeout(attempt, 40);
        return;
      }
      closeMenu(button);
      finishPeek(root, state || "unknown");
    }
    setTimeout(attempt, 40);
  }

  function shouldHide(root) {
    var article = outerArticle(root);
    var onPost = controlsIn(root, article);
    if (onPost === "following") return false;
    if (onPost === "not-following") return true;
    var cached = cachedFollow(root);
    if (cached === "following") return false;
    if (cached === "not-following") return true;
    // Home posts omit the visible Follow button. The More menu still says
    // Follow or Unfollow, so read that once before deciding to keep the video.
    if (cached !== "unknown") {
      var button = moreButton(root, article);
      if (button) {
        enqueuePeek(root, button);
        return false;
      }
    }
    var onPage = pageFollowState();
    if (onPage === "following") return false;
    if (onPage === "not-following") return true;
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
