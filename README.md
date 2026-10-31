# Deno I2C

A script to control the integrated monochrome OLED display on my Odroid HC4.

## Device

To identify the correct I2C device, first install `i2c-tools`, then run:

```
$ sudo i2cdetect -l
i2c-0   i2c             Meson I2C adapter                       I2C adapter
i2c-1   i2c             DesignWare HDMI                         I2C adapter
```

So in my case, I use i2c-0 since the other is the HDMI output.

## Usage

```bash
sudo deno-i2c DEVICE
```

**Example**:

```bash
sudo deno-i2c /dev/i2c-0
```

## TODO

Generate an alphabet from a `<canvas>` element.
