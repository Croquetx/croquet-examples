const path = require("path");
const fs = require("fs");
const md5 = require("md5");
const fsExtra = require("fs-extra");
const request = require("sync-request");
const simpleGit = require("simple-git");

const SRC = __dirname;
const DEST = path.join(SRC, '../../servers/croquet-io-dev/broadcaster');

const files = ["broadcaster.js", "style.css", "croquet-virtual-dom.js"];

async function deploy() {
    // empty dest folder
    fsExtra.emptyDirSync(DEST);

    // deploy model and app code
    const hashes = {};
    files.forEach(file => {
        const [base, suffix] = file.split(".");
        const script_contents = fs.readFileSync(path.join(SRC, file));
        const hash = hashes[file] = md5(script_contents).slice(0, 8);
        const filename = path.join(DEST, `${base}-${hash}.${suffix}`);
        fs.writeFileSync(filename, script_contents);
        fs.chmodSync(filename, 0o444);
    });

    // deploy index.html
    let html_contents = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');

    files.forEach(file => {
        const [base, suffix] = file.split(".");
        html_contents = html_contents.replace(file, `${base}-${hashes[file]}.${suffix}`);
    });
    const filename = path.join(DEST, 'index.html');
    fs.writeFileSync(filename, html_contents);
    fs.chmodSync(filename, 0o444);

    // commit to git
    const git = simpleGit({ baseDir: DEST });
    await git.add(['-A', DEST]);
    const { commit } = await git.commit("[broadcaster] deploy to croquet.io/dev", [DEST]);
    if (!commit) {
        console.warn("Nothing committed?!");
        } else {
            console.log(await git.show(["--stat"]));
            console.log("You still need to\n    git push\nto deploy to https://croquet.io/dev/");
        }
}

deploy();
