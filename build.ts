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

async function sequential(
  ...tasks: (() => Promise<number>)[]
): Promise<number> {
  for (const t of tasks) {
    const status = await t();
    if (status !== 0) {
      return status;
    }
  }
  return 0;
}

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

async function front(): Promise<number> {
  const infiles = await Array.fromAsync(walkTs(FRONT));
  const results = await Promise.all(
    infiles.map(async (path) => {
      const { name, dir } = pathLib.parse(path);
      const outfile = pathLib.format({
        dir: pathLib.resolve(DIST, pathLib.relative(FRONT, dir)),
        name,
        ext: ".js",
      });
      return await newerThan(path, outfile) ? path : null;
    }),
  );
  const changed = results.filter((p) => p !== null);
  return sequential(
    () => fmt(["--check", ...changed]),
    () =>
      spawn(Deno.execPath(), {
        args: [
          "transpile",
          "--outdir",
          DIST,
          "--source-map",
          "separate",
          ...changed,
        ],
        cwd: FRONT,
      }),
  );
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

async function compile(): Promise<number> {
  const infiles = await Array.fromAsync(walkTs(SRC));
  return sequential(
    () => check([...infiles]),
    () =>
      spawn(Deno.execPath(), {
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
      }),
  );
}

function fix(): Promise<number> {
  return sequential(
    () => fmt([]),
    () => lint(["--fix"]),
  );
}

function main([name]: string[]): Promise<number> {
  switch (name) {
    case "front":
      return front();

    case "clean":
      return clean();

    case "compile":
      return compile();

    case "fix":
      return fix();

    default:
      console.error(
        "Usage: %s TASK ...ARGS",
        import.meta.filename ?? import.meta.url,
      );
      return Promise.resolve(1);
  }
}

if (import.meta.main) {
  Deno.exit(await main([...Deno.args]));
}
