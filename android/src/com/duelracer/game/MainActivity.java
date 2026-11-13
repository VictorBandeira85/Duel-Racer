package com.duelracer.game;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.InputStream;

// Duel Racer para Android: o jogo (a mesma versão web) roda numa WebView, servido das próprias
// assets do app num endereço https (os módulos JS e o áudio funcionam como no navegador, sem internet)
public class MainActivity extends Activity {
  private WebView web;

  @Override
  protected void onCreate(Bundle b) {
    super.onCreate(b);
    requestWindowFeature(Window.FEATURE_NO_TITLE);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
    web = new WebView(this);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setAllowFileAccess(false);
    s.setLoadWithOverviewMode(true);
    s.setUseWideViewPort(true);
    s.setTextZoom(100);
    web.setBackgroundColor(0xff000000);
    web.setOverScrollMode(View.OVER_SCROLL_NEVER);
    web.setWebViewClient(new AssetClient(this));
    setContentView(web);
    immersive();
    if (b != null) web.restoreState(b);
    else web.loadUrl(AssetClient.HOST + "index.html");
  }

  private void immersive() {
    if (Build.VERSION.SDK_INT >= 28)
      getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
      | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
      | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
  }

  @Override
  public void onWindowFocusChanged(boolean f) {
    super.onWindowFocusChanged(f);
    if (f) immersive();
  }

  // botões do controle (gamepad): a WebView entrega ao jogo pela Gamepad API; aqui só não deixamos o
  // Android transformar um botão que ninguém tratou em outra tecla (o B virava VOLTAR = Esc, e
  // pausava a corrida no meio de uma freada)
  @Override
  public boolean dispatchKeyEvent(KeyEvent e) {
    int src = e.getSource();
    boolean pad = KeyEvent.isGamepadButton(e.getKeyCode())
      || (src & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
      || (src & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK;
    if (pad && e.getKeyCode() != KeyEvent.KEYCODE_BACK) {
      super.dispatchKeyEvent(e);
      return true;
    }
    return super.dispatchKeyEvent(e);
  }

  // voltar do Android = tecla Esc do jogo (pausa na corrida, volta nos menus)
  @Override
  public void onBackPressed() {
    web.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true}));"
      + "window.dispatchEvent(new KeyboardEvent('keyup',{code:'Escape',key:'Escape',bubbles:true}));", null);
  }

  @Override
  protected void onPause() {
    super.onPause();
    web.onPause();
  }

  @Override
  protected void onResume() {
    super.onResume();
    web.onResume();
    immersive();
  }

  @Override
  protected void onSaveInstanceState(Bundle o) {
    super.onSaveInstanceState(o);
    web.saveState(o);
  }
}
