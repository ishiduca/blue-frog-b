var stream     = require('readable-stream')
var uuid       = require('uuid')
var inherits   = require('inherits')
var BufferList = require('bl')
var request    = require('blue-frog-core/request')
var rpc        = require('blue-frog-stream')

module.exports = Frog
module.exports.Tadpole = Tadpole

var REQUEST      = 'request'
var NOTIFICATION = 'notification'

inherits(Frog, stream.Duplex)
inherits(Tadpole, stream.Transform)

function Frog () {
    if (!(this instanceof Frog)) return new Frog()
    stream.Duplex.call(this, {objectMode: true})
    this.bufferList = new BufferList()
    this.tadpoles   = {}
}

Frog.prototype._read = function () {}
Frog.prototype._write = function (buf, _, done) {
    this.bufferList.append(buf)
    done()
}

Frog.prototype.end = function (chunk) {
    var flg = stream.Duplex.prototype.end.apply(this, arguments)

    var me = this
    var str = me.bufferList.toString()

    if (! str) return this.emit('parseEnd')

    var result; try {
        result = JSON.parse(str)
    } catch (err) {
        err.data = str
        me.emit('error', err)
        return flg
    }

    new rpc.response.ParseStream(result)
        .on('error', onError)
        .on('data', function (res) {
            var tadpole = me.tadpoles[res.id]
            if (tadpole) tadpole.write(res)
            else me.emit('error', notFoundTadpole(res))
        })
        .once('end', function () {
            me.emit('parseEnd')
        })

    return flg

    function onError (err) {
        if (err.id && me.tadpoles[err.id])
             me.tadpoles[err.id].emit('error', err)
        else me.emit('error', err)
    }

    function notFoundTadpole (res) {
        var err = new Error('not found tadpole :( id "' + res.id + '"')
        err.data = res
        return err
    }
}

Frog.prototype.request = function (method, params) {
    return new Tadpole(method, params)
}

Frog.prototype.notification = function (method, params) {
    return new Tadpole(method, params, NOTIFICATION)
}

Frog.prototype.batch = function (tadpoles) {
    var me   = this
    var _id = uuid.v4().split('-').join('')
    this.tadpoles = [].concat(tadpoles).reduce(function (x, tadpole, i) {
        var id  = _id + '--' + i
        x[id] = tadpole
        me.push(tadpole.createRequest(id))
        return x
    }, this.tadpoles)
    me.push(null)
}

function Tadpole (method, params, type) {
    if (!(this instanceof Tadpole)) return new Tadpole(method, params, type)
    stream.Transform.call(this, {objectMode: true})
    this.type = type === NOTIFICATION ? NOTIFICATION : REQUEST
    this.args = [method, params]
}

Tadpole.prototype.createRequest = function (id) {
    this.id = id
    return request.apply(null
            , [this.type === REQUEST ? id : null].concat(this.args))
}

Tadpole.prototype._transform = function (response, _, done) {
    if (response.error) done(response.error)
    else done(null, response.result)
}
