[![npm version](https://badge.fury.io/js/secure-express.svg)](https://badge.fury.io/js/secure-express)
[![NpmLicense](https://img.shields.io/npm/l/secure-express.svg)](https://github.com/stopsopa/secure-express/blob/master/LICENSE)

# Simplest use

```javascript

const bodyParser    = require('body-parser');

const express       = require('express');

const app           = express();

app.use(express.static(path.resolve(__dirname, 'public')));

app.use(require('nlab/express/console-logger'));

const secret        = "super_secret_password_to_encrypt_jwt";

app.use(bodyParser.urlencoded({
    extended: true, // WARNING: required for secure-express
    // without this scripts on server wont be able to see values submitted from form
}));

const security = require('secure-express/securityjwt');

const middlewares = security({
    // debug: true,
    secret,
    userprovider: async (username, opt) => {

        const users = [
            {
                username: 'admin',
                password: 'pass',
                // jwtpayload: {
                //     username: 'admin',
                //     role: 'admin'
                // }
            },
            {
                username: 'abc',
                password: 'def',
                // jwtpayload: {
                //     username: 'admin',
                //     role: 'user'
                // }
            },
        ];

        return users.find(u => u.username === username);
    },
    authenticate: async (user = {}, password, opt) => {
        return user.password === password;
    },
    extractpayloadfromuser: async (user, opt) => {
        return user.jwtpayload || {};
    },
});

app.use(middlewares.secure);

app.use('/signout', middlewares.signout);

app.use((req, res) => {

    res.set('Content-type', 'text/html; charset=UTF-8');

    res.end(`TOP SECRET <a href="/signout">sign out</a> <br /> url: ` + req.url)
});

const port = process.env.NODE_BIND_PORT;

const host = process.env.NODE_BIND_HOST;

const server = app.listen(port, host, () => {

    console.log(`\n 🌎  Server is running ` + ` ${host}:${port} ` + "\n")
});

```

# About architecture

The core script is [securityabstract.js](lib/securityabstract.js), (I'm encoriging to see how things are implemented - it's quite simple) this script is responsible for creating authentication cookie after correct login, it doesn't impose any encryption method for cookie content.

Another script is [securityjwt.js](lib/securityjwt.js) which is extension of default configuration of securityabstract.js and it is focused on encrypting cookie using JWT.

It is possible to create another method of encryption of sesion cookie which is up to you. Cheers...

