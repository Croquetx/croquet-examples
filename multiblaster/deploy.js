#!/usr/bin/env node

const path = require("path");
const fsx = require("fs-extra");
const simpleGit = require("simple-git");

const SRC = path.join(__dirname, '../../../multiblaster');
const DST = path.join(__dirname, '../../servers/croquet-io-dev/multiblaster');

async function deploy() {
    // check src folder
    const srcOK = await fsx.pathExists(SRC);
    if (!srcOK) {
        console.error(`Multiblaster source expected at ${SRC}`);
        process.exit(1);
    }

    // empty dest folder
    await fsx.emptyDir(DST);

    // deploy index.html
    await fsx.copy(path.join(SRC, 'index.html'), path.join(DST, 'index.html'));
    
    // commit to git
    const git = simpleGit({ baseDir: DST });
    await git.add(['-A', DST]);
    const { commit } = await git.commit("[multiblaster] deploy to croquet.io/dev", [DST]);
    if (!commit) {
        console.warn("Nothing committed?!");
    } else {
        console.log(await git.show(["--stat"]));
        console.log("You still need to\n    git push\nto deploy to https://croquet.io/dev/multiblaster");
    }
}

deploy();
