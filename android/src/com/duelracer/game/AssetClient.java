package com.duelracer.game;

import android.app.Activity;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.InputStream;

// serve os arquivos do jogo (assets/www) num endereço https falso: módulos JS e áudio funcionam
public class AssetClient extends WebViewClient {
  static final String HOST = "https://appassets.duelracer/";
  private final Activity act;

  public AssetClient(Activity a) {
    act = a;
  }

  @Override
  public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
    String url = req.getUrl().toString();
    if (!url.startsWith(HOST)) return null;
    String path = url.substring(HOST.length());
    int q = path.indexOf('?');
    if (q >= 0) path = path.substring(0, q);
    if (path.length() == 0) path = "index.html";
    String m = mime(path);
    try {
      InputStream in = act.getAssets().open("www/" + Uri.decode(path));
      return new WebResourceResponse(m, m.startsWith("text") || path.endsWith(".js") ? "utf-8" : null, in);
    } catch (Exception e) {
      return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
    }
  }

  static String mime(String p) {
    if (p.endsWith(".html")) return "text/html";
    if (p.endsWith(".js")) return "application/javascript";
    if (p.endsWith(".css")) return "text/css";
    if (p.endsWith(".png")) return "image/png";
    if (p.endsWith(".mp3")) return "audio/mpeg";
    if (p.endsWith(".woff2")) return "font/woff2";
    if (p.endsWith(".woff")) return "font/woff";
    if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
    if (p.endsWith(".svg")) return "image/svg+xml";
    return "application/octet-stream";
  }
}
