const path = require("path");
const fs = require("fs-extra"); // no longer need fs separately
const md5 = require("md5");
const request = require("sync-request");
const simpleGit = require("simple-git");

const SRC = __dirname;
const DEST = path.join(SRC, '../../servers/croquet-io-dev/video-chat');

async function deploy() {
    // empty dest folder
    fs.emptyDirSync(DEST);

    // deploy model and app code
    const hashes = {};
    ['model', 'app'].forEach(section => {
        const script_contents = fs.readFileSync(path.join(SRC, `qchat-${section}.js`));
        const hash = hashes[section] = md5(script_contents).slice(0, 8);
        const filename = path.join(DEST, `${section}-${hash}.js`);
        fs.writeFileSync(filename, script_contents);
        fs.chmodSync(filename, 0o444);
    });

    // deploy index.html, audioOnly.html, microverse.html
    const version = request('GET', 'https://croquet.io/lib/croquet-latest-pre.txt').getBody('utf8').trim();
    [ 'index', 'audioOnly', 'microverse' ].forEach(fn => {
        const htmlName = `${fn}.html`;
        let html_contents = fs.readFileSync(path.join(SRC, htmlName), 'utf8');
        ['model', 'app'].forEach(section => {
            html_contents = html_contents.replace(`qchat-${section}.js`, `${section}-${hashes[section]}.js`);
        });
        html_contents = html_contents.replace('croquet-latest-pre.min.js', `croquet-${version}.min.js`);
        const filename = path.join(DEST, htmlName);
        fs.writeFileSync(filename, html_contents);
        fs.chmodSync(filename, 0o444);
    });

    // extra icons and logo for the microverse version are loaded from the site, rather
    // than embedded as inline svg.
    // recursive copy doesn't include the starting parent https://github.com/jprichardson/node-fs-extra/issues/537
    const buildDest = path.join(DEST, 'assets');
    await fs.ensureDir(buildDest, { mode: 0o755 });
    fs.copySync(path.join(SRC, 'assets'), buildDest);
    // remove the source for those inlined svgs
    const buildDestIcons = path.join(DEST, 'assets/icons');
    fs.removeSync(buildDestIcons);

    // commit to git
    const git = simpleGit({ baseDir: DEST });
    await git.add(['-A', DEST]);
    const { commit } = await git.commit("[video-chat] deploy to croquet.io/dev", [DEST]);
    if (!commit) {
        console.warn("Nothing committed?!");
    } else {
        console.log(await git.show(["--stat"]));
        console.log("You still need to\n    git push\nto deploy to https://croquet.io/dev/");
    }
}

deploy();
