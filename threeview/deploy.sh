#!/bin/bash
cd `dirname "$0"`
APP=$(basename `pwd`)

# build this
rm -rf dist
npm run build || exit 1

# copy to croquet.io/dev/
TARGET=../../servers/croquet-io-dev/$APP
rm -rf $TARGET/*
cp -a dist/ $TARGET/

# commit
(cd $TARGET && git add . && git commit -m "[$APP] deploy to croquet.io/dev/$APP/" -- . && git --no-pager log -1 --stat)
