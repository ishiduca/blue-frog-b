'use strict'
const BlueFrog = require('../../index')
const http     = require('http')

module.exports = function (port, onlisten) {
    const rpc = new BlueFrog('/rpc/test')
    const app = http.createServer(notFound)

    rpc.on('sum', (params, done) => {
        setTimeout(() => {
            try {done(null, params.reduce(add, 0))}
            catch (err) { done(err) }
        }, 900)
    })

    rpc.on('multi', (params, done) => {
        setTimeout(() => {
            try {done(null, params.reduce(multi, 1))}
            catch (err) { done(err) }
        }, 800)
    })

    rpc.on('reverse', (params, done) => {
        try {done(null, params.slice(0).reverse())}
        catch (err) { done(err) }
    })

    rpc.install(app)

    app.listen(port, () => onlisten(app))
}

function notFound (req, res) {
    res.statusCode = 404
    res.end(req.url + ' not found')
}

function add (a, b) {
    return Number(a) + Number(b)
}

function multi (a, b) {
    return Number(a) * Number(b)
}
