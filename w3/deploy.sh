#!/bin/bash
cd `dirname $0`

HTML=assets/index.html
APP=$(basename `pwd`)

TARGET=../../servers/croquet-io-dev
CROQUET=../libraries/packages/croquet

# check out a clean @croquet/croquet package
(cd $CROQUET ; npm run clean)

rm -f $TARGET/$APP/*
npx parcel build $HTML -d $TARGET/$APP/ -o index.html --public-url . || exit

# commit to git
git add -A $TARGET/$APP
git commit -m "[$APP] deploy to croquet.io/dev" $TARGET/$APP || exit
git --no-pager show --stat

echo
echo "You still need to"
echo "    git push"
echo "to deploy to https://croquet.io/dev/$APP/"
