const flatten = require('just-flatten')

const ROW_TYPE = [
	'CHAPTER_HEADING',
	'CHAPTER_NUMBER',
	'BODY',
	'INTRO_VERSE',
	'PAGE_HEADER',
	'FOOTNOTE',
].reduce((map, type) => {
	map[type] = 'row:' + type.replace(/_/g, ' ').toLowerCase()
	return map
}, Object.create(null))

const flatMap = (array, fn) => flatten(array.map(fn))
const int = str => parseInt(str, 10)
const grabAllRowText = row => row.sections.map(({ text }) => text).join('')

function assert(value, message) {
	if (!value) {
		throw new Error(message || `ASSERT!`)
	}
}

module.exports = {
	ROW_TYPE,
	flatMap,
	int,
	grabAllRowText,
	assert
}
