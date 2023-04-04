import { UguisuError } from './misc/errors.js';

const langVersions = ['0.8'] as const;
const defaultVersion = '0.8';

export type LangVersion = typeof langVersions[number];

function isLangVersion(x: string): x is LangVersion {
    return (langVersions as readonly string[]).includes(x);
}

export type ProjectInfo = {
    langVersion: LangVersion,
    filename: string,
};

export type ProjectFile = {
    langVersion?: LangVersion,
    filename?: string,
};

export function parseProjectFile(source: Record<string, any>): ProjectInfo {
    // langVersion
    let langVersion: LangVersion;
    if (source.langVersion != null) {
        if (typeof source.langVersion != 'string') {
            throw new UguisuError('langVersion invalid');
        }
        const normalized = source.langVersion.toLowerCase();
        if (!isLangVersion(normalized)) {
            throw new UguisuError('unknown langVersion');
        }
        langVersion = normalized;
    } else {
        langVersion = defaultVersion;
    }

    // filename
    let filename: string;
    if (source.filename != null) {
        if (typeof source.filename != 'string') {
            throw new UguisuError('filename invalid');
        }
        if (source.filename.length == 0) {
            throw new UguisuError('filename invalid');
        }
        filename = source.filename;
    } else {
        filename = 'main.ug';
    }

    return {
        langVersion,
        filename,
    };
}

export function getDefaultProjectInfo(): ProjectInfo {
    return {
        langVersion: defaultVersion,
        filename: 'main.ug',
    };
}
