const fs = require('fs')
const match = require('better-match')

const {
	ROW_TYPE,
	flatMap,
	int,
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
		const rows = fixJunkSections(addPointerTolast(chapter.rows))
		return {
			number: chapter.number,
			title: getChapterTitle(rows),
			footnotes: getChapterFootnotes(rows),
		}
	})

	console.log(chapters)
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
	const footnotes = []
	let currentFootnote = null

	const startFootnote = (number, textObject) => {
		currentFootnote = {
			number,
			text: textObject ? [ textObject ] : []
		}
		footnotes.push(currentFootnote)
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


const matches = (row, section, pageNumber, rowType, text) => row.file === `./html/page${pageNumber}.html`
	&& row.rowType === rowType
	&& section.text === text
const sectionWithNewText = (section, text) => Object.assign({}, section, { text })

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
	return rows.map(row => Object.assign({}, row, {
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




main()
