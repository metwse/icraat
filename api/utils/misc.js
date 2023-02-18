module.exports = {
    pg: {
        isSmallint(num) { return Number.isInteger(num) && num <= 32767 && num >= -32768 },
        isInt(num) { return Number.isInteger(num) && num <= 2147483647 && num >= -2147483648 },
        isBigint(num) { return Object.getPrototypeOf(num) == BigInt.prototype && num <= 9223372036854775807n && num >= -9223372036854775808n }
    },
	validateEmail(email) {
		if (!email || email.length > 254 || !/^[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/.test(email)) return false
		const parts = email.split("@")
		if (parts[0].length > 64) return false
		const domainParts = parts[1].split(".")
		if (domainParts.length > 16 || domainParts.some(part => part.length > 63)) return false
		return true
	}
}