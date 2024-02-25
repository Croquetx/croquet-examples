#!/bin/sh

META=`git log --no-walk|grep -v '^Author' |head -2 |tr '\n' ' '`
COMMIT=`echo ${META} | awk '{print $2}'`

rm -rf dist
mkdir -p dist/${COMMIT}/meta
mkdir -p dist/meta 

echo ${META}> dist/${COMMIT}/meta/version.txt
echo ${COMMIT}> dist/meta/version.txt

rsync -r ploma.js croquet-virtual-dom.js point.js ploma-vdom.js plomaData.js ploma.css util.js croquet-latest.min.js colorPicker.js assets dist/${COMMIT}

cat index.html | sed 's:\.\/:\.\/'${COMMIT}'\/:g' | \
    sed 's:window._production=.*$:window._production="'${COMMIT}'";:' > dist/index.html
