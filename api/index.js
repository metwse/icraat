const http = require('http')
const express = require('express')
const rateLimit = require('express-rate-limit')
const cors = require('cors')

const fs = require('fs')
const { Client } = require('pg')



//#region -- -- -- -- MISC
const HOST = require('./config/host.json')
const ERRORS = require('./config/errors.json')
const DATABASE = require('./config/database.json')
const misc = require('./utils/misc.js')
const required = require('./utils/request-requirements.js')

const app = express()
const server = http.createServer(app)

const client = new Client(DATABASE)
client.connect()
//#endregion



//#region -- -- -- -- MIDDLEWARES
app.set('trust proxy', true)

app.use(express.json())
app.use(cors({ origin: ['http://icraat.metw'] }))

app.use((req, res, next) => {
    req.url = req.url.slice(HOST.base.length)
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Auth');
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE')
    res.throw = (code, _message, details) => {
        var [message, httpCode] = ERRORS[code]
        if (_message != null) for (let i = 0; i < _message.length; i++) message = message.replace(`$${i + 1}`, _message[i])
        res.status(httpCode).json({ message, code, details }); return false
    }
    next()
})

const limit = (per, seconds, message = 'Too many requests', lookup = 'headers.x-forwarded-for') => rateLimit({ windowMs: seconds * 1000, max: per, standardHeaders: true, legacyHeaders: false, lookup: lookup, handler: (req, res) => res.throw(104, [message]) })
//#endregion



app.get('/', (req, res) => res.json({ uptime: ~~(performance.now() / 1000), message: 'ok' }))




//#region -- -- -- -- PRIMITIVE DATA TYPES
const dataTypes = ['exams', 'lessons', 'publishers', 'exams.categories']
dataTypes.mappings = {
    'exams': 'exams.', 'exams.categories': 'exams.categories_',
    'lessons': 'lessons.', 'publishers': 'publishers.'
}

dataTypes.routes = dataTypes.map(v => '/' + v.replace(/\./g, '/'))

app.use(dataTypes.routes, (req, res, next) => {
    var _prefix = req._parsedUrl.pathname.match(/[a-z]+/g)
    while (!req.prefix) {
        req.prefix = dataTypes.mappings[_prefix.join('.')]
        _prefix.pop()
    }
    next()
})

app.get(dataTypes.routes.map(v => v + '/search'), async (req, res) => {
    const { rows: [{ ids: data }] } = await client.query(`SELECT * FROM ${req.prefix}search($1, $2)`, [req.query.query ?? req.query.q, (req.query.filter && req.query.filter.split(';')) ?? ['', '']])
    if (!data) return res.throw(103)
    res.json(data)
})


app.get(dataTypes.routes.map(v => v + '/:id'), async (req, res) => {
    if (!misc.pg.isInt(+req.params.id)) return res.throw(100)
    const { rows: [exam] } = await client.query(`SELECT * FROM ${req.prefix}get(${req.params.id})`)
    if (!exam) return res.throw(103)
    res.json(exam)
})

const bulkGetQueryToSQL = query => {
    var result = '', keys = Object.keys(query)
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i]
        result += `SELECT get.* FROM unnest(ARRAY[${query[key]}]::integer[]), ${key + (key.includes('.') ? '_get' : '.get')}(unnest) AS get;`
    }
    return result
}
app.post('/bulk', async (req, res) => {
    var query = {}
    var keys = Object.keys(req.body)
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i]
        if (dataTypes.includes(key)) query[key] = req.body[key].slice(0, 499).filter(v => misc.pg.isInt(v))
    }
    const sqlQuery = bulkGetQueryToSQL(query)
    if (!sqlQuery) return res.json({})
    var data = await client.query(sqlQuery)
    if (!Array.isArray(data)) data = [data]
    keys = Object.keys(query)
    for (let i = 0; i < data.length; i++) query[keys[i]] = data[i].rows
    res.json(query)

})
//#endregion



//#region -- -- -- -- DASHBOARD
app.get('/dashboard', async (req, res) => {
    const { rows: [data] } = await client.query(`SELECT * FROM get_dashboard()`)
    res.json(data)
})

app.get('/dashboard/filters', async (req, res) => {
    const { rows: [data] } = await client.query(`SELECT * FROM get_filters()`)
    res.json(data)
})
//#endregion



!(async () => {
    if (process.argv.slice(2).includes('init'))
        await client.query(`${['init.sql'].concat(fs.readdirSync('./sql').filter(file => file != 'init.sql')).map(file => fs.readFileSync(`./sql/${file}`, 'utf8')).join(';').replaceAll('\ufeff', '') }`)

    server.listen(HOST.port, HOST.name, () => console.log(`http://${HOST.name}:${HOST.port}`))
})()