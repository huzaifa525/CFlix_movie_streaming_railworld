#!/bin/bash
# Builds mac/build/CFlix.app and a zip of it to share
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=mac/build
APP="$OUT/CFlix.app"
SITE="$APP/Contents/Resources/site"

rm -rf "$APP" "$OUT/CFlix.zip" "$OUT/CFlix.dmg" "$OUT/AppIcon.iconset"
mkdir -p "$APP/Contents/MacOS" "$SITE/netflix-images"

# One binary that runs on both Apple silicon and Intel Macs
for arch in arm64 x86_64; do
    swiftc -O -swift-version 5 -target "$arch-apple-macos13.0" mac/Sources/main.swift -o "$OUT/CFlix-$arch"
done
lipo -create "$OUT/CFlix-arm64" "$OUT/CFlix-x86_64" -output "$APP/Contents/MacOS/CFlix"
rm "$OUT/CFlix-arm64" "$OUT/CFlix-x86_64"

cp mac/Info.plist "$APP/Contents/Info.plist"
cp ./*.html "$SITE/"
cp -R src "$SITE/"
cp netflix-images/prime-logo.png "$SITE/netflix-images/"

# The logo isn't square, so pad it before making the icon sizes
ICONSET="$OUT/AppIcon.iconset"
mkdir -p "$ICONSET"
sips --padToHeightWidth 940 940 --padColor 141414 netflix-images/prime-logo.png --out "$OUT/icon-square.png" >/dev/null
for size in 16 32 128 256 512; do
    sips -z "$size" "$size" "$OUT/icon-square.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
    sips -z $((size * 2)) $((size * 2)) "$OUT/icon-square.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"
rm -rf "$ICONSET" "$OUT/icon-square.png"

# EasyList and EasyPrivacy, refreshed on every build. The last download is
# kept, so a build without internet still blocks ads.
FILTERS="$OUT/filters"
mkdir -p "$FILTERS"
for list in easylist easyprivacy; do
    if curl -fsSL --max-time 60 "https://easylist.to/easylist/$list.txt" -o "$FILTERS/$list.download"; then
        mv "$FILTERS/$list.download" "$FILTERS/$list.txt"
    else
        rm -f "$FILTERS/$list.download"
        echo "Couldn't download $list, using the last copy" >&2
    fi
done
LISTS=(mac/blocklists/custom.txt)
for list in easylist easyprivacy; do
    [ -f "$FILTERS/$list.txt" ] && LISTS+=("$FILTERS/$list.txt")
done
python3 -I mac/tools/blocklist.py "$APP/Contents/Resources/blocklists" "$SITE" "${LISTS[@]}"

codesign --force --sign - "$APP"
ditto -c -k --keepParent "$APP" "$OUT/CFlix.zip"

# Disk image with the usual drag-to-Applications layout, for sending to others
STAGE="$OUT/dmg"
rm -rf "$STAGE" "$OUT/CFlix.dmg"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname CFlix -srcfolder "$STAGE" -ov -format UDZO "$OUT/CFlix.dmg" >/dev/null
rm -rf "$STAGE"

echo "Built $APP"
