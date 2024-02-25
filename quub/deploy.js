#!/usr/bin/env node

// bundles app, commits to wonderland (croquet-io-dev) repo

const { exit } = require("process");
const { execSync } = require("child_process");
const path = require("path");
const fsx = require("fs-extra");
const simpleGit = require("simple-git");

const APP = "quub";

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

async function deploy() {
    const WORLDCORE = path.join(__dirname, '../../../worldcore');
    const WONDERLAND = path.join(__dirname, '../..');
    const SRC=path.join(WORLDCORE,`demos/${APP}`);
    const TARGET = path.join(WONDERLAND, `servers/croquet-io-dev/${APP}`);

    // verify WORLDCORE dir
    try { await fsx.access(WORLDCORE); }
    catch (error) { console.error(`Expected Worldcore at ${WORLDCORE}\n${error.message}`); exit(1); }

    // verify WONDERLAND dir
    try { await fsx.access(WONDERLAND, fsx.constants.W_OK) }
    catch (error) { console.error(`Expected Wonderland at ${WONDERLAND}\n${error.message}`); exit(1); }

    console.log(`Deploying ${SRC} to ${TARGET}`);

    // verify SRC repo
    const status = await simpleGit({ baseDir: SRC }).status();
    if (status.modified.length > 0) {
        console.error(`Repo has modified files:\n${status.modified.join('\n')}\nABORTING`);
        exit(1);
    }

    console.log(`Updating ${APP}...`);
    execAndLog("npm ci", {cwd: SRC});

    // build into croquet.io/dev/
    await fsx.emptyDir(TARGET);
    console.log(`Building ${APP}...`);
    execAndLog(`npm run build -- --output-path ${TARGET}`, {cwd: SRC});

    // commit to git
    const git = simpleGit({ baseDir: TARGET });
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
