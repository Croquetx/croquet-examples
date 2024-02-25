#!/bin/sh

DEST=../../../ploma

rsync -rv croquet-virtual-dom.js index.html ploma-vdom.js plomaData.js ploma.js ploma.css point.js util.js colorPicker.js ${DEST}/

cp -r ./public/ ${DEST}/
