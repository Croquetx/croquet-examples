const path = require("path");
const fs = require("fs");
const md5 = require("md5");
const fsExtra = require("fs-extra");
const request = require("sync-request");
const simpleGit = require("simple-git");

const SRC = __dirname;
const DEST = path.join(SRC, '../../servers/croquet-io-dev/youtube');

async function deploy() {
    // empty dest folder
    fsExtra.emptyDirSync(DEST);

    // deploy model and app code
    const hashes = {};
    ['app'].forEach(section => {
        const script_contents = fs.readFileSync(path.join(SRC, `${section}.js`));
        const hash = hashes[section] = md5(script_contents).slice(0, 8);
        const filename = path.join(DEST, `${section}-${hash}.js`);
        fs.writeFileSync(filename, script_contents);
        fs.chmodSync(filename, 0o444);
    });

    // deploy index.html
    const version = request('GET', 'https://croquet.io/lib/croquet-latest-pre.txt').getBody('utf8').trim();
    let html_contents = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
    ['app'].forEach(section => {
        html_contents = html_contents.replace(`${section}.js`, `${section}-${hashes[section]}.js`);
    });
    html_contents = html_contents.replace('croquet-latest-pre.min.js', `croquet-${version}.min.js`);
    const filename = path.join(DEST, 'index.html');
    fs.writeFileSync(filename, html_contents);
    fs.chmodSync(filename, 0o444);

    // commit to git
    const git = simpleGit({ baseDir: DEST });
    await git.add(['-A', DEST]);
    const { commit } = await git.commit("[youtube] deploy to croquet.io/dev", [DEST]);
    if (!commit) {
        console.warn("Nothing committed?!");
    } else {
        console.log(await git.show(["--stat"]));
        console.log("You still need to\n    git push\nto deploy to https://croquet.io/dev/");
    }
}

deploy();
