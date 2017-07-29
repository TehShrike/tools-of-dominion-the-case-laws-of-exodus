const fs = require('fs')
const match = require('better-match')
const r = require('regex-fun')
const entries = require('ordered-entries')

const extend = (...args) => Object.assign({}, ...args)

const SECTION_TYPES = {
	TEXT: 'section:text',
	FOOTNOTE_REFERENCE: 'section:footnote reference',
}


const {
	ROW_TYPE,
	flatMap,
	int,
	str,
	grabAllRowText,
	assert,
} = require('./shared')

const footnoteReferenceIdentifying = require('./footnote-reference-identifying')

function main() {
	const intermediate = require('./intermediate/content.json')

	const actuallyCareAbout = intermediate.filter(row =>
		row.rowType !== ROW_TYPE.PAGE_HEADER
			&& (row.rowType === ROW_TYPE.PAGE_BREAK || int(row.style.left) < 220)
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

	const rowPropertiesToKeep = [
		'rowType',
		'sections',
		'file',
	]

	const sectionPropertiesToKeep = [
		'type',
		'value',
		'text',
	]

	const gussiedUpChapterText = chapters.map(chapter => {
		return extend(chapter, {
			text: chapter.text.map(row => {
				const output = {}
				rowPropertiesToKeep.forEach(property => {
					if (row[property] === undefined) {
						return
					}

					if (property === 'sections') {
						output.sections = row.sections.map(section => {
							const output = {}

							sectionPropertiesToKeep.forEach(property => {
								if (section[property] !== undefined) {
									output[property] = section[property]
								}
							})

							return output
						})
					} else {
						output[property] = row[property]
					}
				})
				return output
			})
		})
	})

	console.log(gussiedUpChapterText[0].text)

	gussiedUpChapterText.forEach(chapter => {
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
	let lastBodies = []

	return array.map(element => {
		const result = Object.assign({
			// last,
			lastBodies: [ ...lastBodies ]
		}, element)

		if (element.rowType === ROW_TYPE.BODY) {
			lastBodies.unshift(element)
			if (lastBodies.length > 5) {
				lastBodies.pop()
			}
		} else if (element.rowType === ROW_TYPE.PAGE_BREAK) {
			lastBodies = []
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
		map[footnote.number] = cleanUpTextSections(footnote.text)
		return map
	}, Object.create(null))

	return footnotesMap
}

const sectionHasLeadingFootnoteNumber = (row, section) => {
	if (row.lastBodies.length === 0) {
		return false
	}

	const isIndented = rowIsIndented(row)
	const indentedWithLeadingDigits = isIndented && /^\d+ ?\./.test(section.text)

	// if (row.file === './html/page747.html') {
	// 	console.log(
	// 		indentInPixels > 5,
	// 		indentInPixels < 20,
	// 		/^\d+ ?\./.test(section.text)
	// 	)
	// }

	return indentedWithLeadingDigits
		|| (row.file === './html/page533.html' && /^, 39\. /.test(section.text))
}























function getChapterTextFromBody(rows, footnoteCount) {
	const rowsOfTextAndFootnoteSections = turnSectionsIntoTextAndFootnoteSections(rows, footnoteCount)

	const rowsIncludingHeaders = identifyHeadingRows(rowsOfTextAndFootnoteSections)

	// identify block quotes
	// identify headers
	// identify paragraph breaks

	/*
		Instead of rows, "portions" or something
			- paragraph
			- heading (1, 2, 3)
			- block quote
			- list?
		Containing sections
			- text
			- footnote reference
	*/

	return rowsOfTextAndFootnoteSections.filter(section => !(section.type === SECTION_TYPES.TEXT && section.text === ''))
}

function identifyHeadingRows(rows) {
	return rows.map(row => {
		const indent = getRowIndentInPixels(row)

		// headers must be after a page break or gap (20+ px since the top of the last)
		// mostly italic or mostly bold
		// or, indented more than 32px

		const rowWithSectionsCombined = type => extend(row, { sections: combineAdjacentTextBlocks(row.sections, type) })

		if (indent < 5 && sectionsAreMostlyItalic(row.sections)) {
			return rowWithSectionsCombined(SECTION_TYPES.HEADING_3)
		} else {
			return row
		}
	})
}

const combineAdjacentTextBlocks = (sections, newBlockType = SECTION_TYPES.TEXT) => {
	const templateTextBlock = sections.find(section => section.type === SECTION_TYPES.TEXT)
	const templateBlock = extend(templateTextBlock, { text: '', type: newBlockType })

	let accumulatingText = ''
	const getCurrentTextSection = () => {
		if (!accumulatingText) {
			return []
		}

		const newBlock = extend(templateBlock, { text: accumulatingText })
		accumulatingText = ''
		return newBlock
	}


	const allSectionsExceptLastGroup = flatMap(sections, section => {
		if (section.type === SECTION_TYPES.TEXT) {
			accumulatingText += section.text
			return []
		} else {
			return [
				getCurrentTextSection(),
				section
			]
		}
	})

	return accumulatingText
		? [ ...allSectionsExceptLastGroup, ...getCurrentTextSection() ]
		: allSectionsExceptLastGroup
}

function turnSectionsIntoTextAndFootnoteSections(rows, footnoteCount) {

	let nextFootnoteNumber = 1

	const bodyRows = rows.filter(row => row.rowType === ROW_TYPE.BODY)

	const section = type => section => extend(section, { type })
	const textBlock = section(SECTION_TYPES.TEXT)
	const footnoteReferenceBlock = section(SECTION_TYPES.FOOTNOTE_REFERENCE)

	const {specialCases, buildRegex} = footnoteReferenceIdentifying

	const log = null
	const startedLookingForFootnote = {}

	const splitIntoSectionsWithFootnotes = (section, file) => {
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
				splitIntoSectionsWithFootnotes(extend(section, { text: after }), file),
			]

			return newBlocks
		} else {
			return textBlock(section)
		}
	}

	const rowsWithFootnotesInBlocks = bodyRows.map(row => {
		const sections = flatMap(row.sections, section => {

			if (log && row.file === `./html/page${log}.html`) {
				console.log('nextFootnoteNumber is', nextFootnoteNumber, '- looking at', section)
			}

			return splitIntoSectionsWithFootnotes(section, row.file)
		})

		return extend(row, { sections })
	})

	// console.log(rows)
	// console.log(rowsWithFootnotesInBlocks)

	assert(nextFootnoteNumber - 1 === footnoteCount, `Expected ${footnoteCount} footnotes but only got ${nextFootnoteNumber - 1} (${startedLookingForFootnote[nextFootnoteNumber]})`)

	return rowsWithFootnotesInBlocks
}































const matches = (row, section, pageNumber, rowType, text) => row.file === `./html/page${pageNumber}.html`
	&& row.rowType === rowType
	&& section.text === text
const sectionWithNewText = (section, text) => extend(section, { text })

const junkToFilter = [
	(row, section) => matches(row, section, 870, ROW_TYPE.FOOTNOTE, '~ ')
]
const junkToMap = [
	// TODO: fix the footnotes that had the "7" end up split across different sections
	(row, section) => matches(row, section, 903, ROW_TYPE.FOOTNOTE, 'B. ')
		? sectionWithNewText(section, '8. ')
		: section
]
const getNonJunkSections = row => {
	if (!row.sections) {
		return []
	}
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

const rowIsIndented = row => {
	const indentInPixels = getRowIndentInPixels(row)

	return indentInPixels > 5
		&& indentInPixels < 20
}

const getRowIndentInPixels = row => {
	if (row.lastBodies.length === 0) {
		return 0
	}

	const minimumLeftAlignment = row.lastBodies
		.map(element => int(element.style.left))
		.reduce((min, current) => current < min ? current : min)

	return int(row.style.left) - minimumLeftAlignment
}

const sectionsAreMostlyItalic = sections => {
	const totals = sections
		.filter(section => section.type === SECTION_TYPES.TEXT)
		.map(({ text, style: { italic }}) => ({text, italic }))
		.reduce((totals, { text, italic }) => {
			const words = text.split(/\s+/).length
			if (italic) {
				totals.italic += words
			} else {
				totals.normal += words
			}
			return totals
		}, { normal: 0, italic: 0 })

	return (totals.normal / totals.italic) <= 0.4
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
const cleanUpTextSections = textSections => textSections
	.filter(({ text }) => text)
	.map(section => Object.assign({}, section, { text: removeTrailingDash(section.text) }))

const ifthen = (value, ifFn, thenFn) => value ? ifFn() : thenFn()

main()
