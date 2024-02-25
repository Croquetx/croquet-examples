# Satellite

This repo just contains the deploy script!

It expects the actual fountain demo source [worldcore]](https://github.com/croquet/worldcore) to be cloned next to this `wonderland` repo:

    ├── worldcore                         git clone
    │   └── demos
    │       └── fountain
    └── wonderland                        git clone
        └── croquet
            └── fountain
                └── deploy.js


## Deploy

    node deploy.js

This will commit to the `wonderland` repo:

    └── wonderland
        └── servers
            └── croquet-io-dev
                └── fountain
