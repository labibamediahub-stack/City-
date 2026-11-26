/**
 * Zero-UI Native Android Bridge for Capacitor WebView
 * Runs ONLY inside the packaged Android APK (www/index.html).
 * Leaves the original website UI, buttons, colors, and workflow 100% unchanged.
 */
(function () {
  if (typeof window === 'undefined') return;
  if (window.__CINECRAFT_ANDROID_BRIDGE_INSTALLED__) return;
  window.__CINECRAFT_ANDROID_BRIDGE_INSTALLED__ = true;

  var cloudBase = (window.__ANDROID_CLOUD_API_BASE__ || '').replace(/\/+$/, '');

  // 1. Transparent Cloud API Routing for relative /api/* requests
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      if (cloudBase) {
        if (typeof input === 'string' && input.startsWith('/api/')) {
          return nativeFetch(cloudBase + input, init);
        }
        if (input instanceof Request) {
          var reqUrl = input.url || '';
          var sameOriginPrefix = window.location.origin + '/api/';
          if (reqUrl.startsWith(sameOriginPrefix)) {
            var targetUrl = cloudBase + reqUrl.slice(window.location.origin.length);
            var cloned = new Request(targetUrl, input);
            return nativeFetch(cloned, init);
          }
        }
      }
    } catch (err) {
      console.warn('[AndroidBridge] fetch route fallback:', err);
    }
    return nativeFetch(input, init);
  };

  // 2. Native Android Download Interceptor for blob: and data: <a download> exports
  function saveBlobToNativeDownloads(blob, filename) {
    var nativeBridge = window.NativeAndroidBridge;
    if (!nativeBridge || typeof nativeBridge.beginFileWrite !== 'function') {
      return false;
    }

    var safeName = (filename || 'cinecraft_export_' + Date.now()).replace(/[^a-zA-Z0-9._-]/g, '_');
    var mimeType = blob.type || 'application/octet-stream';
    var transferId = 'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    try {
      nativeBridge.beginFileWrite(transferId, safeName, mimeType);
      var chunkSize = 512 * 1024; // 512 KB low-memory chunks
      var offset = 0;

      function nextChunk() {
        if (offset >= blob.size) {
          nativeBridge.finishFileWrite(transferId, safeName, mimeType);
          // Optional post-export Interstitial Ad hook (zero UI change)
          try {
            if (typeof nativeBridge.notifyExportCompleted === 'function') {
              nativeBridge.notifyExportCompleted();
            }
          } catch (_) {}
          return;
        }
        var slice = blob.slice(offset, offset + chunkSize);
        var reader = new FileReader();
        reader.onloadend = function () {
          try {
            var res = String(reader.result || '');
            var commaIdx = res.indexOf(',');
            var base64Chunk = commaIdx >= 0 ? res.slice(commaIdx + 1) : res;
            nativeBridge.appendFileChunk(transferId, base64Chunk);
            offset += chunkSize;
            setTimeout(nextChunk, 0);
          } catch (chunkErr) {
            console.error('[AndroidBridge] chunk write failed:', chunkErr);
            nativeBridge.abortFileWrite(transferId);
          }
        };
        reader.onerror = function () {
          nativeBridge.abortFileWrite(transferId);
        };
        reader.readAsDataURL(slice);
      }

      nextChunk();
      return true;
    } catch (err) {
      console.error('[AndroidBridge] native download error:', err);
      return false;
    }
  }

  document.addEventListener(
    'click',
    function (event) {
      var target = event.target;
      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }
      if (!target || !target.hasAttribute('download')) return;

      var href = target.getAttribute('href') || '';
      var filename = target.getAttribute('download') || 'cinecraft_file';
      if (!href.startsWith('blob:') && !href.startsWith('data:')) return;

      if (!window.NativeAndroidBridge) return;
      event.preventDefault();
      event.stopPropagation();

      nativeFetch(href)
        .then(function (r) {
          return r.blob();
        })
        .then(function (blob) {
          saveBlobToNativeDownloads(blob, filename);
        })
        .catch(function (err) {
          console.error('[AndroidBridge] failed resolving download href:', err);
        });
    },
    true
  );

  // Intercept programmatic anchor.click() used by React export buttons (e.g. a.href = blobUrl; a.click())
  var origAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    try {
      if (
        window.NativeAndroidBridge &&
        this.hasAttribute('download') &&
        this.href &&
        (this.href.startsWith('blob:') || this.href.startsWith('data:'))
      ) {
        var dlName = this.getAttribute('download') || 'cinecraft_export';
        nativeFetch(this.href)
          .then(function (r) {
            return r.blob();
          })
          .then(function (blob) {
            saveBlobToNativeDownloads(blob, dlName);
          })
          .catch(function (err) {
            console.error('[AndroidBridge] programmatic download failed:', err);
          });
        return;
      }
    } catch (err) {
      console.warn('[AndroidBridge] anchor.click fallback:', err);
    }
    return origAnchorClick.apply(this, arguments);
  };
})();
