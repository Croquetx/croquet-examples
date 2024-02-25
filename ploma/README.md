**internal development manual**
last modified on 2021-09-15, or Sep 15th, 2021

# Introduction

This app uses the Croquet Virtual DOM framework. You need croquet-virutal-dom.js rolled up by `rollup`.  The easiest way to get to it is to go to `../pitch/` directory, run `framework.sh`, and copy `../pitch/src/croquet-virtual-dom.js` to this directory. Alternatively, you can load it from `https://cdn.jsdelivr.net/npm/@croquet/virtual-dom@1.0.3`. Notice however that there are two references to the virtual-dom library, one in `index.html` and another in `plomaData.js`. You need to use the identical location for both places.

There is a "public" repository of this app (`https://github.com/yoshikiohshima/ploma`) it is a fork of the upstream (`https://github.com/evhan55/ploma`).  If you can write to the repo (as of now, only Yoshiki can do it),  you clone `https://github.com/yoshikiohshima/ploma` to `../../../ploma` and run `publish.sh` to copy files over to the directory.  Some contens in the `public/` directory is also copied.
