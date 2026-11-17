new MutationObserver(() => {
  document.querySelectorAll('[data-testid="cellInnerDiv"]').forEach(c => {
    if (c.querySelector('[data-testid="videoPlayer"], video')) c.style.display = 'none';
  });
}).observe(document.body, { childList: true, subtree: true });
