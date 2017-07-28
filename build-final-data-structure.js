const fs = require('fs')
const match = require('better-match')
const r = require('regex-fun')
const entries = require('ordered-entries')

const extend = (...args) => Object.assign({}, ...args)

const BLOCK_TYPES = {
	TEXT: 'block:text',
	FOOTNOTE_REFERENCE: 'block:footnote reference'
}


const {
	ROW_TYPE,
	flatMap,
	int,
	str,
	grabAllRowText,
	assert,
} = require('./shared')

function main() {
	const intermediate = require('./intermediate/content.json')

	const actuallyCareAbout = intermediate.filter(row =>
		row.rowType !== ROW_TYPE.PAGE_HEADER
			&& int(row.style.left) < 220
	)

	const chapters = splitRowsIntoChapters(actuallyCareAbout).map(chapter => {
		console.log('processing chapter', chapter.number)
		const rows = fixJunkSections(addPointerTolast(chapter.rows))
		const footnotes = getChapterFootnotes(rows)
		return {
			number: chapter.number,
			title: getChapterTitle(rows),
			text: getChapterTextFromBody(rows, Object.keys(footnotes).length),
			footnotes,
		}
	})

	console.log(chapters[0].text)

	chapters.forEach(chapter => {
		fs.writeFileSync(`./json/chapter-${chapter.number}.json`, JSON.stringify(chapter, null, '\t'))
	})

}

function splitRowsIntoChapters(data) {
	const chapters = []
	let currentChapter = null

	const createChapter = (number, row) => {
		currentChapter = {
			number,
			rows: row ? [ row ] : []
		}
		chapters.push(currentChapter)
	}

	data.forEach(row => {
		if (!currentChapter && row.rowType === ROW_TYPE.CHAPTER_HEADING) {
			createChapter(0, row)
		} else if (row.rowType === ROW_TYPE.CHAPTER_HEADING && row.sections[0].text === 'CONCLUSION') {
			createChapter(currentChapter.number + 1, row)
		} else if (row.rowType === ROW_TYPE.CHAPTER_NUMBER) {
			createChapter(int(row.sections[0].text))
		} else {
			currentChapter.rows.push(row)
		}
	})

	return chapters
}

function addPointerTolast(array) {
	let last = null
	const lastBodies = []
	return array.map(element => {
		const result = Object.assign({
			// last,
			lastBodies: [ ...lastBodies ]
		}, element)
		last = element
		if (element.rowType === ROW_TYPE.BODY) {
			lastBodies.unshift(element)
			if (lastBodies.length > 5) {
				lastBodies.pop()
			}
		}
		return result
	})
}

function getChapterTitle(rows) {
	return rows
		.filter(row => row.rowType === ROW_TYPE.CHAPTER_HEADING)
		.map(grabAllRowText)
		.join('')
}



















function getChapterFootnotes(rows) {
	const footnotesArray = []
	let currentFootnote = null

	const startFootnote = (number, textObject) => {
		currentFootnote = {
			number,
			text: textObject ? [ textObject ] : []
		}
		footnotesArray.push(currentFootnote)
	}
	const addSectionsTextBlocks = sections => sections.forEach(section => {
		currentFootnote.text.push(makeTextBlockFromSection(section))
	})

	rows
		.filter(row => row.rowType === ROW_TYPE.FOOTNOTE)
		.forEach(row => {
			if (sectionHasLeadingFootnoteNumber(row, row.sections[0])) {
				const [ firstSection, ...restOfSections ] = row.sections

				const [ number, textObject ] = parseOutFootnoteNumberAndText(firstSection)
				const expectedNumber = currentFootnote ? currentFootnote.number + 1 : 1
				try {
					assert(number === expectedNumber, `Expected footnote ${expectedNumber} but got ${number} in ${row.file}`)
				} catch (e) {
					console.error(currentFootnote.text)
					console.error(row)
					throw e
				}


				startFootnote(number, textObject)
				addSectionsTextBlocks(restOfSections)
			} else {
				if (!currentFootnote) {
					throw new Error(`No current footnote found for footnote row ${JSON.stringify(row, null, '\t')}`)
				}
				addSectionsTextBlocks(row.sections)
			}
		})

	footnotesArray.push(currentFootnote)

	const footnotesMap = footnotesArray.reduce((map, footnote) => {
		map[footnote.number] = cleanUpTextBlocks(footnote.text)
		return map
	}, Object.create(null))

	return footnotesMap
}

const sectionHasLeadingFootnoteNumber = (row, section) => {
	if (row.lastBodies.length === 0) {
		return false
	}
	const minimumLeftAlignment = row.lastBodies
		.map(element => int(element.style.left))
		.reduce((min, current) => current < min ? current : min)

	const indentInPixels = int(row.style.left) - minimumLeftAlignment

	const generalCheck = indentInPixels > 5
		&& indentInPixels < 20
		&& /^\d+ ?\./.test(section.text)

	// if (row.file === './html/page747.html') {
	// 	console.log(
	// 		indentInPixels > 5,
	// 		indentInPixels < 20,
	// 		/^\d+ ?\./.test(section.text)
	// 	)
	// }

	return generalCheck
		|| (row.file === './html/page533.html' && /^, 39\. /.test(section.text))
}























function getChapterTextFromBody(rows, footnoteCount) {
	const textAndFootnoteBlocks = turnSectionsIntoTextAndFootnoteBlocks(rows, footnoteCount)

	return textAndFootnoteBlocks.filter(block => !(block === BLOCK_TYPES.TEXT && block.text === ''))
}

function turnSectionsIntoTextAndFootnoteBlocks(rows, footnoteCount) {
	const nonDigitOrColon = /[^\d:]+/
	const anything = /.*?/

	let nextFootnoteNumber = 1

	const bodyRows = rows.filter(row => row.rowType === ROW_TYPE.BODY)

	const block = type => section => extend(section, { type })
	const textBlock = block(BLOCK_TYPES.TEXT)
	const footnoteReferenceBlock = block(BLOCK_TYPES.FOOTNOTE_REFERENCE)
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

	const log = null
	const startedLookingForFootnote = {}

	const splitIntoBlocksWithFootnotes = (section, file) => {
		const specialCase = specialCases[file] && specialCases[file][nextFootnoteNumber]
		const regex = ifthen(specialCase,
			() => (specialCase instanceof RegExp) ? specialCase : buildRegex(specialCase),
			() => buildRegex(nextFootnoteNumber)
		)

		if (regex.test(section.text)) {
			const footnoteBlock = footnoteReferenceBlock(extend(section, { value: nextFootnoteNumber, text: undefined }))
			nextFootnoteNumber++
			startedLookingForFootnote[nextFootnoteNumber] = file

			const [[before, after]] = match(regex, section.text)

			const newBlocks = [
				textBlock(extend(section, { text: before })),
				footnoteBlock,
				splitIntoBlocksWithFootnotes(extend(section, { text: after }), file),
			]

			return newBlocks
		} else {
			return textBlock(section)
		}
	}

	const blocksWithTypes = flatMap(bodyRows, row => {
		return row.sections.map(section => {

			if (log && row.file === `./html/page${log}.html`) {
				console.log('nextFootnoteNumber is', nextFootnoteNumber, '- looking at', section)
			}

			return splitIntoBlocksWithFootnotes(section, row.file)
		})
	})

	// console.log(rows)
	// console.log(blocksWithTypes)

	assert(nextFootnoteNumber - 1 === footnoteCount, `Expected ${footnoteCount} footnotes but only got ${nextFootnoteNumber - 1} (${startedLookingForFootnote[nextFootnoteNumber]})`)

	return blocksWithTypes
}































const matches = (row, section, pageNumber, rowType, text) => row.file === `./html/page${pageNumber}.html`
	&& row.rowType === rowType
	&& section.text === text
const sectionWithNewText = (section, text) => extend(section, { text })

const junkToFilter = [
	(row, section) => matches(row, section, 870, ROW_TYPE.FOOTNOTE, '~ ')
]
const junkToMap = [
	(row, section) => matches(row, section, 903, ROW_TYPE.FOOTNOTE, 'B. ')
		? sectionWithNewText(section, '8. ')
		: section
]
const getNonJunkSections = row => {
	return row.sections
		.filter(section => {
			return junkToFilter.every(filterFunction => !filterFunction(row, section))
		})
		.map(section => {
			return junkToMap.reduce((section, mapFunction) => mapFunction(row, section), section)
		})
}
const fixJunkSections = rows => {
	return rows.map(row => extend(row, {
		sections: getNonJunkSections(row)
	}))
}

const parseOutFootnoteNumberAndText = section => {
	const [ number, rest ] = match(/^[^\d]*(\d+) ?\. *(.*)/, section.text)[0]
	const textObject = Object.assign(makeTextBlockFromSection(section), {
		text: rest
	})

	return [ int(number), textObject ]
}
const makeTextBlockFromSection = section => ({
	text: section.text,
	italic: section.fontStyle === 'italic'
})

const removeTrailingDash = str => str.replace(/-$/, () => '')
const cleanUpTextBlocks = textBlocks => textBlocks
	.filter(({ text }) => text)
	.map(block => Object.assign({}, block, { text: removeTrailingDash(block.text) }))

const ifthen = (value, ifFn, thenFn) => value ? ifFn() : thenFn()

main()
