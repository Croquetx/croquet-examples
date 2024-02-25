# Quub

This repo just contains the deploy script!

It expects the actual quub demo source [worldcore]](https://github.com/croquet/worldcore) to be cloned next to this `wonderland` repo:

    ├── worldcore                         git clone
    │   └── demos
    │       └── quub
    └── wonderland                        git clone
        └── croquet
            └── quub
                └── deploy.js


## Deploy

    node deploy.js

This will commit to the `wonderland` repo:

    └── wonderland
        └── servers
            └── croquet-io-dev
                └── quub
