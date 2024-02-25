#!/bin/sh

cd `dirname "$0"`
rm -rf dist

META=`git log --no-walk|grep -v '^Author' |head -2 |tr '\n' ' '`
COMMIT=`echo ${META} | awk '{print $2}'`

mkdir -p dist/${COMMIT}/meta dist/meta

echo ${META}> dist/${COMMIT}/meta/version.txt
echo ${COMMIT}> dist/meta/version.txt

rsync -r broadcaster.js style.css croquet-virtual-dom.js dist/${COMMIT}

#EQUIV='        <meta http-equiv="Content-Security-Policy" content="frame-ancestors https://croquet.io">'

cat index.html | \
    sed 's:\.\/:\.\/'${COMMIT}'\/:g' > dist/index.html

#    sed 's%\(<meta charset.*>\)$%\1\n        <meta http-equiv="Content-Security-Policy" content="frame-ancestors https://croquet.io">%' | \
