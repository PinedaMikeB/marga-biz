#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const { loadLocalEnv } = require('./lib/telegram-gateway');

const DEFAULT_SITE_ID = '706eb1e8-e6ba-44ca-b2c5-432819228e51';
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const REPO_ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
    const [, , ...rest] = argv;
    const options = {};

    for (const arg of rest) {
        if (!arg.startsWith('--')) continue;
        const separator = arg.indexOf('=');
        if (separator === -1) {
            options[arg.slice(2)] = true;
            continue;
        }

        options[arg.slice(2, separator)] = arg.slice(separator + 1);
    }

    return options;
}

function resolveCommand() {
    const localNetlify = spawnSync('bash', ['-lc', 'command -v netlify'], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
    });

    if (localNetlify.status === 0) {
        return {
            command: localNetlify.stdout.trim(),
            args: []
        };
    }

    return {
        command: 'npx',
        args: ['--yes', 'netlify-cli']
    };
}

function run() {
    loadLocalEnv();
    const options = parseArgs(process.argv);
    const siteId = options.site || process.env.NETLIFY_SITE_ID || DEFAULT_SITE_ID;
    const timeout = Number(options['timeout-ms'] || process.env.NETLIFY_DEPLOY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    const authToken = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN || '';
    const dir = options.dir || 'dist';

    const runner = resolveCommand();
    const args = [
        ...runner.args,
        'deploy',
        '--prod',
        '--dir',
        dir,
        '--site',
        siteId
    ];

    if (authToken) {
        args.push('--auth', authToken);
    }

    if (options.message) {
        args.push('--message', options.message);
    }

    if (options['dry-run']) {
        process.stdout.write(JSON.stringify({
            ok: true,
            dryRun: true,
            command: runner.command,
            args,
            siteId,
            authConfigured: Boolean(authToken),
            timeout
        }, null, 2));
        process.stdout.write('\n');
        return;
    }

    const result = spawnSync(runner.command, args, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: 'inherit',
        timeout
    });

    if (result.error) {
        throw result.error;
    }

    if (result.signal === 'SIGTERM') {
        throw new Error(`Deploy timed out after ${timeout}ms`);
    }

    if (typeof result.status === 'number' && result.status !== 0) {
        throw new Error(`Deploy exited with status ${result.status}`);
    }
}

try {
    run();
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
}
