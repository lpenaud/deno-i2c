import { Ssd1306Device } from "./ssd1306.ts";

const MIN_X = 0;
const MAX_X = 5;

const MIN_Y = 0;
const MAX_Y = 8;

function row(x: number, y: number, value: number) {
  return `<td><input type="number" name="${x}_${y}" min="0" max="1" value="${value & 1}" /></td>`;
}

function* table(page: Uint8Array) {
  yield "<table>";
  yield "<tr>";
  yield "<th></th>";
  for (let x = MIN_X; x < MAX_X; x++) {
    yield `<th>x=${x}</th>`;
  }
  yield "</tr>";
  for (let y = MAX_Y - 1; y >= MIN_Y; y--) {
    yield "<tr>";
    yield `<th>y=${y}</th>`;
    for (let x = MIN_X; x < MAX_X; x++) {
      yield row(x, y, page[x] >> y);
    }
    yield "</tr>";
  }
  yield "</table>";
}

function page(page: Uint8Array): Response {
  const content = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ssd1306</title>
  </head>
  <body>
    <form action="/" method="post">
      ${table(page).toArray().join("")}
      <button type="submit">Send</button>
    </form>
  </body>
</html>`;
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
    },
  });
}

async function tab2page(
  device: Ssd1306Device,
  req: Request,
): Promise<Response> {
  const data = await req.formData();
  const [p1] = device.pages;
  for (let x = MIN_X; x < MAX_X; x++) {
    let value = "";
    for (let y = MAX_Y - 1; y >= MIN_Y; y--) {
      const v = data.get(`${x}_${y}`);
      console.log(`${x}:${y}=${v}`);
      value += v;
    }
    p1[x] = parseInt(value, 2);
    console.log(`p1[${x}]=`, p1[x].toString(2).padStart(5, "0"));
  }
  device.writeFrame();
  return page(p1);
}

export function serve(device: Ssd1306Device): Deno.ServeHandler {
  const [p1] = device.pages;
  return (req) => {
    const url = new URL(req.url);
    if (url.pathname !== "/") {
      return new Response("404", {
        status: 404,
      });
    }
    if (req.method === "GET") {
      return page(p1);
    }
    if (req.method === "POST") {
      return tab2page(device, req);
    }
    return new Response("400", {
      status: 400,
    });
  };
}
