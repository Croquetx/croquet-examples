# Croquet Guardians

Source: https://github.com/croquet/worldcore/examples/guardians5

This repo just contains the deployment script for the production deployment on croquet.io!

## Deploy

   ./deploy.js <path_to_worldcore>/examples/guardians5

This will commit `guardians5` from `worldcore/examples` to this `wonderland` repo:

    ├── worldcore
    │   └── examples
    │       └── guardians5
    └── wonderland
        ├── croquet
        │   └── guardians
        │       └── deploy.js
        └── servers
            └── croquet-io-dev
                └── guardians
