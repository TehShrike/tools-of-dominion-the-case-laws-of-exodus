const fs = require('fs')

const {
	ROW_TYPE,
	flatMap,
	int,
	grabAllRowText,
} = require('./shared')

function main() {
	const intermediate = require('./intermediate/content.json')

	const actuallyCareAbout = intermediate.filter(row => row.rowType !== ROW_TYPE.PAGE_HEADER)

	const chapters = splitRowsIntoChapters(actuallyCareAbout).map(chapter => {
		return {
			number: chapter.number,
			title: getChapterTitle(chapter.rows)
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

function getChapterTitle(rows) {
	return rows
		.filter(row => row.rowType === ROW_TYPE.CHAPTER_HEADING)
		.map(grabAllRowText)
		.join('')
}







main()
