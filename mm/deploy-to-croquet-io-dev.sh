#!/bin/sh

cd `dirname "$0"`

. ./build-files.sh $1

DIR=../../servers/croquet-io-dev/mm/

if [ "$1" != "" ]
then
    DIR=../../servers/croquet-io-dev/$1/
fi

mkdir -p $DIR
rsync --delete -r dist/ $DIR
