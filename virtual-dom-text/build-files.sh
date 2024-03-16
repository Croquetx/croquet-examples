#!/bin/sh

rm -rf dist
mkdir -p dist/meta dist/apps

git log --no-walk|grep -v '^Author' |head -2 |tr '\n' ' ' > dist/meta/version.txt
cp -rp ./widgets ./index.html ./example.html ./text.js ./text.css ./apiKey.js ./assets dist/

cat index.html |\
    sed 's:\.\/:\.\.\/:g' |\
    sed 's:window._root[ ]*=.*$:window._root="..";:' > dist/apps/index.html

cat example.html |\
    sed 's:\.\/:\.\.\/:g' |\
    sed 's:window._root[ ]*=.*$:window._root="..";:' > dist/apps/example.html
