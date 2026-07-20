import { NextResponse } from "next/server"
import fs from 'fs'
import path from 'path'
import { getTelosDir } from '@/lib/telos-dir'

const TELOS_DIR = getTelosDir()

export async function POST(request: Request) {
  try {
    const { filename, content } = await request.json()

    if (!filename || content === undefined) {
      return NextResponse.json(
        { error: "Filename and content are required" },
        { status: 400 }
      )
    }

    // Determine file path
    const isCSV = filename.endsWith('.csv')
    let filePath: string

    if (isCSV) {
      const csvDir = path.join(TELOS_DIR, 'data')
      filePath = path.join(csvDir, filename)
    } else {
      filePath = path.join(TELOS_DIR, filename)
    }

    // Reject path traversal: the resolved write path must stay inside TELOS_DIR.
    const resolved = path.resolve(filePath)
    if (resolved !== path.resolve(TELOS_DIR) && !resolved.startsWith(path.resolve(TELOS_DIR) + path.sep)) {
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      )
    }

    // Verify file exists before overwriting
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `File ${filename} does not exist` },
        { status: 404 }
      )
    }

    // Save file
    fs.writeFileSync(filePath, content, 'utf-8')

    // Log the edit
    const timestamp = new Date().toISOString()
    const logMessage = `\n## ${timestamp}\n\n- **Action:** File edited via dashboard\n- **File:** ${filename}\n`

    const updatesPath = path.join(TELOS_DIR, 'updates.md')
    if (fs.existsSync(updatesPath)) {
      fs.appendFileSync(updatesPath, logMessage)
    }

    return NextResponse.json({
      success: true,
      message: `${filename} saved successfully`,
    })
  } catch (error) {
    console.error("Error saving file:", error)
    return NextResponse.json(
      { error: "Failed to save file" },
      { status: 500 }
    )
  }
}
