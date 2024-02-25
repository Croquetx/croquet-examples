#!/bin/sh

. ./build-files.sh

DIR=../../servers/croquet-io-dev/broadcaster

if [ "$1" != "" ]
then
    DIR=../../servers/croquet-io-dev/$1/
fi

mkdir -p $DIR
rsync -r dist/ $DIR
