#!/bin/bash
cd `dirname $0`

APP=$(basename `pwd`)
HTML=src/index.html

TARGET=../../servers/croquet-io-dev

# work around our failure to understand parcel
rm -rf .parcel-cache

npx parcel build $HTML --dist-dir $TARGET/$APP/ --public-url . || exit

# commit to git
git add -A $TARGET/$APP
git commit -m "[$APP] deploy to croquet.io/dev" $TARGET/$APP || exit
git --no-pager show --stat

echo
echo "You still need to"
echo "    git push"
echo "to deploy to https://croquet.io/dev/$APP/"
