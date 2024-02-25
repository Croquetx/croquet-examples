#!/usr/bin/env node

// bundles app, commits to wonderland (croquet-io-dev) repo

const { exit } = require("process");
const { execSync } = require("child_process");
const path = require("path");
const fsx = require("fs-extra");
const glob = require("glob");
const replace = require('replace-in-file');
const simpleGit = require("simple-git");

const APP = path.basename(path.dirname(process.argv[1]));

const DELETE = [
    "package.json",
    "package-lock.json",
    "node_modules",
    "docs",
    // we delete node_modules before expanding these globs
    ".*",
    "**/*.sh",
    "**/*.md",
    "**/*.txt",
];

if (process.argv.length < 3) {
    console.error("the source directory needs to be specified");
    exit(1);
}

function execAndLog(...args) {
    try {
        const stdout = execSync(...args);
        console.log(stdout.toString());
    } catch (err) {
        if (err.stdout) console.log(err.stdout.toString());
        if (err.stderr) console.error(err.stderr.toString());
        throw err;
    }
}

const SRC = path.join(process.argv[2]);



async function getMeta(baseDir, format=`${APP}: %H Date: %ad`) {
    const git = simpleGit({ baseDir });
    const { latest: { meta } } = await git.log({ n: 1, format: { meta: format }});
    return meta;
}

async function deploy() {
    const WONDERLAND = path.join(__dirname, '../..');
    const TARGET = path.join(WONDERLAND, `servers/croquet-io-dev/${APP}`);

    // verify SRC dir
    try { await fsx.access(SRC, fsx.constants.W_OK); }
    catch (error) { console.error(`Expected ${APP} at ${SRC}\n${error.message}`); exit(1); }

    // verify WONDERLAND dir
    try { await fsx.access(WONDERLAND, fsx.constants.W_OK); }
    catch (error) { console.error(`Expected Wonderland at ${WONDERLAND}\n${error.message}`); exit(1); }

    // create TARGET dir
    try { await fsx.ensureDir(TARGET); }
    catch (error) { console.error(`Error creating ${TARGET}\n${error.message}`); exit(1); }

    console.log(`Deploying ${SRC} to ${TARGET}`);

    // build into croquet.io/dev/
    await fsx.emptyDir(TARGET);
    console.log(`Building ${APP}...`);
    execAndLog(`npm run build -- --output-path ${TARGET}`, {cwd: SRC});

    // delete unwanted files
    console.log(`Deleting unwanted files...`);
    for (const pattern of DELETE) {
        const p = path.join(TARGET, pattern);
        if (glob.hasMagic(p)) {
            const files = glob.sync(p);
            // eslint-disable-next-line no-await-in-loop
            await Promise.all(files.map(f => fsx.remove(f)));
        } else {
            // eslint-disable-next-line no-await-in-loop
            await fsx.remove(p);
        }
    }

    // add app meta
    const meta = await getMeta(SRC);
    fsx.writeFile(path.join(TARGET, 'version.txt'), meta);
    // replace.sync({
    //     files: path.join(TARGET, 'main-*.js'),
    //     from: /CROQUET_VERSION:"([^"]+)"/,
    //     to: `CROQUET_VERSION:"\\1 ${meta}"\n`,
    // });

    const git = simpleGit({ baseDir: TARGET });

    // commit to git
    console.log(`git add -A -- ${TARGET}`);
    await git.add(['-A', TARGET]);
    console.log(`git commit -- ${TARGET}`);
    try {
        const { commit } = await git.commit(`[${APP}] deploy to croquet.io/dev/${APP}`, [TARGET]);
        if (!commit) {
            console.warn("Nothing committed?!");
        } else {
            console.log(await git.show(["--stat"]));
            console.log(`You still need to "git push" here (in wonderland)\nto deploy to https://croquet.io/dev/${APP}`);
        }
    } catch (err) {
        console.error(err.message);
    }
}

deploy();
