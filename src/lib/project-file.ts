import { UguisuError } from './misc/errors.js';

export type LangVersion = 'uguisu2023-1';

export type ProjectInfo = {
    langVersion: LangVersion,
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

    return {
        langVersion,
    };
}

export function generateDefaultProjectInfo(): ProjectInfo {
    return {
        langVersion: 'uguisu2023-1',
    };
}