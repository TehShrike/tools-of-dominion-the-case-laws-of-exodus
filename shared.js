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


module.exports = {
	ROW_TYPE,
	flatMap,
	int
}
