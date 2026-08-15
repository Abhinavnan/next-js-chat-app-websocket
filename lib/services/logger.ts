// lib/logger.ts
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m',
};

function timestamp(): string {
    return new Date().toISOString();
}

const parseMetaData = (metadata?: Record<string, any>): string => {
    if(!metadata) return '';

    return Object.entries(metadata)
        .map(([key, value]) => `${key}: ${value}`)
        .join(',\n');
}

export const logger = {
    error: (message: string, err?: unknown) => {
        console.error(
            `${colors.red}[ERROR]${colors.reset} ${colors.gray}${timestamp()}${colors.reset} - ${message}`
        );
        if (err instanceof Error) {
            console.error(`${colors.red}${err.stack || err.message}${colors.reset}`);
        } else if (err) {
            console.error(`${colors.red}${JSON.stringify(err)}${colors.reset}`);
        }
    },

    warn: (message: string, metadata?: Record<string, any>) => {
        const metadataString = `${colors.yellow}${parseMetaData(metadata)}${colors.reset}`;
        console.warn(
            `${colors.yellow}[WARN]${colors.reset} ${colors.gray}${timestamp()}${colors.reset} - ${message}\n${metadataString}`
        );
    },

    info: (message: string, metadata?: Record<string, any>) => {
        const metadataString = `${colors.green}${parseMetaData(metadata)}${colors.reset}`;
        console.log(`${colors.blue}[INFO]${colors.reset} ${colors.gray}${timestamp()}${colors.reset} - ${message}\n${metadataString}`);
    },

    success: (message: string, metadata?: Record<string, any>) => {
        const metadataString = `${colors.green}${parseMetaData(metadata)}${colors.reset}`;
        console.log(`${colors.green}[SUCCESS]${colors.reset} ${colors.gray}${timestamp()}${colors.reset} - ${message}\n${metadataString}`, );
    },

    debug: (message: string) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log(
                `${colors.magenta}[DEBUG]${colors.reset} ${colors.gray}${timestamp()}${colors.reset} - ${message}`
            );
        }
    },
};