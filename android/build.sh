#!/bin/bash
# APK para Android (WebView com o jogo dentro, funciona sem internet).
# Uso: ANDROID_HOME=<sdk com platforms;android-34 e build-tools;34.0.0> bash android/build.sh
# Gera android/out/DuelRacer-<versão>.apk (assinado com android/key.jks, que não vai para o git:
# a mesma chave permite instalar versões novas por cima, sem perder o progresso).
set -e
cd "$(dirname "$0")/.."
V=$(node -p "require('./package.json').version")
BT=$ANDROID_HOME/build-tools/34.0.0; JAR=$ANDROID_HOME/platforms/android-34/android.jar
npm run build
O=android/out; rm -rf $O; mkdir -p $O/assets $O/classes
cp -r dist $O/assets/www; rm -f $O/assets/www/sw.js
CODE=$(echo $V | awk -F. '{print $1*10000+$2*100+$3}')
sed "s/android:versionCode=\"[0-9]*\"/android:versionCode=\"$CODE\"/; s/android:versionName=\"[^\"]*\"/android:versionName=\"$V\"/" android/AndroidManifest.xml > $O/AndroidManifest.xml
$BT/aapt2 compile --dir android/res -o $O/res.zip
$BT/aapt2 link -o $O/base.apk -I $JAR --manifest $O/AndroidManifest.xml $O/res.zip -A $O/assets --java $O/gen -0 mp3 -0 png
javac -source 8 -target 8 -cp $JAR -d $O/classes android/src/com/duelracer/game/*.java $O/gen/com/duelracer/game/R.java
$BT/d8 --release --min-api 24 --lib $JAR --output $O $(find $O/classes -name '*.class')
cp $O/base.apk $O/unsigned.apk && zip -q -j $O/unsigned.apk $O/classes.dex
$BT/zipalign -f -p 4 $O/unsigned.apk $O/aligned.apk
$BT/apksigner sign --ks android/key.jks --ks-pass env:KS_PASS --key-pass env:KS_PASS --out $O/DuelRacer-$V.apk $O/aligned.apk
echo "$O/DuelRacer-$V.apk"
