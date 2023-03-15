import { UguisuError } from './misc/errors.js';

export type LangVersion = 'uguisu2023-1';

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
        switch (normalized) {
            case 'uguisu2023-1': {
                break;
            }
            default: {
                throw new UguisuError('unknown langVersion');
            }
        }
        langVersion = normalized;
    } else {
        langVersion = 'uguisu2023-1';
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

export function generateDefaultProjectInfo(): ProjectInfo {
    return {
        langVersion: 'uguisu2023-1',
        filename: 'main.ug',
    };
}
