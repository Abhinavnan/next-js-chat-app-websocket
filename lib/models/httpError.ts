class HttpError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 500, type?: string) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'HttpError';
        this.cause = type;
    }
}

export default HttpError;