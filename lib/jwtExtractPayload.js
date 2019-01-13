
const node = typeof global !== 'undefined' && Object.prototype.toString.call(global.process) === '[object process]';

module.exports = token => {

    if (typeof token === 'string') {

        // https://stackoverflow.com/a/38552302/5560682
        try {

            token = token.split('.')[1];

            token = token.replace('-', '+').replace('_', '/');

            if (node) {

                token = Buffer.from(token, 'base64'); // https://stackoverflow.com/a/14573049/5560682
            }
            else {

                if (!window || !window.atob) {

                    throw "window.atob not exist";
                }

                token = window.atob(token);
            }

            return JSON.parse(token);
        }
        catch (e) {

            throw 'JWT payload extracting error';
        }
    }

    return token;
};