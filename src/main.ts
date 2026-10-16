import { AccessMode, Libc } from "./libc.ts";

async function main(args: string[]): Promise<number> {
  const [path] = args;
  if (path === undefined) {
    console.error("Usage: %s DEVICE", import.meta.filename ?? import.meta.url);
    return 1;
  }
  // On ouvre la libc
  using libc = new Libc();
  // On ouvre le périphérique
  using device = libc.open(path, AccessMode.O_RDWR);
  // I2C_SLAVE => Indique au noyau je veux communiquer à une adresse
  // ADDR => C'est l'adresse
  // i2cSlave,addr
  device.ioctl(0x0703n, 0x3Cn);
  // Les commandes commence toujours pas 0
  // Sinon c'est du dessin

  // Séquence d'initialisation
  await device.write(Uint8Array.of(
    0x00, // mode commande pour tout ce qui suit
    0xAE, // display OFF
    0xD5, // clock divide ratio
    0x80,
    0xA8, // multiplex ratio 1/64
    0x3F,
    0xD3, // display offset
    0x00,
    0x40, // start line 0
    0x8D, // ← POMPE DE CHARGE (SSD1306)
    0x14,
    0xA1, // segment remap
    0xC8, // COM scan direction remap
    0xDA, // COM pins hardware config
    0x12,
    0x81, // contraste
    0xCF,
    0xD9, // pre-charge period
    0xF8,
    0xDB, // VCOMH deselect level
    0x40,
    0xA4, // affichage depuis la RAM
    0xA6, // non inversé
    0xAF, // display ON
  ));
  // Positionne le curseur en 0:0
  await device.write(Uint8Array.of(0x00, 0xB0, 0x00, 0x10));

  // Remplis la page 0 de blanc
  const buffer = new Uint8Array(129);
  // Activation byte
  buffer[0] = 0x40;
  // Blank
  buffer.fill(0xFF, 1);
  await device.write(buffer);

  confirm("La ligne devrait apparaitre blanche");
  buffer.fill(0x00, 1);
  await device.write(Uint8Array.of(0x00, 0xB0, 0x00, 0x10));
  await device.write(buffer);
  confirm("La ligne devrait être éteinte");
  // Éteint mais préserve la GDDRAM
  await device.write(Uint8Array.of(0x00, 0xAE));
  confirm("L'écran devrait être éteint");
  return 0;
}

if (import.meta.main) {
  Deno.exit(await main(Deno.args.slice()));
}
