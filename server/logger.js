function formatMessage(message, errorObject, filename) {
    const errMessage = (errorObject && typeof errorObject === 'object' && errorObject.message)
        ? errorObject.message
        : 'No info';
    const filePart = filename ? ` [${filename}]` : '';
    return `${message} [${errMessage}]${filePart}`;
}

const logger = {
    error: (message, errorObject, filename) => {
        console.error(`Error: ${formatMessage(message, errorObject, filename)}`);
    },
    warn: (message, errorObject, filename) => {
        console.warn(`Warn: ${formatMessage(message, errorObject, filename)}`);
    }
};

module.exports = logger;
