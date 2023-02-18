const misc = require('./misc.js')

module.exports = class {
    static #Type = class { }
    static #Error = class {
        constructor(path, rule) { this.path = isNaN(path) ? path : `[${path}]`, this.rule = rule, this.last = path }
        key(path) { this.path = isNaN(path) ? `${path}${isNaN(this.last) ? '.' : ''}${this.path}` : `[${path}]${isNaN(this.last) ? '.' : ''}${this.path}`, this.last = path; return this }
    }

    static #checkError(tested) { return tested === undefined || Object.getPrototypeOf(tested) == this.#Error.prototype }

    static #typeTest(_val, rule) {
        if (_val == null || typeof _val == 'object') return rule.default
        var val = rule.type == 'string' ? _val + '' : _val
        if (rule.type == 'string' &&
            ((rule.length && rule.length !== val.length) ||
                (rule.max && !(val.length < rule.max || (rule.maxE && val.length === rule.max))) ||
                (rule.min && !(val.length > rule.min || (rule.minE && val.length === rule.min))))) return rule.default
        else if (rule.type == 'int' || rule.type == 'integer' || rule.type == 'smallint' || rule.type == 'bigint') {
            try {
                val = rule.type == 'bigint' ? BigInt(val) : Number.parseInt(val)
                if (isNaN(_val)) return rule.default
                else if (rule.max && !(val < rule.max || (rule.maxE && val === rule.max))) return rule.maxF ? rule.max : rule.default
                else if (rule.min && !(val > rule.min || (rule.minE && val === rule.min))) return rule.maxF ? rule.min : rule.default
                else if ((rule.type == 'smallint' && !misc.pg.isSmallint(val)) ||
                    ((rule.type == 'int' || rule.type == 'integer') && !misc.pg.isInt(val)) ||
                    (rule.type == 'bigint' && !misc.pg.isBigint(val))) return rule.default
            } catch { return rule.default }
        } else if (rule.type == 'bool' || rule.type == 'boolean') return val
        return val
    }
    static #schemaTest(obj, schema, strict) {
        if (Object.getPrototypeOf(schema) == this.#Type.prototype) return this.#typeTest(obj, schema)
        else if (Array.isArray(schema)) {
            var filler, res = []
            for (let i = 0; i < Math.max(obj?.length || 0, schema.length); i++) {
                if (schema[i]?.fill) filler = schema[i]
                if (!filler && schema.length - 1 < i) return res
                const tested = this.#schemaTest(obj?.[i], schema[i] || filler, strict)
                if ((schema[i] || filler).optional) { if (tested !== undefined) res[i] = tested }
                else if (strict && this.#checkError(tested)) return tested ? tested.key(i) : new this.#Error(i, (schema[i] || filler).origin)
                else res[i] = tested
            }
            return res
        }
        var _keys = Object.keys(schema), res = {}
        for (let i = 0; i < _keys.length; i++) {
            let key = _keys[i]
            const tested = this.#schemaTest(obj?.[key], schema[key], strict)
            if (schema[key].optional) { if (tested !== undefined) res[key] = tested }
            else if (strict && this.#checkError(tested)) return tested ? tested.key(key) : new this.#Error(key, schema[key].origin)
            else res[key] = tested
        }
        return res
    }

    static #type(_type) {
        var res = new this.#Type(), [_, type, def] = _type.includes(';') ? _type.match(/([\s\S]+);([\s\S]*)/) : [null, _type, undefined]
        type = type.split(','), res.type = type[0]
        res.origin = _type
        if (def != null) switch (res.type) {
            case 'string': res.default = def; break
            case 'bool':
            case 'boolean': res.default = def == 'true'; break
            default: res.default = Number.parseInt(def)
        }
        for (let i = 1; i < type.length; i++) {
            let c = type[i]
            if (c.match(/(\[|\(|{)/)) {
                res.min = Number(c.slice(1))
                switch (c[0]) {
                    case '[': res.minE = true; break
                    case '{': res.minF = true; break
                }
            }
            else if (c.match(/(\]|\)|})/)) {
                res.max = Number(c.slice(0, c.length - 1))
                switch (c[c.length - 1]) {
                    case ']': res.maxE = true; break
                    case '}': res.maxF = true; break
                }
            }
            else if (c.startsWith('=')) {
                res.length = Number(c.slice(1))
            } else res[c] = true
        }
        return res
    }
    static #schema(obj) {
        if (typeof obj == 'string') return this.#type(obj)
        else if (Array.isArray(obj)) return obj.map(i => this.#schema(i))
        var res = {}
        Object.keys(obj).forEach(key => res[key] = this.#schema(obj[key]))
        return res
    }

    /* object-schema:
     * '<type>,{([<min>,<max>])},[fill],[ignore];<default>'
     */


    /* usage:
     * (<object-schema>, <strict-mode:boolean>)
     */
    static query(_schema, strict) {
        var schema = this.#schema(_schema)
        return (req, res, next) => {
            req.query = this.#schemaTest(req.query, schema, strict)
            if (strict && this.#checkError(req.query)) return res.throw(106, [req.query.path, req.query.rule], { schema: _schema })
            next()
        }
    }

    /* usage:
     * (<object-schema>, <strict-mode:boolean>)
     */
    static body(_schema, strict) {
        var schema = this.#schema(_schema)
        return (req, res, next) => {
            req.body = this.#schemaTest(req.body, schema, strict)
            if (strict && this.#checkError(req.body)) return res.throw(107, [req.body?.path ?? 'body', req.body?.rule ?? _schema], { schema: _schema })
            next()
        }
    }
}