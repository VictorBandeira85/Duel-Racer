package com.duelracer.game;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import java.io.OutputStream;

// Ponte do jogo (modo foto, src/overlay.ts) com o Android: grava a foto na galeria (Imagens/DuelRacer)
// e abre o compartilhar do sistema. Só Android 10 ou mais novo (MediaStore sem pedir permissão); nos
// mais velhos devolve o aviso e o jogo deixa a foto à mostra para segurar e salvar.
public class ShareBridge {
  private final Activity act;
  ShareBridge(Activity a) { act = a; }

  private Uri store(String b64, String name) throws Exception {
    if (Build.VERSION.SDK_INT < 29) return null;
    byte[] png = Base64.decode(b64, Base64.DEFAULT);
    ContentResolver cr = act.getContentResolver();
    ContentValues v = new ContentValues();
    v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
    v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
    v.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/DuelRacer");
    Uri uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
    if (uri == null) return null;
    try (OutputStream o = cr.openOutputStream(uri)) { o.write(png); }
    return uri;
  }

  // "" = deu certo; senão o aviso para mostrar
  @JavascriptInterface
  public String saveImage(String b64, String name) {
    try {
      return store(b64, name) != null ? "" : "Este Android não deixa salvar daqui: segure na foto.";
    } catch (Exception e) {
      return "Não deu para salvar: " + e.getMessage();
    }
  }

  @JavascriptInterface
  public String shareImage(String b64, String name) {
    try {
      final Uri uri = store(b64, name);
      if (uri == null) return "Este Android não deixa compartilhar daqui: segure na foto.";
      act.runOnUiThread(() -> {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("image/png");
        i.putExtra(Intent.EXTRA_STREAM, uri);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        act.startActivity(Intent.createChooser(i, "Compartilhar foto"));
      });
      return "";
    } catch (Exception e) {
      return "Não deu para compartilhar: " + e.getMessage();
    }
  }
}
