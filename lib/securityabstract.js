
const path          = require('path');

const fs            = require('fs');

const log           = require('inspc');

const form          = require('./form');

tools.extend = opt => order(Object.assign({}, {
    cookiename          : 'nodesession', // just name of session cookie
    requestauthfield    : 'auth', // name of field attached to request object if successfully authenticated
    requestauthfieldrawtoken : false, // if authenticated then add also raw jwt tokne under this field name
    requestauthfieldrawtokenprefixed : false, // like above but with leading expire date part, for internal processing
    debug               : false, // debug mode - print all internal states to terminal
    expire              : 60 * 60 * 9, // in seconds (in this case 9 hours)
    templateFile        : path.resolve(__dirname , 'form.html'), // template parsed by lodash/template https://lodash.com/docs/4.17.11#template
    /**
     * purpose of the function is to throw some exception if payload is invalid for further processing,
     * for example:
     *      - wrong type (not object)
     *      - is an object but have filed 'exp' || 'iat' reserved by jwt authentication
     *      ...ect
     */
    validatepayload: false, // false || function
    /**
     * Clear old payload before repacking it to new token.
     *
     * Why it it useful?
     *
     * For example jwt encryption adds to payload fields 'exp' && 'iat' and returns error if
     * you try to extract palyload with those fields from one token and try to repack payload with those fields
     * to new jwt token
     */
    clearpayloadbeforerefresh: false,
    redirectaftersignout: '/',
    // redirectaftersignout: (payload, opt) => {
    //     throw th(`redirectaftersignout option not implemented`)
    // },
    /**
     *
     * @param req
     * @param res
     * @param opt
     * @returns {Promise<boolean>}:
     *      true    - show login form because user is not authenticated
     *                  or do whatever is defined in opt.ifprotected()
     *      false   - carry on (next()), user authenticated (don't show login form)
     */
    protect: async (req, res, opt) => {
        // main logic of distinguishing if secure following routes with or not
        // in this case it's protecting if request object have field "auth"
        // but you're free to change it to realay on req.url and "auth" field
        // or on particular value in "auth" field like auth.role === 'user'

        // if field NOT exist then protect -> (then return true)
        return !req[opt.requestauthfield];
    },
    extracttokenifnotfoundincookie: async (req, opt) => {

    },
    /**
     * Standard way of reacting for failed authentication is rendering login form
     * but here you can do whatever you want based on anything from request or response.
     * @returns {Promise<void>} - it doesn't matter what you return from this function
     */
    ifprotected: async (req, res, next, renderloginform) => {

        const accept = req.get('accept') || '';

        res.status(401);

        if ( accept.includes('text/html') ) {

            return renderloginform();
        }

        res.end('');
    },
    /**
     * Method to find user based on given username
     * If not found by username just return falsy value like false|null|undefined even 0
     * If found return object
     *
     * @returns {Promise<{}>}
     */
    userprovider: async (username, opt) => {
        throw th(`userprovider option not implemented`);
    },
    /**
     * Check if user found by userprovider password is valid
     * @returns {Promise<boolean>}
     */
    authenticate: async (user = {}, password, opt) => {
        throw th(`authenticate option not implemented`);
    },
    /**
     * Extracting payload from user (for JWT like algorithm that can keep payload in token)
     * This value will be attached to req.auth = {...} and later can be use to
     * authentication on individual routes level
     *
     * If returned falsy value - default will be empty object ({})
     * @returns {Promise<any>}
     */
    extractpayloadfromuser: async (user, opt) => {
        throw th(`extractpayloadfromuser option not implemented`);
    },
    generatetoken: async (payload = {}, formrememberme, opt) => {
        throw th(`generatetoken option not implemented`);
    },
    setcookie: async (res, value, formrememberme, opt) => {

        const copt = { // https://expressjs.com/en/4x/api.html#res.cookie
            httpOnly    : true, // can't be manipulated in js
        };

        /**
         * Expiry date of the cookie in GMT. If not specified or set to 0, creates a session cookie.
         * from: https://expressjs.com/en/api.html#res.cookie
         */
        if ( formrememberme ) {

            copt.maxAge = opt.expire * 1000 // maxAge in miliseconds
        }

        res.cookie(opt.cookiename, value, copt);

        opt.debug && res.set('X-now', (new Date()).toISOString().substring(0, 19).replace('T', ' '));

        return true;
    },
    /**
     * Warning: exception thrown in this method will be shown on the frontend as an authentication error
     * for example you can emit message on the front so be careful to not throw any sensitive informations.
     * Convert any native throw messages to something more neutral like:
     *
     *      throw `JWT token expired`
     */
    verifyandextractpayload: async (value, opt, formrememberme, destroysession) => {
        throw th(`verifyandextractpayload option not implemented`);
    },
    /**
     * Destroy session.
     *
     * No need to remove field "auth" from request object because immediately
     * after executing this method response returns redirection to new page.
     *
     * @param req
     * @param res
     * @param opt
     */
    signout: async (req, res, opt) => {

        opt.debug && log.dump({
            signoutmiddleware: {
                cookiename: opt.cookiename
            }
        });

        res.clearCookie(opt.cookiename, {
            httpOnly    : true, // can't be manipulated in js
        });
    },
}, opt));

function tools(opt) {

    /**
     * Default options
     */
    opt = tools.extend(opt);

    const d     = opt.debug ? msg => console.log(`security debug: ` + msg) : () => {};

    str(opt, 'cookiename');

    str(opt, 'requestauthfield');

    fnc(opt, 'protect');

    fnc(opt, 'extracttokenifnotfoundincookie');

    fnc(opt, 'userprovider');

    fnc(opt, 'authenticate');

    fnc(opt, 'ifprotected');

    fnc(opt, 'extractpayloadfromuser');

    fnc(opt, 'generatetoken');

    fnc(opt, 'verifyandextractpayload');

    fnc(opt, 'signout');

    num(opt, 'expire', 10);

    str(opt, 'templateFile');

    if ( typeof opt.redirectaftersignout !== 'string' && typeof opt.redirectaftersignout !== 'function') {

        throw th(`redirectaftersignout is not a funciton nor a string`);
    }

    if ( opt.validatepayload !== false && typeof opt.validatepayload !== 'function' ) {

        throw th(`opt.validatepayload can be only false or function`)
    }

    if ( opt.requestauthfieldrawtoken !== false && typeof opt.requestauthfieldrawtoken !== 'string' ) {

        throw th(`opt.requestauthfieldrawtoken can be only false or string`)
    }

    if ( opt.requestauthfieldrawtoken && ! opt.requestauthfieldrawtoken.trim() ) {

        throw th(`opt.requestauthfieldrawtoken can't be empty`);
    }

    if ( opt.requestauthfieldrawtokenprefixed !== false && typeof opt.requestauthfieldrawtokenprefixed !== 'string' ) {

        throw th(`opt.requestauthfieldrawtokenprefixed can be only false or string`)
    }

    if ( opt.requestauthfieldrawtokenprefixed && ! opt.requestauthfieldrawtokenprefixed.trim() ) {

        throw th(`opt.requestauthfieldrawtokenprefixed can't be empty`);
    }

    if ( opt.requestauthfield && ! opt.requestauthfield.trim() ) {

        throw th(`opt.requestauthfield can't be empty`);
    }

    if ( opt.requestauthfield === opt.requestauthfieldrawtoken ) {

        throw th(`opt.requestauthfield and opt.requestauthfieldrawtoken can't be the same`);
    }

    if ( opt.requestauthfield === opt.requestauthfieldrawtokenprefixed ) {

        throw th(`opt.requestauthfield and opt.requestauthfieldrawtokenprefixed can't be the same`);
    }

    if ( opt.requestauthfieldrawtokenprefixed && opt.requestauthfieldrawtoken === opt.requestauthfieldrawtokenprefixed ) {

        throw th(`opt.requestauthfieldrawtoken and opt.requestauthfieldrawtokenprefixed can't be the same`);
    }

    if ( opt.verifyandextractpayload !== false && typeof opt.verifyandextractpayload !== 'function' ) {

        throw th(`opt.verifyandextractpayload can be only false or function`)
    }

    if ( ! fs.existsSync(opt.templateFile) ) {

        throw th(`Template file '${opt.templateFile}' doesn't exist`);
    }

    try {

        fs.accessSync(opt.templateFile, fs.constants.R_OK);
    }
    catch (e) {

        throw th(`Template file '${opt.templateFile}' is not readdable`);
    }

    const template = (function (tmp) {
        return (res, params) => tmp(res, Object.assign({
            header      : opt.header,
            rememberme  : opt.rememberme,
        }, params));
    }(form(opt.templateFile)));

    const tool = {};

    tool.secure = async (req, res, next) => {

        const general = msg => template(res, {
            general: msg
        });

        let loginrequest = false;

        try {

            loginrequest = req.body['auth-hidden-field'] === 'auth-hidden-value';
        }
        catch (e) {

            d(req.url + ': ' + (e + ''))
        }

        let errors = {};

        if (loginrequest) {

            const formrememberme = typeof req.body['remember-me'] !== 'undefined';

            if ( ! (req.body.username || '').trim() ) {

                errors.username = 'Username not specified';
            }

            if ( ! (req.body.password || '').trim() ) {

                errors.password = 'Password not specified';
            }

            if (Object.keys(errors).length) {

                return template(res, errors);
            }

            try {

                const user = await opt.userprovider(req.body.username, opt);

                opt.debug && log.dump({
                    founduser   : user,
                    byusername  : req.body.username,
                }, 5)

                if ( ! user ) {

                    log.dump({
                        userprovidererror: `User not found by username: '${req.body.username}'`,
                    });

                    return general("Invalid username or password");
                }

                const authenticated = await opt.authenticate(user, req.body.password, opt);

                opt.debug && log.dump({
                    authenticated,
                })

                if ( ! authenticated ) {

                    log.dump({
                        authenticatederror: `User found but didn't pass authenticaiton defined in method authenticate()`,
                    });

                    return general("Invalid username or password");
                }

                const payload = await opt.extractpayloadfromuser(user, opt);

                if ( typeof opt.validatepayload === 'function' ) {

                    await opt.validatepayload(payload);
                }

                opt.debug && log.dump({
                    extractedpayloadfromuser: payload
                });

                const {
                    done
                } = await setCookie(res, payload, formrememberme, `normal set`, opt);

                if (done === true) {

                    opt.debug && log.dump({
                        redirectafterloginform: req.url,
                    });

                    return res.redirect(req.url);
                }

                return general(`couldn't set cookie`);
            }
            catch (e) {

                log.dump({
                    generalerror: e,
                }, 3);

                return general(`server auth error`);
            }
        }


        let jwttoken = getCookie(req, opt);

        if ( ! jwttoken ) {

            jwttoken = await opt.extracttokenifnotfoundincookie(req, opt);
        }

        if (jwttoken) {

            opt.debug && log.dump({
                rawcookiefound: jwttoken
            });

            try {

                let [
                    payload,
                    value,
                    formrememberme,
                    expireAt,
                    expireAtAsDate,
                    threshold,
                    now
                ] = await unpackRawToken(jwttoken, req, res, opt);

                req[opt.requestauthfield] = payload;

                if (opt.requestauthfieldrawtokenprefixed) {

                    req[opt.requestauthfieldrawtokenprefixed] = jwttoken;
                }

                if (opt.requestauthfieldrawtoken) {

                    req[opt.requestauthfieldrawtoken] = value;
                }

                // let expire, value, ex;

                if ( opt.rememberme && formrememberme) {

                    opt.debug && log.dump({
                        refreshtoken: {
                            now______    : now,
                            threshold,
                            expireAt_   : expireAt,
                            'now > threshold': now > threshold,
                        }
                    })

                    if ( now > threshold ) {

                        await refreshToken(res, opt, payload);
                    }
                }

                opt.debug && log.dump({
                    payloadextracted: payload,
                    opt,
                })
            }
            catch (e) {

                if (e && e.console) {

                    log.dump({
                        generalerrorsplit: e.console,
                    })

                    return general(e.web);
                }

                log.dump({
                    generalerror: (e + '')
                });

                return general(e + '')
            }
        }

        const protect = await opt.protect(req, res, opt);

        if ( protect ) {

            log.t(`condition not fulfilled -> rendering login form`);

            return await opt.ifprotected(req, res, next, () => template(res));
        }

        opt.debug && log.dump({
            next: `condition passed -> next()`,
        });

        next();
    };

    tool.signout = async (req, res, next) => {

        let url = opt.redirectaftersignout;

        if (typeof opt.redirectaftersignout === 'function') {

            const payload = req[opt.requestauthfield];

            try {

                await opt.redirectaftersignout(payload, opt);
            }
            catch (e) {

                opt.debug && log.dump({
                    redirectaftersignout: e
                }, 3);

                return next();
            }
        }

        try {

            await opt.signout(req, res, opt);
        }
        catch (e) {

            log.dump({
                signouterror: e
            }, 3);

            return next();
        }

        opt.debug && log.dump({
            redirectaftersignout: req.url,
        });

        return res.redirect(url);
    }

    const commonForDiffAndRefresh = async (req, res, refresh) => {

        if ( typeof refresh !== 'boolean' ) {

            throw th(`commonForDiffAndRefresh: 'refresh' is not boolean`);
        }

        const l = (refresh === true) ? 'refresh' : 'diff';

        let
            error                       = false,
            jwt                         = false,
            diffInSec                   = false
        ;

        let
            payload = false,
            value,
            formrememberme,
            expireAt,
            threshold,
            now,
            jwttoken
        ;

        try {

            jwttoken = getCookie(req, opt);

            if ( ! jwttoken ) {

                jwttoken = await opt.extracttokenifnotfoundincookie(req, opt);
            }

            if (jwttoken) {

                opt.debug && log.dump({
                    [l + '_rawcookiefound']: jwttoken
                });

                [
                    payload,
                    value,
                    formrememberme,
                    expireAt,
                    expireAtAsDate,
                    threshold,
                    now
                ] = await unpackRawToken(jwttoken, req, res, opt);

                jwt = value;

                if ( refresh ) {

                    const expireDate = await refreshToken(res, opt, payload);

                    diffInSec = parseInt((expireDate.getTime() / 1000), 10) - parseInt((new Date()).getTime() / 1000, 10)
                }
                else {

                    diffInSec = parseInt((expireAtAsDate.getTime() / 1000), 10) - parseInt((new Date()).getTime() / 1000, 10);
                }

                opt.debug && log.dump({
                    [l + '_payloadextracted']: payload,
                    opt,
                });

            }
            else {

                opt.debug && log.dump({
                    [l + '_rawcookieNOTfound']: jwttoken
                });
            }
        }
        catch (e) {

            if (e && e.console) {

                log.dump({
                    [l + '_generalerrorsplit']: e.console,
                })

                error = e.web;
            }

            log.dump({
                [l + '_generalerror']: (e + '')
            });

            error = e + '';
        }

        return res.json({
            payload,
            jwt,
            error,
            diffInSec,
        });
    }

    tool.diff       =  (req, res) => commonForDiffAndRefresh(req, res, false);

    tool.refresh    =  (req, res) => commonForDiffAndRefresh(req, res, true);

    return tool;
};

tools.order             = order;

tools.parseCookieTime   = parseCookieTime;

tools.isObject          = isObject;

module.exports          = tools;

function order(obj) {

    if ( ! isObject(obj) ) {

        throw th(`secirutyabstract.order, 'obj' param is not an object, it is: ` + (typeof obj));
    }

    const keys = Object.keys(obj);

    keys.sort();

    return keys.reduce((acc, key) => {

        acc[key] = obj[key];

        return acc;

    }, {});
}

function getCookie(req, opt) {

    const cookies = decodeURIComponent(req.headers.cookie || '').split(';').reduce((acc, coo) => {
        const tmp   = coo.split('=');
        const name  = tmp.shift().trim();
        const value = tmp.join('=').trim();
        name && (acc[name] = value);
        return acc;
    }, {});

    opt.debug && log.dump({
        rawcookiebeforedecode   : req.headers.cookie,
        cookiesafterdecoding    : cookies,
    });

    return cookies[opt.cookiename];
}

async function setCookie(res, payload, formrememberme, mode, opt) {

    if ( ! isObject(payload) ) {

        throw th(`setCookie: Expected payload to be an object`);
    }

    let token   = await opt.generatetoken(payload, formrememberme, opt);

    if ( typeof token !== 'string' ) {

        log.dump({
            coovalisnotstring: token,
        });

        throw th(`value for cookie is not a string, better convert value on your own to string`);
    }

    token = wrapCookieValue(token, formrememberme, opt);

    opt.debug && log.dump({
        newrawtoken: token.token,
        mode,
    });

    return {
        done        : await opt.setcookie(res, token.token, formrememberme, opt),
        expireDate  : token.expireDate,
    };
}

async function unpackRawToken(jwttoken, req, res, opt) {

    let [__, formrememberme, expireAt, value] = decodeURIComponent(jwttoken).match(/^([^:]*)(?::([^:]+))?(?::(.+))?$/);

    if ( ! expireAt ) {

        throw th(`expiraAt can't be empty in jwttoken: ` + jwttoken);
    }

    if ( ! value ) {

        value           = expireAt;

        expireAt        = formrememberme;

        formrememberme  = false;
    }

    if ( typeof formrememberme === 'string' ) {

        formrememberme = true;
    }

    expireAt = parseCookieTime(expireAt);

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse#Examples
    // Date.parse("2019-01-01T00:00:00.000Z")
    // Date.parse("2019-01-01T00:00:00.000+00:00")
    // is not the same like:
    // Date.parse("2019-01-01T00:00:00")
    const expireAtAsDate = new Date(Date.parse(expireAt + '.000Z'));

    let payload = await opt.verifyandextractpayload(
        value,
        opt,
        formrememberme,
        () => opt.signout(req, res, opt)
    );

    opt.debug && log.dump({
        verifiedpayloadattachingtoreq: {
            payload,
            underreqkey: opt.requestauthfield
        },
        split: {
            formrememberme,
            expireAt,
            value,
        }
    }, 5);

    const threshold     = (function (t) {

        t.setTime(t.getTime() - (opt.rememberme * 1000));

        return t.getTime();

    }(new Date(Date.parse(expireAt))));

    const now   =   (new Date()).getTime();

    return [
        payload,
        value,
        formrememberme,
        expireAt,
        expireAtAsDate,
        threshold,
        now
    ];
}

async function refreshToken(res, opt, payload) {

    try {

        if ( typeof opt.clearpayloadbeforerefresh === 'function' ) {

            payload = await opt.clearpayloadbeforerefresh(payload);
        }

        const {
            done,
            expireDate,
        } = await setCookie(res, payload, true, `attempt to refresh token`, opt);

        if (done !== true) {

            log.dump({
                setrefreshedtoken: "failed",
            });
        }

        return expireDate;
    }
    catch (e) {

        throw {
            console : e,
            web     : `couldn't refresh token`,
        };
    }
}

function parseCookieTime(ctime) {

    const p = ctime.match(/^(\d{4})_(\d{2})_(\d{2})T(\d{2})_(\d{2})_(\d{2})$/);

    if (p.length !== 7) {

        throw th(`invalid expireAt format: '${e}'`);
    }

    return p[1] + '-' + p[2] + '-' + p[3] + 'T' + p[4] + ':' + p[5] + ':' + p[6];
}

function wrapCookieValue (token, formrememberme, opt) {

    if ( typeof formrememberme === 'undefined' ) {

        throw th(`formrememberme shouldn't be undefined, should be true or false`);
    }

    let t = new Date();

    t.setTime(t.getTime() + opt.expire * 1000);

    const tt = t.toISOString().substring(0, 19).replace(/[:-]/g, '_');

    token = ( tt + ':') + token;

    if ( opt.rememberme && formrememberme ) {

        token = 'r:' + token;
    }

    return {
        token,
        expireDate: t,
    };
}

function isObject(o) {
    return Object.prototype.toString.call(o) === '[object Object]';
}

function th(msg) {
    return new Error(`securityabstract.js: ` + msg);
}

/**
 * Just set of validator methods for input parameter
 */
function str(target, field) {

    if ( typeof target[field] !== 'string') {

        throw th(`option '${field}' must be string`);
    }

    target[field] = target[field].trim();

    if ( ! target[field] ) {

        throw th(`option '${field}' is an empty string`);
    }
}
function fnc(target, field) {

    if ( typeof target[field] !== 'function') {

        throw th(`option '${field}' must be function`);
    }
}
function num(target, field, min = 0) {

    if ( typeof target[field] !== 'number') {

        throw th(`option '${field}' must be number`);
    }

    if (target[field] <= min ) {

        throw th(`option '${field}' must be bigger equal than ` + min);
    }
}