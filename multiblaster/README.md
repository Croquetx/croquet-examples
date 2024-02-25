# Multiblaster

This repo just contains the deploy script!

It expects the actual [multiblaster repo](https://github.com/croquet/multiblaster) to be cloned next to this `wonderland` repo:

    ├── multiblaster                      git clone
    │   ├── README.md
    │   └── index.html
    └── wonderland                        git clone
        └── croquet
            └── multiblaster
                ├── README.txt
                ├── package.json
                └── deploy.js
                

## Deploy

    node deploy.js

