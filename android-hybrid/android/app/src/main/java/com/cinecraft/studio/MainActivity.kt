package com.cinecraft.studio

import android.Manifest
import android.content.ContentValues
import android.content.pm.PackageManager
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.BridgeActivity
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.concurrent.ConcurrentHashMap

class MainActivity : BridgeActivity() {

    private val mediaPermissionCode = 4091
    private var bannerView: AdView? = null
    private var interstitialAd: InterstitialAd? = null
    private var lastInterstitialShownAt = 0L

    private data class ActiveTransfer(
        val tempFile: File,
        val output: BufferedOutputStream
    )

    private val activeTransfers = ConcurrentHashMap<String, ActiveTransfer>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        requestRequiredMediaAndAudioPermissions()
        configureWebViewForMediaProcessing()
        initializeAdMobAndBanner()
    }

    override fun onResume() {
        super.onResume()
        bannerView?.resume()
    }

    override fun onPause() {
        bannerView?.pause()
        super.onPause()
    }

    override fun onDestroy() {
        bannerView?.destroy()
        for ((_, transfer) in activeTransfers) {
            try {
                transfer.output.close()
                transfer.tempFile.delete()
            } catch (_: Exception) {
            }
        }
        activeTransfers.clear()
        super.onDestroy()
    }

    private fun requestRequiredMediaAndAudioPermissions() {
        val needed = mutableListOf<String>()
        needed.add(Manifest.permission.RECORD_AUDIO)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            needed.add(Manifest.permission.READ_MEDIA_VIDEO)
            needed.add(Manifest.permission.READ_MEDIA_IMAGES)
            needed.add(Manifest.permission.READ_MEDIA_AUDIO)
        } else {
            needed.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.Q) {
                needed.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
        }

        val missing = needed.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), mediaPermissionCode)
        }
    }

    private fun configureWebViewForMediaProcessing() {
        val webView = bridge?.webView ?: return
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        val settings = webView.settings
        settings.mediaPlaybackRequiresUserGesture = false
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true

        // Allow WebAudio microphone capture after Android runtime permission is granted
        val baseChromeClient = webView.webChromeClient
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                runOnUiThread {
                    if (request != null) {
                        request.grant(request.resources)
                    }
                }
            }

            override fun onShowFileChooser(
                webView: android.webkit.WebView?,
                filePathCallback: android.webkit.ValueCallback<Array<android.net.Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                return baseChromeClient?.onShowFileChooser(webView, filePathCallback, fileChooserParams)
                    ?: super.onShowFileChooser(webView, filePathCallback, fileChooserParams)
            }
        }

        webView.addJavascriptInterface(NativeDownloadAndAdBridge(), "NativeAndroidBridge")
    }

    private fun initializeAdMobAndBanner() {
        MobileAds.initialize(this) {
            runOnUiThread {
                attachNonIntrusiveBottomBanner()
                preloadInterstitialAd()
            }
        }
    }

    private fun attachNonIntrusiveBottomBanner() {
        val rootLayout = findViewById<ViewGroup>(android.R.id.content) ?: return
        if (bannerView != null) return

        val adUnitId = getString(R.string.admob_banner_unit_id)
        if (adUnitId.isBlank()) return

        val adView = AdView(this).apply {
            setAdSize(AdSize.BANNER)
            this.adUnitId = adUnitId
        }
        val params = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
        )
        rootLayout.addView(adView, params)
        bannerView = adView
        adView.loadAd(AdRequest.Builder().build())
    }

    private fun preloadInterstitialAd() {
        val adUnitId = getString(R.string.admob_interstitial_unit_id)
        if (adUnitId.isBlank()) return

        InterstitialAd.load(
            this,
            adUnitId,
            AdRequest.Builder().build(),
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    interstitialAd = ad
                    ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                        override fun onAdDismissedFullScreenContent() {
                            interstitialAd = null
                            preloadInterstitialAd()
                        }
                    }
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    interstitialAd = null
                }
            }
        )
    }

    private fun maybeShowPostExportInterstitial() {
        val now = System.currentTimeMillis()
        if (now - lastInterstitialShownAt < 90_000L) return
        val ad = interstitialAd ?: return
        lastInterstitialShownAt = now
        ad.show(this)
    }

    private fun saveTempFileToPublicDownloads(tempFile: File, filename: String, mimeType: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, filename)
                put(MediaStore.Downloads.MIME_TYPE, mimeType)
                put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/CineCraft")
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val resolver = contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("Could not create MediaStore entry")

            resolver.openOutputStream(uri)?.use { out ->
                FileInputStream(tempFile).use { input ->
                    input.copyTo(out, bufferSize = 64 * 1024)
                }
            }
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
        } else {
            @Suppress("DEPRECATION")
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val appDir = File(downloadsDir, "CineCraft").apply { mkdirs() }
            val destFile = File(appDir, filename)
            FileInputStream(tempFile).use { input ->
                FileOutputStream(destFile).use { out ->
                    input.copyTo(out, bufferSize = 64 * 1024)
                }
            }
            MediaScannerConnection.scanFile(this, arrayOf(destFile.absolutePath), arrayOf(mimeType), null)
        }
    }

    inner class NativeDownloadAndAdBridge {
        @JavascriptInterface
        fun beginFileWrite(transferId: String, filename: String, mimeType: String) {
            val tempFile = File(cacheDir, "dl_$transferId.tmp")
            val stream = BufferedOutputStream(FileOutputStream(tempFile), 64 * 1024)
            activeTransfers[transferId] = ActiveTransfer(tempFile, stream)
        }

        @JavascriptInterface
        fun appendFileChunk(transferId: String, base64Chunk: String) {
            val transfer = activeTransfers[transferId] ?: return
            val decoded = Base64.decode(base64Chunk, Base64.DEFAULT)
            transfer.output.write(decoded)
        }

        @JavascriptInterface
        fun finishFileWrite(transferId: String, filename: String, mimeType: String) {
            val transfer = activeTransfers.remove(transferId) ?: return
            try {
                transfer.output.flush()
                transfer.output.close()
                saveTempFileToPublicDownloads(transfer.tempFile, filename, mimeType)
                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "Saved to Downloads/CineCraft/$filename",
                        Toast.LENGTH_LONG
                    ).show()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "Download error: ${e.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            } finally {
                transfer.tempFile.delete()
            }
        }

        @JavascriptInterface
        fun abortFileWrite(transferId: String) {
            val transfer = activeTransfers.remove(transferId) ?: return
            try {
                transfer.output.close()
            } catch (_: Exception) {
            }
            transfer.tempFile.delete()
        }

        @JavascriptInterface
        fun notifyExportCompleted() {
            runOnUiThread {
                maybeShowPostExportInterstitial()
            }
        }
    }
}
