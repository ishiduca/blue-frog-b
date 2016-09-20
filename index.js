var events   = require('events')
var url      = require('url')
var inherits = require('inherits')
var through  = require('through2')
var body     = require('body/json')
var rpc      = require('blue-frog-stream')
var response = require('blue-frog-core/response')
var rpcError = require('blue-frog-core/error')

module.exports = BlueFrog
inherits(BlueFrog, events.EventEmitter)

function BlueFrog (prefix) {
    if (!(this instanceof BlueFrog)) return new BlueFrog(prefix)
    events.EventEmitter.call(this)

    var PREFIX = '/'
    if (! prefix) prefix = {prefix: PREFIX}
    if (typeof prefix === 'string') prefix = {prefix: prefix}
    if (! prefix.prefix) prefix.prefix = PREFIX
    this.prefix = prefix.prefix
}

function handler (req, res) {
    var me = this
    var flg = req.method.toUpperCase() === 'POST' &&
              url.parse(req.url).pathname === this.prefix

    if (! flg) return false

    body(req, res, function (err, result) {
        var batch = new rpc.response.BatchStream(true)

        batch.on('error', function (err) {
            me.emit('error', err)
        })
        .pipe(through.obj(function (json, _, done) {
            res.setHeader('accept', 'application/json')
            res.setHeader('content-type', 'application/json')
            res.setHeader('content-length', Buffer.byteLength(json))
            done(null, json)
        }))
        .pipe(res)

        if (err) return batch.end(parseError(err))

        var ps = []
        var parse = new rpc.request.ParseStream(result)
        .on('error', function (err) {
            batch.write(invalidRequest(err))
        })
        .pipe(through.obj(function (req, _, done) {
            ps.push(new Promise(function (onSuccess) {
                if (! me.emit(req.method, req.params, done))
                    onSuccess(methodNotFound(req))

                function done (err, result) {
                    if (err) onSuccess(invalidParams(err, req))
                    else onSuccess(response(req.id, result))
                }
            }))
            done()
        }, function (done) {
            var that = this
            Promise.all(ps).then(function (results) {
                results.forEach(function (result) {
                    if (result.id) that.push(result)
                    else if (result.error) that.push(result)
                })
                that.push(null)
                done()
            })
        }))
        .pipe(batch)
    })

    return true
}

function parseError (err) {
    return response.error(null, rpcError.ParseError(err))
}
function invalidRequest (err) {
    return response.error(err.id || null, rpcError.InvalidRequest(err))
}
function methodNotFound (req) {
    return response.error(req.id || null, rpcError.MethodNotFound(
                'method "' + req.method + '" not found :(' ))
}
function invalidParams (err, req) {
    return response.error(req.id || err.id || null
              , rpcError.InvalidParams(err))
}

BlueFrog.prototype.install = function (server) {
    var me           = this
    var EVENT_NAME   = 'request'
    var oldListeners = server.listeners(EVENT_NAME).slice(0)
    var newListener  = function () {
        if (handler.apply(me, arguments) !== true) {
            for (var i = 0; i < oldListeners.length; i++) {
                oldListeners[i].apply(server, arguments)
            }
            return false
        }
        return true
    }
    server.removeAllListeners(EVENT_NAME)
    server.addListener(EVENT_NAME, newListener)
}
