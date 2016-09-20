# blue-frog-b

create a JSON-RPC 2.0 server/client that corresponds to the batch processing.

## usage

### server

```js
const http     = require('http')
const ecstatic = require('ecstatic')(__dirname + '/static')
const rpc      = require('blue-frog-b')({prefix: '/rpc'})
const app      = http.craeteServer(ecstatic)

function add (a, b) { return Number(a) + Number(b) }

rpc.on('sum', (params, done) => {
    setTimeout(() => {
        try { done(null, params.reduce(add, 0)) }
        catch (err) { done(err) }
    }, 500)
})

rpc.on('add', (params, done) => {
    setTimeout(() => {
        try { done(null, add.apply(null, params)) }
        catch (err) { done(err) }
    }, 800)
})

rpc.install(app)
app.listen(9999, () => console.log('listen on port %s', app.address().port))
```

### browser

```js
var hyperquest = require('hyperquest')
var rpc        = require('blue-frog-stream')
var client     = require('blue-frog-b')

window.onload = function () {
    var hyp = hyperquest.post('http://0.0.0.0:9999/rpc')
    var b   = client()

    hyp.setHeader('content-type', 'application/json')
    hyp.on('error', onError)
    b.on('error', onError)

    b
    .pipe(new rpc.request.BatchStream(true)).on('error', onError)
    .pipe(hyp)
    .pipe(b)

    var sum = b.request('sum', [1,2,3])
    var add = b.request('add', [4, 5])

    sum.on('error', onError)
    add.on('error', onError)

    sum.once('data', function (result) {
        console.log('sum(1, 2, 3) => ', result)
        // 'sum(1, 2, 3) => 6
    })
    add.once('data', function (result) {
        console.log('add(4, 5) => ', result)
        // 'add(4, 5) => 9
    })

    b.batch([sum, add])
}

function onError (err) {
    console.log(err)
    ;('data' in err) && console.log(err.data)
}
```

author

ishiduca@gmail.com

license

MIT
