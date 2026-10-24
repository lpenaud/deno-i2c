# Projet : OLED SSD1306 sur ODROID HC4 avec Deno

## Contexte général

**Objectif :** Piloter l'écran OLED intégré 128×64 du boîtier ODROID HC4-P via I²C en espace utilisateur avec Deno/TypeScript, pour afficher des statistiques système (température CPU, mémoire, disque, état RAID).

**Dépôt GitHub :** https://github.com/lpenaud/deno-i2c

**Date :** 23 Oct 2026

---

## Matériel

| Composant | Référence |
|---|---|
| Carte mère | ODROID HC4 (SoC Amlogic S905X3, arm64) |
| Écran | Module OLED+RTC pour HC4-P, contrôleur **SSD1306** |
| Bus I²C | `/dev/i2c-0` (« Meson I2C adapter ») — ne pas utiliser `/dev/i2c-1` (HDMI) |
| Adresse SSD1306 | `0x3C` (confirmée par `i2cdetect -y 0`) |
| Adressage RTC | `0x51` (probable, marqué « UU » dans i2cdetect — pilote noyau lié) |
| GDDRAM | 1024 octets (8 pages × 128 colonnes) |

---

## Environnement logiciel

- **Langage :** TypeScript / Deno
- **FFI :** `Deno.dlopen` pour accès direct à `libc.so.6`
- **Contrainte FFI :** `ioctl` est variadique, le 3ᵉ argument pour `I2C_SLAVE` est scalaire (pas un pointeur)
- **Path libc :** doit être absolu — Deno ne consulte pas `LD_LIBRARY_PATH`
- **Pattern Disposable :** utilisation du mot-clé `using`, libération en ordre LIFO

---

## Architecture du code (sur GitHub)

### Structure connue

| Fichier | Rôle |
|---|---|
| `src/libc.ts` | Wrapper FFI vers `libc.so.6` (`open`, `close`, `write`, `ioctl`, `strerror`, `__errno_location`) |
| `src/main.ts` | Point d'entrée, séquence d'init, tests manuels |
| `src/utils.ts` | Utilitaires (ex: `constBuffer` pour paquets 2-octets) |
| Classe `Ssd1306Device` | Pilote SSD1306 complet (à vérifier dans dépôt) |

### Hypothèses non vérifiables hors dépôt

- Implémentation exacte de `writeNBytes` / `writeFrame`
- Gestion du buffer de payload (1025 octets avec activation byte)
- Méthodes publiques `page(index)` et privées `#getPage(page)`

---

## État d'avancement

### ✅ Résolu

| Élément | Détail |
|---|---|
| Ouverture I²C | `ioctl(0x0703n, 0x3Cn)` réussi |
| Séquence d'init | Complexe : charge pump, pré-charge, remap, contraste, VCOMH |
| **Mode horizontal** | `0x20, 0x00` + `0x21, 0x00, 0x7F` + `0x22, 0x00, 0x07` — **correct** |
| Buffer d'activation | `0x40` inclus dans chaque transaction I²C |
| Uniformité | Régulée via contraste (`0x81`) et condensateur de découplage |
| Async/await | Cohérent — `write()` renvoie `Promise<number>`, `LibcError` levé sur échec |

### ⏳ À implémenter

| Élément | Détails |
|---|---|
| Police bitmap 5×8 | Format Adafruit GFX (12 octets/caractère, ASCII 32–127) |
| Fonctions de dessin | `drawChar(x, y, char)`, `drawString(x, y, str)`, `clear()`, `fillRect()` |
| Lecture stats | `/proc/meminfo`, `/sys/class/thermal/thermal_zone*/temp`, `df`, `mdstat` |
| Service systemd | Unité qui démarre au boot, rafraîchissement périodique |

---

## Problèmes résolus — mémo technique

### 1. Octet d'activation (`0x40`)

**Bug initial :** `subarray(1)` créait une vue sans `0x40`, envoyé directement → interprétation comme commandes.

**Solution retenue :** Deux vues sur le même ArrayBuffer :
- `#payload` : ArrayBuffer complet (1025 octets), `[0] = 0x40`
- `#frame` : Vue `subarray(1)` (1024 octets), indexation naturelle `0..1023`

### 2. Commande `0x21` (Set Column Address)

**Bug initial :** Un seul argument passé (`0x7F`), début manquait.

**Correct :** `0x21, 0x00, 0x7F` (début, fin).

### 3. Mode page vs horizontal

**Piège classique :** En mode page, écrire 1024 octets ne remplit qu'une page (pointeur revient à 0 de la même page).

**Solution :** Basculer en mode horizontal (`0x20, 0x00`) avant l'envoi du framebuffer complet.

### 4. Uniformité en plein blanc

**Cause :** Chute ohmique sur les pistes ITO + alimentation insuffisante.

**Solutions appliquées :**
- Baisse du contraste (`0x81` à `0x7F` environ)
- Ajout condensateur 100µF + 100nF près du module

---

## Commandes SSD1306 — rappels essentiels

| Commande | Arguments | Rôle |
|---|---|---|
| `0x00` | — | Prefixe I²C : données suivantes sont commandes |
| `0x40` | — | Prefixe I²C : données suivantes sont pixels |
| `0x20` | `mode` | Mode adressage : `0`=horizontal, `1`=vertical, `2`=page |
| `0x21` | `start`, `end` | Plage colonnes (0–127) |
| `0x22` | `start`, `end` | Plage pages (0–7) |
| `0x8D` | `0x14` | Charge pump ON (obligatoire !)|
| `0xD9` | `0xF8` | Pré-charge (phase 1=15, phase 2=8) |
| `0x81` | `contrast` | Contrôle luminosité segments |
| `0xAE` / `0xAF` | — | Display OFF / ON |

**Important :** En mode horizontal, le pointeur auto-incrémente de colonne 0→127, puis page 0→7.

---

## Décisions d'architecture

| Sujet | Décision | Justification |
|---|---|---|
| Buffer complet vs incrémental | Framebuffer complet (1025 octets) | Simplifie l'API, acceptable pour rafraîchissement à la seconde |
| Mode page vs horizontal | Horizontal | Permet un seul write pour l'écran entier |
| Getters de page (`page1`, `page2`) | Méthode paramétrée `page(index)` | Évite le codage en dur (8 pages, pas 2) |
| Erreur errno | Levé via `LibcError` | Centralisé dans `libc.ts`, propre à la stack Deno |
| Taille de message I²C | 1025 octets en un write | À valider empiriquement sur HC4 ; fallback 256 si erreur |

---

## Limitations connues

1. **Limite I²C non mesurée** — `meson-i2c` peut avoir une taille max de message inférieure à 1025 octets. Test empirique requis si erreur `EINVAL`.
2. **Pas de lecture GDDRAM** — Le SSD1306 ne supporte pas la lecture en mode I²C (selon datasheet). Impossible de verifier l'état de l'écran sans le dessiner.
3. **PMOLED limitations** — Uniformité dégradée en plein blanc à cause de la chute ohmique des pistes ITO. Inévitable sans sacrifier la luminosité.
4. **Dépendance à `libc.so.6`** — Chemin absolu obligatoire. Sur ARM64 Linux, vérifier les chemins alternatifs (`/lib/aarch64-linux-gnu/`).

---

## Prochaines étapes recommandées

1. **Police bitmap** — Générer table ASCII 32–127, implémenter `drawChar` et `drawString`.
2. **Stats système** — Parser `/proc/meminfo`, `/sys/class/thermal/*`, `df` output, `cat /proc/mdstat`.
3. **Service systemd** — Créer unité `.service` avec `Type=simple`, `Restart=always`, intervalle de rafraîchissement configurable.
4. **Optimisations** — Ajouter dirty-tracking pour ne rafraîchir que les zones modifiées (optionnel).

---

## Sources de confiance

- Datasheet SSD1306 : commandes, timing, registres
- Document de contexte projet : https://github.com/lpenaud/deno-i2c/blob/main/README.md (à vérifier)
- Documentation Deno FFI : `Deno.dlopen`, `ForeignLibraryInterface`

---

## Notes personnelles

- **Contraste optimal trouvé :** autour de `0x7F` (à confirmer sur le module spécifique)
- **Pré-charge actuelle :** `0xF8` (longue, stable)
- **Découplage :** 100µF + 100nF installé près du module
- **Acceptable :** L'uniformité résiduelle est tolérable pour l'affichage de chiffres/stats

---

**Dernière mise à jour :** 23 Oct 2026

**Contact :** Voir issues GitHub ou discussion actuelle.