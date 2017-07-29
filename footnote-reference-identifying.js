const entries = require('ordered-entries')
const r = require('regex-fun')

const {
	str,
} = require('./shared')

const nonDigitOrColon = /[^\d:]+/
const anything = /.*?/

const buildRegex = (nextFootnoteNumber, delimiter = nonDigitOrColon) => r.combine(
	r.capture(
		/^/,
		r.optional(anything, delimiter),
	),
	str(nextFootnoteNumber),
	r.capture(
		r.optional(delimiter, anything),
		/$/
	)
)

const specialCases = entries({
	122: {
		11: 'l1'
	},
	166: {
		101: 'lOl'
	},
	200: {
		225: buildRegex(225, /[^\d]/)
	},
	222: {
		11: 'll'
	},
	227: {
		18: '1s'
	},
	264: {
		10: '1O'
	},
	273: {
		20: '2o'
	},
	286: {
		1: buildRegex('l', /,| /)
	},
	332: {
		10: '1o'
	},
	360: {
		40: buildRegex('w', /"| /)
	},
	371: {
		10: '1O',
		11: 'l1',
	},
	381: {
		40: '4O',
	},
	392: {
		10: buildRegex('to', /^|(?: $)/)
	},
	415: {
		77: buildRegex('7', /^|(?: $)/)
	},
	425: {
		10: 'lO',
	},
	451: {
		9: buildRegex('g', r.either('"', ' ')),
		11: 'l1',
	},
	458: {
		30: '3o'
	},
	471: {
		11: 'l1'
	},
	510: {
		11: 'l1'
	},
	515: {
		11: 'l1'
	},
	594: {
		60: '6o'
	},
	625: {
		18: 'i8'
	},
	645: {
		10: /not gonna find this!/
	},
	646: {
		10: buildRegex('to', /^|$/)
	},
	647: {
		11: 'l1'
	},
	665: {
		18: 'l8'
	},
	687: {
		10: 'IO'
	},
	700: {
		30: '3o'
	},
	705: {
		40: '4O'
	},
	725: {
		11: 'l1'
	},
	726: {
		15: 'i5'
	},
	744: {
		60: '6o'
	},
	759: {
		79: buildRegex('9 ', /^|$/)
	},
	770: {
		20: '2o'
	},
	777: {
		35: buildRegex('5', /^|$/)
	},
	790: {
		10: buildRegex('to ', /^|$/)
	},
	797: {
		20: '2o'
	},
	870: {
		20: '2o'
	},
	887: {
		10: 'lO',
		11: buildRegex('tt', /^|$/)
	},
	899: {
		40: /not here at all, srsly/
	},
	903: {
		10: buildRegex('to ', /^|$/)
	},
	915: {
		10: buildRegex('to ', /^|$/),
		11: 'l1'
	},
	916: {
		15: '1s'
	}
}).reduce((map, [pageNumber, object]) => {
	map[`./html/page${pageNumber}.html`] = object
	return map
}, Object.create(null))

module.exports = {
	specialCases,
	buildRegex
}
