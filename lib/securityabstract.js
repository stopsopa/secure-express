
const path          = require('path');

const fs            = require('fs');

const log           = require('inspc');

const authhtml      = require('./form');

const th    = msg => `security: ` + msg;

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

module.exports = opt => {

    opt = Object.assign({}, {
        protect: (req, res, opt) => {
            // if field NOT exist then protect -> (then return true)
            return !req[opt.requestauthfield];
        },
        cookiename          : 'nodesession',
        requestauthfield    : 'auth',
        debug               : false,
        expire              : 32400, // in seconds (in this case 9 hours)
        templateFile        : path.resolve(__dirname , 'form.html'),
        secret              : null,
        userprovider: async (username, opt) => {
            throw th(`userprovider option not implemented`)
        },
        authenticate: async (user = {}, password, opt) => {
            throw th(`authenticate option not implemented`)
        },
        extractpayloadfromuser: async (user, opt) => {
            throw th(`extractpayloadfromuser option not implemented`)
        },
        generatetoken: async (payload = {}, opt) => {
            throw th(`generatetoken option not implemented`)
        },
        setcookie: async (res, value, opt) => {

            res.cookie(opt.cookiename, value, { // https://expressjs.com/en/4x/api.html#res.cookie
                maxAge      : opt.expire * 1000, // maxAge in miliseconds
                httpOnly    : true, // can't be manipulated in js
            });

            return true;
        },
        /**
         * Warning: exception thrown in this method will be showd on the frontend as an authentication error
         * for example you can emit message on the front by throwing exception like this:
         *
         *      throw `JWT token expired`
         */
        verifyandextractpayload: async (value) => {
            throw th(`verifyandextractpayload option not implemented`)
        },
        signout: (req, res, opt) => {
            res.clearCookie(opt.cookiename, {
                httpOnly    : true, // can't be manipulated in js
            });
        },
        redirectaftersignout: '/',
        // redirectaftersignout: (req, res, opt) => {
        //     throw th(`redirectaftersignout option not implemented`)
        // },
    }, opt);

    const d     = opt.debug ? msg => console.log(`security debug: ` + msg) : () => {};

    str(opt, 'secret');

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

    const template = authhtml(opt.templateFile);

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

                await opt.redirectaftersignout(payload);
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