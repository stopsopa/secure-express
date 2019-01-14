
const path          = require('path');

const fs            = require('fs');

const log           = require('inspc');

const form          = require('./form');

const th            = msg => `securityabstract.js: ` + msg;

/**
 * Just set of validator methods for input parameter
 */
const str = (target, field) => {

    if ( typeof target[field] !== 'string') {

        throw th(`option field must be string`);
    }

    target[field] = target[field].trim();

    if ( ! target[field] ) {

        throw th(`option field is an empty string`);
    }
}
const fnc = (target, field) => {

    if ( typeof target[field] !== 'function') {

        throw th(`option ${field} must be function`);
    }
}
const num = (target, field, min = 0) => {

    if ( typeof target[field] !== 'number') {

        throw th(`option ${field} must be number`);
    }

    if (target[field] <= min ) {

        throw th(`option ${field} must be bigger equal than ` + min);
    }
}

/**
 * Method creating two middlewares, one for main authentication another for signing out
 * @param opt
 */
module.exports = opt => {

    /**
     * Default options
     */
    opt = Object.assign({}, {
        protect: (req, res, opt) => {
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
        expire              : 32400, // in seconds (in this case 9 hours)
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
        generatetoken: async (payload = {}, opt) => {
            throw th(`generatetoken option not implemented`);
        },
        setcookie: async (res, value, opt) => {

            res.cookie(opt.cookiename, value, { // https://expressjs.com/en/4x/api.html#res.cookie
                maxAge      : opt.expire * 1000, // maxAge in miliseconds
                httpOnly    : true, // can't be manipulated in js
            });

            return true;
        },
        /**
         * Warning: exception thrown in this method will be shown on the frontend as an authentication error
         * for example you can emit message on the front so be careful to not throw any sensitive informations.
         * Convert any native throw messages to something more neutral like:
         *
         *      throw `JWT token expired`
         */
        verifyandextractpayload: async value => {
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
        signout: (req, res, opt) => {
            res.clearCookie(opt.cookiename, {
                httpOnly    : true, // can't be manipulated in js
            });
        },
        redirectaftersignout: '/',
        // redirectaftersignout: (payload, opt) => {
        //     throw th(`redirectaftersignout option not implemented`)
        // },
    }, opt);

    const d     = opt.debug ? msg => console.log(`security debug: ` + msg) : () => {};

    str(opt, 'cookiename');

    str(opt, 'requestauthfield');

    fnc(opt, 'protect');

    fnc(opt, 'userprovider');

    fnc(opt, 'authenticate');

    fnc(opt, 'extractpayloadfromuser');

    fnc(opt, 'generatetoken');

    fnc(opt, 'verifyandextractpayload');

    fnc(opt, 'signout');

    num(opt, 'expire', 15 * 60);

    str(opt, 'templateFile');

    if ( typeof opt.redirectaftersignout !== 'string' && typeof opt.redirectaftersignout !== 'function') {

        throw th(`redirectaftersignout is not a funciton nor a string`);
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
            header: opt.header,
        }, params));
    }(form(opt.templateFile)));

    const tool = {};

    tool.secure = async (req, res, next) => {

        const cookies = (req.headers.cookie || '').split(';').reduce((acc, coo) => {
            const tmp   = coo.split('=');
            const name  = tmp.shift().trim();
            const value = tmp.join('=').trim();
            name && (acc[name] = value);
            return acc;
        }, {});

        if (cookies[opt.cookiename]) {

            opt.debug && log.dump({
                cookieFound: cookies[opt.cookiename]
            });

            try {

                req[opt.requestauthfield] = await opt.verifyandextractpayload(cookies[opt.cookiename]);

                opt.debug && log.dump({
                    payloadextracted: req[opt.requestauthfield],
                })
            }
            catch (e) {

                return template(res, {
                    general: e + ''
                });
            }
        }
        else {

            let loginrequest = false;

            try {
                loginrequest = req.body['auth-hidden-field'] === 'auth-hidden-value';
            }
            catch (e) {

                d(req.url + ': ' + (e + ''))
            }

            let errors = {};

            if (loginrequest) {

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
                    })

                    if ( ! user ) {

                        return template(res, {
                            general: "Invalid username or password"
                        });
                    }

                    const authenticated = await opt.authenticate(user, req.body.password, opt);

                    opt.debug && log.dump({
                        authenticated,
                    })

                    if ( ! authenticated ) {

                        return template(res, {
                            general: "Invalid username or password"
                        });
                    }

                    const payload = await opt.extractpayloadfromuser(user, opt);

                    opt.debug && log.dump({
                        extractedpayloadfromuser: payload
                    })

                    const token   = await opt.generatetoken(payload, opt);

                    opt.debug && log.dump({
                        generatedtoken: token,
                    })

                    const done    = await opt.setcookie(res, token, opt);

                    if (done === true) {

                        req[opt.requestauthfield] = payload;

                        return res.redirect(req.url);
                    }
                    else {

                        throw th(`couldn't set cookie`);
                    }
                }
                catch (e) {

                    log.dump({
                        generalerror: e,
                    }, 3);

                    return next();
                }
            }
        }

        if ( opt.protect(req, res, opt) ) {

            opt.debug && log.dump(req[opt.requestauthfield]);

            return template(res);
        }

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

                log.dump({
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

        return res.redirect(url);
    }

    return tool;
};