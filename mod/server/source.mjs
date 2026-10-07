// Turns the fibers the app found under a touch into what the prompt says: the element that
// was pressed, where its JSX is written, and the app's components around it.
//
// The app sends the fibers from the pressed host view outward. Each carries where its element
// was created: `source` (React 18 and earlier, from Babel) or `stack` (React 19: the stack of
// the JSX call, in bundle coordinates, symbolicated here through Metro).

const FRAME = /^\s*at (?:(.*?) \()?(?:address at )?(.+?):(\d+):(\d+)\)?\s*$/

/** The frames of an `Error.stack`, as Metro's /symbolicate takes them. */
export function parseStack(stack) {
  const frames = []
  for (const line of String(stack).split('\n')) {
    const match = FRAME.exec(line)
    if (!match) continue
    const [, methodName, file, lineNumber, column] = match
    frames.push({ methodName: methodName ?? '<anonymous>', file, lineNumber: Number(lineNumber), column: Number(column) })
  }
  return frames
}

/** Whether a file is the app's own code: in the project, outside node_modules. */
export function isProjectFile(file, cwd) {
  return typeof file === 'string' && file.startsWith(cwd + '/') && !file.includes('/node_modules/')
}

/**
 * Where an element was created: the first frame after React's own JSX call. Render stacks
 * hold only the rendering component and React's work loop, so a few frames are enough.
 */
function creationSite(frames, cwd) {
  return frames.slice(0, 6).find(frame => isProjectFile(frame.file, cwd)) ?? null
}

/** Asks Metro to map bundle frames to source files. Frames that are not bundle URLs stay as they are. */
export async function symbolicate(frames, { fetch: request = fetch } = {}) {
  const origin = frames.map(frame => /^https?:\/\/[^/]+/.exec(frame.file)?.[0]).find(Boolean)
  if (!origin || frames.length === 0) return frames
  const response = await request(`${origin}/symbolicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stack: frames }),
  })
  if (!response.ok) throw new Error(`metro answered ${response.status}`)
  const { stack } = await response.json()
  return Array.isArray(stack) && stack.length === frames.length ? stack : frames
}

/**
 * The pressed element's type, its source line and the components around it, from the app's fibers.
 * The pressed element is the innermost fiber written in the project: a `<Text>` in
 * AmountLabel.tsx, not the native view `Text` renders. The components are those whose render
 * wrote one of the fibers, innermost first.
 */
export async function locate(chain, cwd, options) {
  const parsed = chain.map(fiber => (fiber.source ? null : parseStack(fiber.stack ?? '').slice(0, 6)))
  const all = parsed.flatMap(frames => frames ?? [])
  let mapped = all
  try {
    mapped = await symbolicate(all, options)
  } catch (error) {
    process.stderr.write(`symbolicate: ${error.message}\n`)
  }

  let offset = 0
  const sites = chain.map((fiber, index) => {
    if (fiber.source) {
      const { fileName, lineNumber, columnNumber } = fiber.source
      return isProjectFile(fileName, cwd) ? { file: fileName, lineNumber, column: columnNumber } : null
    }
    const count = parsed[index].length
    const frames = mapped.slice(offset, offset + count)
    offset += count
    return creationSite(frames, cwd)
  })

  const pressedAt = sites.findIndex(Boolean)
  if (pressedAt === -1) return { type: null, source: null, components: [] }

  const components = []
  chain.forEach((fiber, index) => {
    const name = fiber.owner ?? sites[index]?.methodName
    if (sites[index] && name && !components.includes(name)) components.push(name)
  })
  const site = sites[pressedAt]

  return {
    type: chain[pressedAt].name,
    source: { file: site.file, line: site.lineNumber, column: site.column },
    components,
  }
}
