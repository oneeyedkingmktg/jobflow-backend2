(function () {
  'use strict';

  // Read company ID and base URL from this script tag's own src
  var script = document.currentScript || (function () {
    var tags = document.getElementsByTagName('script');
    return tags[tags.length - 1];
  })();

  var scriptUrl = new URL(script.src);
  var BASE_URL = scriptUrl.origin;
  var company = scriptUrl.searchParams.get('company');

  if (!company) return;

  function createEmbed() {
    // Build iframe src with UTM passthrough from the host page
    var src = new URL(BASE_URL);
    src.searchParams.set('company', company);

    var utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    var pageParams = new URLSearchParams(window.location.search);
    utmKeys.forEach(function (k) {
      var v = pageParams.get(k) || sessionStorage.getItem('cp360_' + k);
      if (v) src.searchParams.set(k, v);
    });

    // Create iframe and inject it right where this script tag sits in the page
    var iframe = document.createElement('iframe');
    iframe.src = src.toString();
    iframe.width = '100%';
    iframe.height = '600';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    iframe.style.cssText = 'border:0; border-radius:14px; display:block; width:100%;';
    script.parentNode.insertBefore(iframe, script.nextSibling);

    // Listen for messages from the estimator
    window.addEventListener('message', function (e) {
      if (!e.data) return;

      // Auto-height: resize iframe to match estimator content
      if (e.data.cp360Height) {
        iframe.style.height = e.data.cp360Height + 'px';
        return;
      }

      // Conversion pixel
      if (e.data.event === 'estimator_conversion' && e.data.microsoftEventCode) {
        try { new Function(e.data.microsoftEventCode)(); } catch (err) {}
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createEmbed);
  } else {
    createEmbed();
  }
})();
