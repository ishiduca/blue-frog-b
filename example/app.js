'use strict'
const http     = require('http')
const ecstatic = require('ecstatic')(__dirname + '/static')
const rpc      = require('blue-frog-b')({prefix: '/rpc'})
const app      = module.exports = http.createServer(ecstatic)

rpc.on('sum', (params, done) => {
    setTimeout(() => {
        try { done(null, params.reduce((a,b) => Number(a) + Number(b), 0)) }
        catch (err) { done(err) }
    }, 800)
})

rpc.on('multi', (params, done) => {
    try { done(null, params.reduce((a,b) => Number(a) * Number(b), 1)) }
    catch (err) { done(err) }
})

rpc.install(app)

if (! module.parent) {
    app.listen(9999, () => console.log('server start to listen on port %d', app.address().port))
}
