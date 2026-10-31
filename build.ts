import * as fs from "@std/fs";
import * as pathLib from "@std/path";

const [DIST, FRONT, SRC] = ["dist", "front", "src"]
  .map((n) => pathLib.resolve(Deno.cwd(), n));

interface SpawnOptions {
  args: string[];
  cwd?: string;
}

async function spawn(
  bin: string | URL,
  options: SpawnOptions,
): Promise<number> {
  const command = new Deno.Command(bin, {
    ...options,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "null",
  });
  const process = command.spawn();
  console.log(bin, ...options?.args);
  const { code } = await process.status;
  return code;
}

function tryStat(path: string): Promise<Deno.FileInfo | null> {
  try {
    return Deno.stat(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return Promise.resolve(null);
    }
    throw error;
  }
}

// Maybe useful later
// deno-lint-ignore no-unused-vars
async function newerThan(p1: string, p2: string): Promise<boolean> {
  const [s1, s2] = await Promise.all([
    Deno.stat(p1),
    tryStat(p2),
  ]);
  return s2 === null ||
    s1.mtime === null ||
    s2.mtime === null ||
    s1.mtime > s2.mtime;
}

type BuildTask = () => Promise<number>;

async function sequential(
  ...tasks: BuildTask[]
): Promise<number> {
  for (const t of tasks) {
    const status = await t();
    if (status !== 0) {
      return status;
    }
  }
  return 0;
}

async function parallel(...tasks: BuildTask[]): Promise<number> {
  const codes = await Promise.all(tasks.map((t) => t()));
  return codes.find((c) => c !== 0) || 0;
}

// Maybe useful later
// deno-lint-ignore no-unused-vars
async function* walkTs(root: string | URL): AsyncIterableIterator<string> {
  const walk = fs.walk(root, {
    exts: [".ts"],
    followSymlinks: false,
    includeDirs: false,
    includeSymlinks: false,
  });
  for await (const { path } of walk) {
    yield path;
  }
}

/*
  SUB TASK
*/

function fmt(args: string[]): Promise<number> {
  return spawn(Deno.execPath(), {
    args: ["fmt", ...args],
  });
}

function lint(args: string[]) {
  return spawn(Deno.execPath(), {
    args: ["lint", ...args],
  });
}

function check(args: string[]): Promise<number> {
  return sequential(
    () => fmt(["--check", ...args]),
    () => lint([...args]),
  );
}

/*
  MAIN TASKS
*/

function front(): Promise<number> {
  return spawn(Deno.execPath(), {
    args: [
      "bundle",
      "--outdir",
      DIST,
      "--sourcemap=external",
      pathLib.resolve(FRONT, "main.ts"),
      pathLib.resolve(FRONT, "workers/worker.ts"),
    ],
  });
}

async function clean(): Promise<number> {
  const infiles = await Array.fromAsync(
    fs.walk(DIST, {
      exts: [".js", ".js.map"],
      followSymlinks: false,
      includeDirs: false,
      includeSymlinks: false,
    }),
    ({ path }) => path,
  );
  const dirs = new Set<string>(infiles.map((p) => pathLib.dirname(p)));
  console.log("rm", ...infiles);
  await Promise.all(infiles.map((p) => Deno.remove(p)));
  dirs.delete(DIST);
  console.log("rmdir", ...dirs);
  await Promise.all(dirs.values().map((p) => Deno.remove(p)));
  return 0;
}

function compile(): Promise<number> {
  return spawn(Deno.execPath(), {
    args: [
      "compile",
      "--allow-ffi",
      "--allow-read",
      "--allow-write",
      "--allow-net",
      "--target",
      "aarch64-unknown-linux-gnu",
      "--output",
      pathLib.join(DIST, "deno-i2c"),
      pathLib.join(SRC, "main.ts"),
    ],
  });
}

function fix(args: string[]): Promise<number> {
  return sequential(
    () => fmt([...args]),
    () => lint(["--fix", ...args]),
  );
}

function main([name, ...args]: string[]): Promise<number> {
  switch (name) {
    case "front":
      return front();

    case "clean":
      return clean();

    case "compile":
      return compile();

    case "fix":
      return fix(args);

    case "check":
      return check(args);

    case "all":
      return parallel(
        () => front(),
        () => compile(),
      );

    default:
      console.error(
        "Usage: %s COMMAND ...ARGS",
        import.meta.filename ?? import.meta.url,
      );
      return Promise.resolve(1);
  }
}

if (import.meta.main) {
  Deno.exit(await main([...Deno.args]));
}
