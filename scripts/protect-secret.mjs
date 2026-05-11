import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, join, relative } from "node:path"
import { tmpdir } from "node:os"

const outputDir = process.env.QUARTZ_OUTPUT_DIR ?? "public"
const secretDirName = process.env.PROTECTED_DIR ?? "secret"
const password = process.env.STATICRYPT_PASSWORD

if (!password) {
  throw new Error("STATICRYPT_PASSWORD is required")
}

const protectedDir = join(outputDir, secretDirName)

function removeSecretFromContentIndex() {
  const indexPath = join(outputDir, "static", "contentIndex.json")
  if (!existsSync(indexPath)) {
    console.log(`No content index found at ${indexPath}`)
    return
  }

  const index = JSON.parse(readFileSync(indexPath, "utf8"))
  let removed = 0

  for (const [key, value] of Object.entries(index)) {
    const slug = value?.slug ?? key
    const filePath = value?.filePath ?? ""
    if (key.startsWith(`${secretDirName}/`) || slug.startsWith(`${secretDirName}/`) || filePath.startsWith(`${secretDirName}/`)) {
      delete index[key]
      removed += 1
    }
  }

  writeFileSync(indexPath, `${JSON.stringify(index)}\n`)
  console.log(`Removed ${removed} ${secretDirName}/ entries from ${indexPath}`)
}

function collectHtmlFiles(dir) {
  if (!existsSync(dir)) {
    return []
  }

  const files = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      files.push(...collectHtmlFiles(fullPath))
    } else if (stats.isFile() && fullPath.endsWith(".html")) {
      files.push(fullPath)
    }
  }
  return files
}

removeSecretFromContentIndex()

if (!existsSync(protectedDir)) {
  console.log(`No ${protectedDir} directory found, skipping Staticrypt encryption.`)
  process.exit(0)
}

const htmlFiles = collectHtmlFiles(protectedDir)
console.log(`Encrypting ${htmlFiles.length} HTML files under ${protectedDir}`)

for (const file of htmlFiles) {
  const tempDir = mkdtempSync(join(tmpdir(), "staticrypt-"))
  execFileSync(
    "npx",
    [
      "staticrypt",
      file,
      "--password",
      password,
      "--directory",
      tempDir,
      "--short",
      "--remember",
      "30",
    ],
    { stdio: "inherit" },
  )

  const encryptedFile = join(tempDir, basename(file))
  writeFileSync(file, readFileSync(encryptedFile))
  rmSync(tempDir, { recursive: true, force: true })
  console.log(`Encrypted ${relative(outputDir, file)}`)
}
