
const fs        = require('fs');

const template  = require('lodash/template');

module.exports  = file => {

    const html  = fs.readFileSync(file).toString();

    let tmp;

    try {

        tmp   = template(html,{
            variable: 'd'
        });
    }
    catch (e) {

        throw `security: lodash/template syntax error: ` + (e + '');
    }

    return (res, errors = {}) => {

        res.set('Content-type', 'text/html; charset=UTF-8');

        res.end(tmp(errors));
    }
}