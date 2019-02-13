
const jwt               = require('jsonwebtoken');

const securityabstract  = require('./securityabstract');

const log               = require('inspc');

const jwtExtractPayload = require('./jwtExtractPayload');

const th                = msg => `securityjwt.js: ` + msg;

tool.extend = opt => Object.assign({}, {

    // false (boolean) - then it listen to expire parameter
    // or
    // 60 * 60 * 8 (integer)   - 8 hours in seconds
    // Renew if user visit within last (8 hours in this case)
    //
    // To recap:
    // Tokens are set fo the time that is given in 'expire' parameter
    // but if user shows up again within time given in 'rememberme' token will be renewed

    // Warning: if integer then 'rememberme' have to be at least 2x smaller than expire
    // Can't be almost the same like expre because we would have to renew token every time user comes back
    rememberme          : false,
    generatetoken: async (payload = {}, formrememberme, opt) => {

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
    verifyandextractpayload: async (value, opt, formrememberme, destroysession) => {

        try {

            opt.debug && log.dump({
                insideoptverify: value,
            })

            // expecting exception from method .verify() if not valid:
            // https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback
            jwt.verify(value, opt.secret);

            return jwtExtractPayload(value);
        }
        catch (e) { // auth based on cookie failed (any reason)

            const msg = (e + '');

            opt.debug && log.dump({
                insideoptverifycatch: msg,
                formrememberme,
                destroysession,
            });

            if ( ! formrememberme ) {

                await destroysession();
            }

            throw `invalid jwt token: '${e}'`;
        }
    },
    validatepayload: async payload => {

        if ( ! securityabstract.isObject(payload) ) {

            throw th(`validatepayload(): payload is not an object`);
        }

        if ( typeof payload.exp !== 'undefined' ) {

            throw th(`payload for jwt token can't have field 'exp', this field is reserved by jwt token generation alghorihtm, maybe you find usefull to use method opt.clearpayloadbeforerefresh() to clear it?`);
        }

        if ( typeof payload.iat !== 'undefined' ) {

            throw th(`payload for jwt token can't have field 'iat', this field is reserved by jwt token generation alghorihtm, maybe you find usefull to use method opt.clearpayloadbeforerefresh() to clear it?`);
        }
    },
    clearpayloadbeforerefresh: async payload => {

        if ( ! securityabstract.isObject(payload) ) {

            throw th(`clearpayloadbeforerefresh(): payload is not an object`);
        }

        const {
            exp,
            iat,
            ...rest
        } = payload;

        return rest;
    },
    refreshtoken: async () => {

    },
}, opt);

function tool(opt) {

    /**
     * First use local extend ...
     */
    opt = tool.extend(opt);

    /**
     * Then external extend ... order does matter
     */
    opt = securityabstract.extend(opt);

    opt = securityabstract.order(opt);

    if ( typeof opt.secret !== 'string') {

        throw th(`secret field must be string`);
    }

    opt.secret = opt.secret.trim();

    if ( ! opt.secret ) {

        throw th(`secret field is an empty string`);
    }

    (function (val, type) {

        if (val === false) {

            return;
        }

        if (type === 'number') {

            if (val < 4) {

                th(`value in field 'rememberme' should be bigger than 4 seconds if it's integer`);
            }

            const half = parseInt(opt.expire / 2, 10);

            if ( half < opt.rememberme ) {

                th(`expire should be at least 2x bigger than rememberme, current values are: ` + JSON.stringify({
                    expire      : opt.expire,
                    half,
                    rememberme  : opt.rememberme,
                }, null, 4));
            }
        }
        else {

            th(`field 'rememberme' should be false or integer`);
        }

    }(opt.rememberme, typeof opt.rememberme));

    return securityabstract(opt);
}

module.exports = tool;