
const jwt               = require('jsonwebtoken');

const securityabstract  = require('./securityabstract');

const jwtExtractPayload = require('./jwtExtractPayload');

module.exports = opt => securityabstract(Object.assign({
    generatetoken: async (payload = {}, opt) => {
        return jwt.sign(
            payload,
            opt.secret,
            {
                // https://github.com/auth0/node-jsonwebtoken#jwtsignpayload-secretorprivatekey-options-callback
                // must be int
                expiresIn: opt.expire,
            }
        )
    },
    /**
     * Warning: exception thrown in this method will be showd on the frontend as an authentication error
     * for example you can emit message on the front by throwing exception like this:
     *
     *      throw `JWT token expired`
     */
    verifyandextractpayload: async (value) => {
        try {

            // expecting exception from method .verify() if not valid:
            // https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback
            jwt.verify(value, opt.secret);

            return jwtExtractPayload(value);
        }
        catch (e) { // auth based on cookie failed (any reason)

            throw `invalid jwt token: '${e}'`;
        }
    },
}, opt));