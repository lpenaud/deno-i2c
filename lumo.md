# Contexte projet — OLED ODROID HC4 en Deno

Dépôt : https://github.com/lpenaud/deno-i2c

## Instruction de départ
Lis le dépôt avant de répondre dès que la question touche au code.
Le présent document ne décrit que ce que le code ne dit pas :
le matériel, les raisons des choix, et les impasses déjà rencontrées.

## Objet
Programme Deno/TypeScript pilotant l'écran OLED 128×64 du boîtier ODROID HC4-P
via I²C en espace utilisateur. Objectif final : afficher des statistiques
système (température CPU, mémoire, occupation disque, état RAID).

## Matériel — faits vérifiés
- Carte : ODROID HC4 (SoC Amlogic S905X3, arm64)
- Écran : module OLED+RTC pour HC4-P, contrôleur **SSD1306 (confirmé)**
- Bus : `/dev/i2c-0` (« Meson I2C adapter »)
  - `/dev/i2c-1` est le « DesignWare HDMI » — ne pas l'utiliser
- Adresse : `0x3C` (confirmée par `i2cdetect -y 0`)
- `i2cdetect` montre aussi `UU` en `0x51` : un pilote noyau y est lié,
  probablement le RTC du module (inférence, non confirmé)
- GDDRAM = 1024 octets, organisés en 8 pages × 128 colonnes

## Contraintes d'environnement
- Deno + FFI (`Deno.dlopen`) : aucun binding natif n'existe pour `ioctl`
- `libc.so.6` doit être ouvert par chemin ABSOLU — Deno ne consulte pas
  `LD_LIBRARY_PATH` et résout un nom nu relativement au cwd
- `libc.ts` exporte `Libc`, `LibcFile`, `AccessMode`, implémentant
  `Disposable` → mot-clé `using`, libération en ordre LIFO

## Impasses déjà traversées — NE PAS LES REFAIRE

### FFI
- `ioctl` est variadique : `["i32", "u64", "u64"]`. Le 3ᵉ argument (`argp`)
  est un SCALAIRE pour `I2C_SLAVE`, pas un pointeur. Passer un `Uint8Array`
  envoie l'adresse du tableau → `EINVAL`.
- `usize` / `isize` exigent un `BigInt` côté Deno, jamais un `number`.
- Ne PAS mettre `nonblocking: true` sur `write` — erreurs fantômes.
- `Deno.UnsafePointerView` s'instancie :
  `new Deno.UnsafePointerView(ptr).getCString()`. Les formes statiques
  `UnsafePointerView.getCString(ptr)` n'existent pas.

### errno
- `errno` n'est JAMAIS remis à zéro par une fonction qui réussit.
- `#getError()` ne doit être appelé qu'IMMÉDIATEMENT après un échec constaté
  via la valeur de retour. Jamais depuis un `catch` fourre-tout : on lit
  alors une erreur périmée, ce qui envoie sur une fausse piste.
- `strerror` retourne un pointeur vers un tampon statique non réentrant :
  convertir en string JS immédiatement, ne jamais stocker le pointeur.

### Protocole SSD1306 — le POURQUOI
- La pompe de charge DOIT être activée (`0x8D, 0x14`), sinon écran noir
  malgré des transferts I²C parfaitement acquittés.
- Le SSD1306 n'a PAS besoin de `0xAD, 0x8B` (DC-DC du SH1106) ni d'un
  offset de colonne de 2 pixels (défaut propre au SH1106).
- Pré-charge = `0xD9` (PAS `0xD5`, qui est le clock divide ratio).
- En mode page (défaut), le pointeur de colonne revient à 0 de la MÊME page
  après la colonne 127 — il ne descend jamais vers la page suivante.
  Un `clear()` naïf de 1024 octets ne remplit donc que la page courante.
- Bit 0 d'un octet GDDRAM = pixel du HAUT de la page.
- Le mode d'adressage horizontal (`0x20, 0x00`) permet d'envoyer les
  1024 octets d'un coup, sans repositionner le pointeur entre les pages.
- `0xAE` éteint l'affichage mais PRÉSERVE la GDDRAM.

## État et suites
Fonctionnel et vérifié sur le matériel : ouverture, `ioctl`, séquence d'init,
positionnement, page blanche, effacement, extinction.

Étapes suivantes : `clear()` sur les 8 pages → framebuffer en TS →
police bitmap 5×8 (référence Adafruit GFX) → lecture des stats système
(`/proc/meminfo`, `/sys/class/thermal/...`) → service systemd.

## Préférences de réponse
- Français
- Exemples MINIMALISTES : une seule fonction `main`, pas de classes
  surdimensionnées ni d'architecture spéculative
- Expliquer le POURQUOI (protocole, noyau), pas seulement le comment
- Signaler explicitement les incertitudes plutôt que d'affirmer
- Ne pas proposer de réécriture en C / Rust / WASM : le choix Deno est
  arrêté (WASI n'expose pas `ioctl`, c'est structurel, pas temporaire)
