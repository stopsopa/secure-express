
const path          = require('path');

const fs            = require('fs');

const log           = require('inspc');

const form          = require('./form');

tools.extend = opt => order(Object.assign({}, {
    /**
     *
     * @param req
     * @param res
     * @param opt
     * @returns {Promise<boolean>}:
     *      true    - show login form because user is not authenticated,
     *      false   - carry on, user authenticated (don't show login form)
     */
    showloginform: async (req, res, opt) => {
        // main logic of distinguishing if secure following routes with or not
        // in this case it's protecting if request object have field "auth"
        // but you're free to change it to realay on req.url and "auth" field
        // or on particular value in "auth" field like auth.role === 'user'

        // if field NOT exist then protect -> (then return true)
        return !req[opt.requestauthfield];
    },
    cookiename          : 'nodesession', // just name of session cookie
    requestauthfield    : 'auth', // name of field attached to request object if successfully authenticated
    debug               : false, // debug mode - print all internal states to terminal
    expire              : 60 * 60 * 9, // in seconds (in this case 9 hours)
    templateFile        : path.resolve(__dirname , 'form.html'), // template parsed by lodash/template https://lodash.com/docs/4.17.11#template
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
    redirectaftersignout: '/',
    // redirectaftersignout: (payload, opt) => {
    //     throw th(`redirectaftersignout option not implemented`)
    // },
}, opt));

function tools(opt) {

    /**
     * Default options
     */
    opt = tools.extend(opt);

    const d     = opt.debug ? msg => console.log(`security debug: ` + msg) : () => {};

    str(opt, 'cookiename');

    str(opt, 'requestauthfield');

    fnc(opt, 'showloginform');

    fnc(opt, 'userprovider');

    fnc(opt, 'authenticate');

    fnc(opt, 'extractpayloadfromuser');

    fnc(opt, 'generatetoken');

    fnc(opt, 'verifyandextractpayload');

    fnc(opt, 'signout');

    num(opt, 'expire', 14);

    str(opt, 'templateFile');

    if ( typeof opt.redirectaftersignout !== 'string' && typeof opt.redirectaftersignout !== 'function') {

        throw th(`redirectaftersignout is not a funciton nor a string`);
    }

    if ( opt.validatepayload !== false && typeof opt.validatepayload !== 'function' ) {

        throw th(`opt.validatepayload can be only false or function`)
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

        const wrapCookieValue = (value, formrememberme) => {

            if ( typeof formrememberme === 'undefined' ) {

                throw `formrememberme shouldn't be undefined, should be true or false`;
            }

            const t = new Date();

            t.setTime(t.getTime() + opt.expire * 1000);

            value = ( parseInt((t.getTime() / 1000), 10) + ':') + value;

            if ( opt.rememberme && formrememberme ) {

                value = 'r:' + value;
            }

            return value;
        };

        const setCookie = async (payload, formrememberme, mode) => {

            let token   = await opt.generatetoken(payload, formrememberme, opt);

            if ( typeof token !== 'string' ) {

                log.dump({
                    coovalisnotstring: value,
                });

                throw th(`value for cookie is not a string, better convert value on your own to string`);
            }

            token = wrapCookieValue(token, formrememberme);

            opt.debug && log.dump({
                newrawtoken: token,
                mode,
            });

            return await opt.setcookie(res, token, formrememberme, opt);
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

                    return general("Invalid username or password");
                }

                const authenticated = await opt.authenticate(user, req.body.password, opt);

                opt.debug && log.dump({
                    authenticated,
                })

                if ( ! authenticated ) {

                    return general("Invalid username or password");
                }

                const payload = await opt.extractpayloadfromuser(user, opt);

                if ( typeof opt.validatepayload === 'function' ) {

                    await opt.validatepayload(payload);
                }

                opt.debug && log.dump({
                    extractedpayloadfromuser: payload
                });

                const done    = await setCookie(payload, formrememberme, `normal set`);

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

        if (cookies[opt.cookiename]) {

            opt.debug && log.dump({
                rawcookiefound: cookies[opt.cookiename]
            });

            try {

                let [ex, formrememberme, expireAt, value] = decodeURIComponent(cookies[opt.cookiename]).match(/^([^:]*)(?::([^:]+))?(?::(.+))?$/);

                if ( ! expireAt ) {

                    throw th(`expiraAt can't be empty in cookie: ` + cookies[opt.cookiename]);
                }

                if ( ! value ) {

                    value           = expireAt;

                    expireAt        = formrememberme;

                    formrememberme  = false;
                }

                if ( typeof formrememberme === 'string' ) {

                    formrememberme = true;
                }

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
                }, 5)

                req[opt.requestauthfield] = payload;

                // let expire, value, ex;

                if ( opt.rememberme && formrememberme) {

                    if ( expireAt && /^\d+$/.test(expireAt) ) {

                        expireAt            =   parseInt(expireAt, 10);

                        expireAt            *=  1000;

                        const threshold     = (function (t) {

                            t.setTime(expireAt - (opt.rememberme * 1000));

                            return t.getTime();

                        }(new Date()));

                        const now   =   (new Date()).getTime();

                        opt.debug && log.dump({
                            refreshtoken: {
                                now______    : now,
                                threshold,
                                expireAt_   : expireAt,
                                'now > threshold': now > threshold,
                            }
                        })

                        if ( now > threshold ) {

                            try {

                                if ( typeof opt.clearpayloadbeforerefresh === 'function' ) {

                                    payload = await opt.clearpayloadbeforerefresh(payload);
                                }

                                const done    = await setCookie(payload, true, `attempt to refresh token`);

                                if (done !== true) {

                                    log.dump({
                                        setrefreshedtoke: "failed",
                                    });
                                }
                            }
                            catch (e) {

                                throw {
                                    console : e,
                                    web     : `couldn't refresh token`,
                                };
                            }
                        }
                    }
                    else {

                        log.dump({
                            optremembermeonthenshouldbeexpiresegmentincookie: {
                                rawcookie: cookies[opt.cookiename]
                            }
                        }, 3);
                    }
                }

                opt.debug && log.dump({
                    payloadextracted: req[opt.requestauthfield],
                    opt,
                })
            }
            catch (e) {

                if (e && e.console) {

                    log.dump({
                        generalerrorsplit: (e + ''),
                    })

                    return general(e.web);
                }

                log.dump({
                    generalerror: (e + '')
                });

                return general(e + '')
            }
        }

        const showloginform = await opt.showloginform(req, res, opt);

        if ( showloginform ) {

            log.t(`condition not fulfilled -> rendering login form`);

            return template(res);
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

    return tool;
};

tools.order     = order;

tools.isObject  = isObject;

module.exports  = tools;

function order(obj) {

    if ( ! isObject(obj) ) {

        throw `secirutyabstract.order, 'obj' param is not an object, it is: ` + (typeof obj);
    }

    const keys = Object.keys(obj);

    keys.sort();

    return keys.reduce((acc, key) => {

        acc[key] = obj[key];

        return acc;

    }, {});
}

function isObject(o) {
    return Object.prototype.toString.call(o) === '[object Object]';
}

function th(msg) {
    return `securityabstract.js: ` + msg;
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